#!/usr/bin/env python3
"""Build the FIDE 2500+ players dataset for the site.

Parses a monthly FIDE `standard_rating_list` XML dump (e.g.
`D:\\fide\\fide_players_list-2026-08.xml`) via iterparse, keeps every
player whose standard, rapid, or blitz rating is at least 2500, and
writes a compact JSON array to public/data/fide-players.json.

Fields per record (short keys keep the payload lean):
    id     FIDE ID (int)
    name   "Last, First" as FIDE stores it
    country 3-letter FIDE federation code
    sex    "M" or "F"
    title  Best-of {title, w_title}; empty string if untitled
    std    Standard rating (int; 0 if none)
    rapid  Rapid rating    (int; 0 if none)
    blitz  Blitz rating    (int; 0 if none)
    born   Birth year (int) or null
    active True unless FIDE has flagged the player inactive ("i" in <flag>)

Usage:
    python scripts/build_fide_players.py D:\\fide\\fide_players_list-2026-08.xml
    python scripts/build_fide_players.py <xml> --min 2400 --out custom.json

The generated JSON also carries a metadata sibling file
`public/data/fide-players.meta.json` with {source, generated, count, min_rating}.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / 'public' / 'data' / 'fide-players.json'
DEFAULT_META = ROOT / 'public' / 'data' / 'fide-players.meta.json'
SOURCE_STEM = re.compile(r'^fide_players_list-(\d{4}-\d{2})\.xml$', re.I)

# Title precedence for the display column: keep the highest-status one.
# GM > IM > WGM > FM > WIM > CM > WFM > NM > WCM > WNM.
TITLE_PRIORITY = {t: i for i, t in enumerate(
    ['GM', 'IM', 'WGM', 'FM', 'WIM', 'CM', 'WFM', 'NM', 'WCM', 'WNM']
)}


def rating_int(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(value)
    except ValueError:
        return 0


def pick_title(title: str | None, w_title: str | None) -> str:
    for candidate in (title or '', w_title or ''):
        candidate = candidate.strip()
        if candidate and candidate in TITLE_PRIORITY:
            # For a woman GM (title=GM, w_title=WGM), the open title wins.
            other = (w_title if candidate == (title or '').strip() else title) or ''
            other = other.strip()
            if other in TITLE_PRIORITY and TITLE_PRIORITY[other] < TITLE_PRIORITY[candidate]:
                return other
            return candidate
    return ''


def build(xml_path: Path, min_rating: int, out_path: Path, meta_path: Path) -> None:
    if not xml_path.is_file():
        raise SystemExit(f'error: source XML not found: {xml_path}')

    kept: list[dict] = []
    scanned = 0
    print(f'Scanning {xml_path.name} for players with std/rapid/blitz >= {min_rating}...',
          flush=True)

    # iterparse handles the 800MB file without loading the whole DOM.
    context = ET.iterparse(xml_path, events=('end',))
    for event, elem in context:
        if elem.tag != 'player':
            continue
        scanned += 1
        std = rating_int(elem.findtext('rating'))
        rapid = rating_int(elem.findtext('rapid_rating'))
        blitz = rating_int(elem.findtext('blitz_rating'))
        if max(std, rapid, blitz) < min_rating:
            elem.clear()
            continue

        try:
            fide_id = int(elem.findtext('fideid', '').strip() or 0)
        except ValueError:
            fide_id = 0
        if fide_id <= 0:
            elem.clear()
            continue

        name = (elem.findtext('name') or '').strip()
        country = (elem.findtext('country') or '').strip().upper()
        sex = (elem.findtext('sex') or '').strip().upper()
        title = pick_title(elem.findtext('title'), elem.findtext('w_title'))
        born_raw = (elem.findtext('birthday') or '').strip()
        try:
            born = int(born_raw) if born_raw else None
        except ValueError:
            born = None
        flag = (elem.findtext('flag') or '').strip().lower()
        active = 'i' not in flag

        kept.append({
            'id': fide_id,
            'name': name,
            'country': country,
            'sex': sex,
            'title': title,
            'std': std,
            'rapid': rapid,
            'blitz': blitz,
            'born': born,
            'active': active,
        })
        elem.clear()

        if scanned % 500_000 == 0:
            print(f'  ...scanned {scanned:,}, kept {len(kept):,}', flush=True)

    kept.sort(key=lambda p: (-max(p['std'], p['rapid'], p['blitz']), p['name'].lower()))

    # Match the monthly stem to a period label for the meta sidecar.
    period_match = SOURCE_STEM.fullmatch(xml_path.name)
    period = period_match.group(1) if period_match else xml_path.stem

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(kept, ensure_ascii=False, separators=(',', ':')) + '\n',
                        encoding='utf-8', newline='\n')
    meta_path.write_text(json.dumps({
        'source': xml_path.name,
        'period': period,
        'generated': datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        'count': len(kept),
        'min_rating': min_rating,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')

    print(f'Scanned {scanned:,} players; kept {len(kept):,} at >= {min_rating}.')
    print(f'Wrote {out_path.relative_to(ROOT)} ({out_path.stat().st_size / 1_000_000:.2f} MB)')
    print(f'Wrote {meta_path.relative_to(ROOT)}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('xml', type=Path, help='FIDE players_list XML file')
    parser.add_argument('--min', type=int, default=2500,
                        help='Minimum rating in any format (default: 2500)')
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT,
                        help=f'Output JSON path (default: {DEFAULT_OUT.relative_to(ROOT)})')
    parser.add_argument('--meta', type=Path, default=DEFAULT_META,
                        help=f'Meta JSON path (default: {DEFAULT_META.relative_to(ROOT)})')
    args = parser.parse_args()
    build(args.xml, args.min, args.out, args.meta)


if __name__ == '__main__':
    main()
