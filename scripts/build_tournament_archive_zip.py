"""Build a PgnTours-style ZIP (PGN + crosstable HTML) from a CTML file.

Usage:
    python build_tournament_archive_zip.py <ctml-path> [--out <zip-path>]

The output ZIP contains:
    <base>.pgn        SAN-notation PGN, one entry per <game> that carries
                      movetext; result-only and forfeit games are skipped
                      (the manifest 'games' count matches this).
    <base>.html       Dark-themed crosstable page in the existing Chess Nerd
                      Tournament Archive style: metadata, standings table,
                      and a games section grouped by @round.

The script's default output layout matches the archive convention:
    D:\\dev\\proj\\chessnerd\\PgnTours\\<decade>s\\<base>.zip
where <base> is the CTML filename with any underscore replaced by a hyphen,
and <decade> is the two-digit decade of the start year (e.g. 1870, 2020).
"""
from __future__ import annotations

import argparse
import html
import io
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from collections import defaultdict

import chess
import chess.pgn

NS = "urn:ctml:2.0"

def q(local: str) -> str: return f"{{{NS}}}{local}"


def child_text(el, local, default=""):
    c = el.find(q(local))
    return (c.text or default).strip() if c is not None else default


def read_ctml(path: Path):
    tree = ET.parse(path)
    root = tree.getroot()
    header = root.find(q("header"))
    participants_el = root.find(q("participants"))
    games_el = root.find(q("games"))
    if header is None or games_el is None:
        raise ValueError("CTML missing header/games")

    name = child_text(header, "name")
    event_type_els = header.findall(q("eventType"))
    event_type = ", ".join((el.text or "").strip() for el in event_type_els if el.text)
    cadence = child_text(header, "cadence")
    federation = child_text(header, "federation")
    dates = header.find(q("dates"))
    start_iso = ""
    end_iso = ""
    if dates is not None:
        s = dates.find(q("start"))
        e = dates.find(q("end"))
        if s is not None:
            d = s.find(q("day"))
            if d is not None:
                start_iso = d.get("iso") or ""
        if e is not None:
            d = e.find(q("day"))
            if d is not None:
                end_iso = d.get("iso") or ""

    place_ref = header.find(q("placeRef"))
    place_city = child_text(place_ref, "city") if place_ref is not None else ""
    place_country = child_text(place_ref, "country") if place_ref is not None else ""

    # Participants
    parts = []
    if participants_el is not None:
        for p in participants_el.findall(q("participant")):
            pid = p.get("id", "")
            ref = p.find(q("playerRef"))
            display = ""
            title = ""
            fed = ""
            if ref is not None:
                nm = ref.find(q("name"))
                if nm is not None:
                    display = (nm.get("display") or (nm.text or "")).strip()
                t_els = ref.findall(q("title"))
                title = ",".join((t.text or "").strip() for t in t_els if t.text)
                fed = child_text(ref, "federation")
            # Rating snapshot (first one, prefer standard)
            rating = ""
            for r in p.findall(q("ratingSnapshot")):
                v = r.find(q("value"))
                if v is not None and v.text and v.text.strip():
                    rating = v.text.strip()
                    if r.get("scope", "standard") == "standard":
                        break
            score = child_text(p, "score")
            placement = child_text(p, "placement")
            parts.append({
                "id": pid, "display": display, "title": title, "fed": fed,
                "rating": rating, "score": score, "placement": placement,
            })

    id_to_display = {p["id"]: p["display"] for p in parts}

    # Games
    game_list = []
    for g in games_el.findall(q("game")):
        gid = g.get("id", "")
        rnd = g.get("round", "?")
        white_id = g.get("white", "")
        black_id = g.get("black", "")
        result = g.get("result", "*")
        eco = child_text(g, "eco")
        termination = child_text(g, "termination")
        moves_el = g.find(q("moves"))
        moves_uci = []
        if moves_el is not None:
            notation = moves_el.get("notation", "uci")
            for m in moves_el.findall(q("move")):
                if notation != "uci":
                    raise ValueError(f"Non-UCI notation in {gid}: {notation}")
                moves_uci.append(m.get("value", ""))
        game_list.append({
            "id": gid, "round": rnd,
            "white": id_to_display.get(white_id, white_id),
            "black": id_to_display.get(black_id, black_id),
            "result": result, "eco": eco, "termination": termination,
            "moves_uci": moves_uci,
        })

    return {
        "name": name, "eventType": event_type, "cadence": cadence,
        "federation": federation, "start": start_iso, "end": end_iso,
        "city": place_city, "country": place_country,
        "participants": parts, "games": game_list,
    }


