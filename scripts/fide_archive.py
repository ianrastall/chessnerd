#!/usr/bin/env python3
"""Mirror FIDE rating-list files (ratings.fide.com and Olimpbase) to disk.

Three steps, each safe to re-run:

    python scripts/fide_archive.py discover    # probe the sources, write the plan
    python scripts/fide_archive.py fetch       # download what the plan lists
    python scripts/fide_archive.py manifest    # verify files, write the manifests

Files land in the store (default D:\\fide-archive) keeping the sources' own
filenames:

    fide/<YYYY-MM>/<original name>.zip       e.g. fide/2026-09/standard_sep26frl_xml.zip
    olimpbase/data/<original name>           raw lists 1971-2009 (TXT, DBF, MDB, ZIP)
    olimpbase/lists/Elo<YYYYMM><x>.html      the HTML list pages plus summary.html

`manifest` writes <store>/manifest.json and copies it to
public/data/fide-archive/manifest.json for the site. Every entry carries the
SHA-256 and size of the file as downloaded, the URL it came from, and the path
it will have in the public copy (Internet Archive item, see ITEM below).

FIDE publishes six variants per month: standard / rapid / blitz, each as a TXT
zip and an XML zip. Before 2012 only the combined-era `monYYfrl.zip` text file
exists. Probing HEADs each candidate name for every month since January 2001.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STORE = Path(r'D:\fide-archive')
SITE_MANIFEST = ROOT / 'public' / 'data' / 'fide-archive' / 'manifest.json'

FIDE_BASE = 'https://ratings.fide.com/download/'
OLIMP_BASE = 'https://www.olimpbase.org/Elo/'
ITEM = 'fide-rating-lists-archive'  # Internet Archive item identifier
ITEM_BASE = f'https://archive.org/download/{ITEM}/'
UA = 'ChessNerd-FIDE-Archive/1.0 (+https://chessnerd.net/fide-archive.html)'
MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
FIRST_YEAR = 2001


def request(url: str, method: str = 'GET', timeout: int = 60):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=timeout)


def retry(fn, tries: int = 4):
    for attempt in range(tries):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            if e.code in (404, 403, 410):
                raise
            err = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            err = e
        time.sleep(2 ** attempt)
    raise err


def head(url: str) -> dict | None:
    """Return {bytes, modified} for a real file, None for a miss (FIDE's 404 page is HTML)."""
    try:
        with retry(lambda: request(url, 'HEAD')) as r:
            kind = r.headers.get('Content-Type', '')
            size = int(r.headers.get('Content-Length') or 0)
            if 'html' in kind.lower() and url.endswith(('.zip', '.TXT', '.txt')):
                return None
            return {'bytes': size, 'modified': r.headers.get('Last-Modified', '')}
    except urllib.error.HTTPError:
        return None


# ── discovery ────────────────────────────────────────────────────────────────

def fide_candidates(today: datetime):
    """Yield (period, list, format, filename) for every name FIDE might use."""
    y, m = FIRST_YEAR, 1
    while (y, m) <= (today.year, today.month):
        tag = f'{MONTHS[m - 1]}{y % 100:02d}frl'
        period = f'{y}-{m:02d}'
        yield period, 'combined', 'txt', f'{tag}.zip'  # pre-2012 naming
        for lst in ('standard', 'rapid', 'blitz'):
            yield period, lst, 'txt', f'{lst}_{tag}.zip'
            yield period, lst, 'xml', f'{lst}_{tag}_xml.zip'
        m += 1
        if m == 13:
            y, m = y + 1, 1


FIDE_CURRENT = [
    ('combined', 'txt', 'players_list.zip'),
    ('combined', 'xml', 'players_list_xml.zip'),
    ('combined-legacy', 'txt', 'players_list_legacy.zip'),
    ('combined-legacy', 'xml', 'players_list_xml_legacy.zip'),
    ('combined', 'txt', 'players_list_foa.zip'),
    ('combined', 'xml', 'players_list_xml_foa.zip'),
]


def discover_fide(today: datetime, workers: int) -> list[dict]:
    cands = list(fide_candidates(today))
    found: list[dict] = []

    def probe(c):
        period, lst, fmt, name = c
        info = head(FIDE_BASE + name)
        if info:
            return {'source': 'fide', 'period': period, 'list': lst, 'format': fmt, 'name': name,
                    'url': FIDE_BASE + name, 'path': f'fide/{period}/{name}', **info}

    with cf.ThreadPoolExecutor(workers) as ex:
        for res in ex.map(probe, cands):
            if res:
                found.append(res)
    # The rolling "current" files are the latest month's snapshot under another name.
    period = f'{today.year}-{today.month:02d}'
    for lst, fmt, name in FIDE_CURRENT:
        info = head(FIDE_BASE + name)
        if info:
            found.append({'source': 'fide', 'period': period, 'list': lst, 'format': fmt, 'name': name,
                          'url': FIDE_BASE + name, 'path': f'fide/{period}/{name}', 'snapshot': True, **info})
    return found


def listing(url: str) -> list[tuple[str, int]]:
    """Parse an Apache index page into (name, bytes) for files only."""
    with retry(lambda: request(url)) as r:
        text = r.read().decode('latin1')
    out = []
    for m in re.finditer(r'href="([^"?/][^"]*)">[^<]*</a>\s+\S+ \S+\s+([\d.]+)([KMG]?)', text):
        mult = {'': 1, 'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3}[m.group(3)]
        out.append((m.group(1), int(float(m.group(2)) * mult)))
    return out


def discover_olimpbase() -> list[dict]:
    found = []
    for name, approx in listing(OLIMP_BASE + 'data/'):
        found.append({'source': 'olimpbase', 'period': olimp_period(name), 'list': 'historical',
                      'format': Path(name).suffix.lstrip('.').lower() or 'txt', 'name': name,
                      'url': OLIMP_BASE + 'data/' + name, 'path': f'olimpbase/data/{name}', 'bytes': 0,
                      'approx_bytes': approx})
    for name, approx in listing(OLIMP_BASE):
        if re.fullmatch(r'Elo\d{6}[a-z]\.html', name) or name == 'summary.html':
            found.append({'source': 'olimpbase', 'period': olimp_period(name), 'list': 'html',
                          'format': 'html', 'name': name, 'url': OLIMP_BASE + name,
                          'path': f'olimpbase/lists/{name}', 'bytes': 0, 'approx_bytes': approx})
    return found


def olimp_period(name: str) -> str:
    """Best-effort YYYY-MM (or YYYY) from an Olimpbase filename; '' if none."""
    months = {m: i + 1 for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july',
                                              'august', 'september', 'october', 'november', 'december'])}
    for pat, fn in (
        (r'^(\d{4})-(\d{2})\.', lambda m: f'{m[1]}-{m[2]}'),
        (r'^(\d{4})(January|February|March|April|May|June|July|August|September|October|November|December)RL',
         lambda m: f'{m[1]}-{months[m[2].lower()]:02d}'),
        (r'^Elo(\d{4})(\d{2})[a-z]\.html$', lambda m: f'{m[1]}-{m[2]}' if m[2] != '00' else m[1]),
        (r'^(?:APR|JUL|OCT|JAN)(\d{2})FRL\.TXT$', None),
        (r'^(\d{4})\.txt$', lambda m: m[1]),
        (r'^Elo(\d{4})\.', lambda m: m[1]),
    ):
        m = re.match(pat, name, re.I)
        if m and fn:
            return fn(m)
        if m and fn is None:
            mon = {'JAN': 1, 'APR': 4, 'JUL': 7, 'OCT': 10}[name[:3].upper()]
            return f'{2000 + int(m[1]):04d}-{mon:02d}'
    return ''


# ── fetch ────────────────────────────────────────────────────────────────────

def download(entry: dict, store: Path) -> str:
    dest = store / entry['path']
    if dest.exists() and entry.get('bytes') and dest.stat().st_size == entry['bytes']:
        return 'have'
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + '.part')

    def go():
        with request(entry['url'], timeout=120) as r, open(tmp, 'wb') as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)

    retry(go)
    tmp.replace(dest)
    return 'got'


def cmd_discover(a):
    store = Path(a.store)
    store.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc)
    plan = discover_fide(today, a.workers) + discover_olimpbase()
    plan.sort(key=lambda e: (e['source'], e['period'], e['list'], e['format'], e['name']))
    (store / 'plan.json').write_text(json.dumps(plan, indent=1), encoding='utf-8')
    n_f = sum(1 for e in plan if e['source'] == 'fide')
    est = sum(e.get('bytes') or e.get('approx_bytes') or 0 for e in plan)
    print(f'plan: {n_f} FIDE files, {len(plan) - n_f} Olimpbase files, about {est / 1e9:.2f} GB -> {store / "plan.json"}')


def cmd_fetch(a):
    store = Path(a.store)
    plan = json.loads((store / 'plan.json').read_text(encoding='utf-8'))
    todo = [e for e in plan if (a.source in (None, e['source']))]
    done = failed = 0
    with cf.ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(download, e, store): e for e in todo}
        for i, fut in enumerate(cf.as_completed(futs), 1):
            e = futs[fut]
            try:
                state = fut.result()
                done += state == 'got'
            except Exception as err:  # keep going; report at the end
                failed += 1
                print(f'FAILED {e["url"]}: {err}', file=sys.stderr)
            if i % 50 == 0:
                print(f'{i}/{len(todo)}', flush=True)
    print(f'downloaded {done}, failed {failed}, total in plan {len(todo)}')
    if failed:
        sys.exit(1)