def uci_to_san_pgn_body(uci_moves):
    """Return a SAN-notated body string for the given UCI ply list.

    Wraps at 79 chars, matching a typical PGN line width.
    """
    board = chess.Board()
    tokens = []
    for i, u in enumerate(uci_moves):
        move = chess.Move.from_uci(u)
        if i % 2 == 0:
            tokens.append(f"{i // 2 + 1}.")
        tokens.append(board.san(move))
        board.push(move)
    # Wrap at 79 chars
    line = ""
    out_lines = []
    for tok in tokens:
        if line and len(line) + 1 + len(tok) > 79:
            out_lines.append(line)
            line = tok
        else:
            line = tok if not line else line + " " + tok
    if line:
        out_lines.append(line)
    return "\n".join(out_lines)


def emit_pgn(event, tour_data, base_name) -> str:
    """Produce a PGN of every game with movetext, in the CTML's own game order."""
    site = " ".join(x for x in (tour_data["city"], tour_data["country"]) if x).strip()
    start = tour_data["start"]  # 1871-12-05
    event_date_pgn = start.replace("-", ".") if start else "????.??.??"
    entries = []
    for g in tour_data["games"]:
        if not g["moves_uci"]:
            continue  # skip result-only and forfeit games
        headers = {
            "Event": event,
            "Site": site,
            "Date": event_date_pgn,
            "Round": g["round"] or "?",
            "White": g["white"],
            "Black": g["black"],
            "Result": g["result"],
        }
        if g["eco"]:
            headers["ECO"] = g["eco"]
        headers["EventDate"] = event_date_pgn
        headers["PlyCount"] = str(len(g["moves_uci"]))
        if g["termination"]:
            headers["Termination"] = g["termination"]
        header_lines = "\n".join(f'[{k} "{v}"]' for k, v in headers.items())
        body = uci_to_san_pgn_body(g["moves_uci"])
        # Append the result on the last line of the body (standard PGN)
        if body:
            body = body + f" {g['result']}"
        else:
            body = g["result"]
        entries.append(header_lines + "\n\n" + body + "\n")
    return "\n".join(entries)


def html_escape(s):
    return html.escape(s or "", quote=True)


def group_games(games):
    """Group games by round for the crosstable HTML.

    If every game's round is "?" (round unknown, as in our historical
    round-robins), return a single ("All games", games) group.
    """
    if all(g["round"] in ("", "?") for g in games):
        return [("All games", games)]
    groups = defaultdict(list)
    for g in games:
        groups[g["round"] or "?"].append(g)
    def sort_key(r):
        # Numeric-first sort so "R1" < "R2" < "R10" and "1.1" < "1.2" < "2.1"
        parts = re.split(r"(\d+)", r)
        return tuple(int(x) if x.isdigit() else x for x in parts)
    return [(r, groups[r]) for r in sorted(groups, key=sort_key)]


CROSSTABLE_STYLE = """
    :root {
        --bg-color: #1e1e1e;
        --card-bg: #252525;
        --text-main: #e0e0e0;
        --text-muted: #a0a0a0;
        --border: #333;
        --highlight: #007acc;
    }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: var(--bg-color); color: var(--text-main); padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1, h2 { color: var(--highlight); }
    h2 { border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-top: 40px; }
    p.meta { color: var(--text-muted); margin: 0.25rem 0; }
    table { width: 100%; border-collapse: collapse; background: var(--card-bg); margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #333; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; }
    tr:hover { background: #2a2a2a; }
    .score-cell { font-weight: bold; color: var(--highlight); }
    .round-header { background: #383838; font-weight: bold; color: #fff; padding: 8px 15px; margin-top: 20px; border-radius: 4px; }
    .game-row { display: flex; justify-content: space-between; padding: 10px; background: var(--card-bg); border-bottom: 1px solid var(--border); align-items: center; }
    .game-row:last-child { border-bottom: none; }
    .game-white, .game-black { flex: 1; font-weight: 500; }
    .game-result { flex: 0 0 80px; text-align: center; font-weight: bold; background: #333; padding: 4px; border-radius: 4px; font-size: 0.9em; }
    .game-eco { flex: 0 0 60px; text-align: right; color: var(--text-muted); font-size: 0.8em; }
    """


def emit_html(tour_data) -> str:
    name = tour_data["name"]
    start = tour_data["start"]
    end = tour_data["end"]
    meta_line1 = f"{start} \u2013 {end}" if start and end else (start or end)
    meta_bits = [x for x in (tour_data["city"], tour_data["country"], tour_data["federation"]) if x]
    meta_line2 = " \u00b7 ".join(meta_bits)

    # Standings
    standing_rows = []
    for p in tour_data["participants"]:
        standing_rows.append(
            "<tr>"
            f"<td>{html_escape(p['placement'])}</td>"
            f"<td>{html_escape(p['display'])}</td>"
            f"<td>{html_escape(p['title'])}</td>"
            f"<td>{html_escape(p['fed'])}</td>"
            f"<td>{html_escape(p['rating'])}</td>"
            f"<td class=\"score-cell\">{html_escape(p['score'])}</td>"
            "</tr>"
        )

    # Games grouped by round
    game_html_parts = []
    for round_label, games in group_games(tour_data["games"]):
        game_html_parts.append(
            f'<div class="round-header">Round {html_escape(round_label)}</div>'
            if round_label not in ("All games",)
            else f'<div class="round-header">{html_escape(round_label)}</div>'
        )
        for g in games:
            result = g["result"]
            if g["termination"] == "forfeit":
                result = result + " (F)" if result != "*" else "(F)"
            eco = g["eco"] if g["eco"] else ""
            game_html_parts.append(
                '<div class="game-row">'
                f'<div class="game-white">{html_escape(g["white"])}</div>'
                f'<div class="game-result">{html_escape(result)}</div>'
                f'<div class="game-black">{html_escape(g["black"])}</div>'
                f'<div class="game-eco">{html_escape(eco)}</div>'
                '</div>'
            )

    doc = (
        "<!DOCTYPE html>\n"
        f'<html lang="en"><head><meta charset="UTF-8"><title>{html_escape(name)}</title><style>'
        f"{CROSSTABLE_STYLE}</style></head><body>"
        f"<h1>{html_escape(name)}</h1>"
        f'<p class="meta">{html_escape(meta_line1)}</p>'
        + (f'<p class="meta">{html_escape(meta_line2)}</p>' if meta_line2 else "")
        + '<h2>Standings</h2><table><thead><tr>'
        '<th>#</th><th>Player</th><th>Title</th><th>Fed</th><th>Rating</th><th>Score</th>'
        '</tr></thead><tbody>'
        + "".join(standing_rows)
        + "</tbody></table>"
        + "<h2>Games</h2>"
        + "".join(game_html_parts)
        + "</body></html>"
    )
    return doc


def decade_folder(start_iso: str) -> str:
    year = int(start_iso[:4])
    return f"{(year // 10) * 10}s"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ctml", type=Path, help="Path to CTML file")
    ap.add_argument("--pgn-tours-root", type=Path,
                    default=Path(r"D:\dev\proj\chessnerd\PgnTours"),
                    help="Root of the PgnTours checkout")
    ap.add_argument("--out", type=Path, help="Override output ZIP path")
    args = ap.parse_args()

    data = read_ctml(args.ctml)
    # base name mirrors the CTML filename with underscore -> hyphen and no ext
    base = args.ctml.stem.replace("_", "-")
    pgn_name = f"{base}.pgn"
    html_name = f"{base}.html"

    pgn_body = emit_pgn(data["name"], data, base)
    html_body = emit_html(data)

    if args.out:
        out_zip = args.out
    else:
        dec = decade_folder(data["start"])
        out_zip = args.pgn_tours_root / dec / f"{base}.zip"
    out_zip.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(pgn_name, pgn_body.encode("utf-8"))
        zf.writestr(html_name, html_body.encode("utf-8"))

    # Count games written to PGN
    games_with_moves = sum(1 for g in data["games"] if g["moves_uci"])
    print(f"wrote {out_zip}")
    print(f"  pgn_games={games_with_moves}")
    print(f"  bytes={out_zip.stat().st_size}")


if __name__ == "__main__":
    main()