# ── manifest ─────────────────────────────────────────────────────────────────

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def inspect(path: Path) -> dict:
    """Facts about a downloaded file; zip members for zips, a hard failure for broken zips."""
    info: dict = {}
    if path.suffix.lower() == '.zip':
        with zipfile.ZipFile(path) as z:
            bad = z.testzip()
            if bad:
                raise zipfile.BadZipFile(f'{path.name}: corrupt member {bad}')
            info['members'] = [m.filename for m in z.infolist()]
            info['uncompressed'] = sum(m.file_size for m in z.infolist())
    return info


def cmd_manifest(a):
    store = Path(a.store)
    plan = json.loads((store / 'plan.json').read_text(encoding='utf-8'))
    old = {}
    mf = store / 'manifest.json'
    if mf.exists():
        old = {e['path']: e for e in json.loads(mf.read_text(encoding='utf-8'))['files']}
    files, missing = [], []
    for e in plan:
        p = store / e['path']
        if not p.exists():
            missing.append(e['path'])
            continue
        size = p.stat().st_size
        prev = old.get(e['path'])
        if prev and prev['bytes'] == size and prev.get('sha256'):
            files.append(prev)  # unchanged, skip re-hashing
            continue
        row = {k: e[k] for k in ('source', 'period', 'list', 'format', 'name', 'path', 'url')}
        if e.get('snapshot'):
            row['snapshot'] = True
        row.update(bytes=size, sha256=sha256(p), **inspect(p))
        row['archiveUrl'] = ITEM_BASE + e['path']
        row['fetched'] = datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).strftime('%Y-%m-%d')
        files.append(row)
    if missing:
        print(f'{len(missing)} planned files are not on disk yet (e.g. {missing[0]}); they are left out', file=sys.stderr)
    doc = {
        'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'item': ITEM,
        'itemUrl': f'https://archive.org/details/{ITEM}',
        'files': files,
    }
    text = json.dumps(doc, indent=1)
    mf.write_text(text, encoding='utf-8')
    SITE_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    SITE_MANIFEST.write_text(text, encoding='utf-8')
    total = sum(f['bytes'] for f in files)
    print(f'{len(files)} files, {total / 1e9:.2f} GB -> {mf} and {SITE_MANIFEST}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--store', default=str(DEFAULT_STORE), help='archive folder (default %(default)s)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('discover'); d.add_argument('--workers', type=int, default=8); d.set_defaults(fn=cmd_discover)
    f = sub.add_parser('fetch'); f.add_argument('--workers', type=int, default=3)
    f.add_argument('--source', choices=['fide', 'olimpbase']); f.set_defaults(fn=cmd_fetch)
    m = sub.add_parser('manifest'); m.set_defaults(fn=cmd_manifest)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
