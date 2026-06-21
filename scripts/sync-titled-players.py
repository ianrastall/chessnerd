"""
Sync Chess.com titled player data to public/data/titled-players.json.

Run from repo root:
    python scripts/sync-titled-players.py

Environment variables:
    MAX_RUN_SECONDS  Stop gracefully after this many seconds (0 = unlimited).
                     Set to ~18000 in CI to stay within the 6-hour job limit.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
TITLES = ["GM", "WGM", "IM", "WIM", "FM", "WFM", "NM", "WNM", "CM", "WCM"]
TITLE_PRIORITY = ["GM", "IM", "FM", "NM", "CM", "WGM", "WIM", "WFM", "WCM", "WNM"]
TITLE_RANK = {title: i for i, title in enumerate(TITLE_PRIORITY)}
OUTPUT_FILE = Path("public/data/titled-players.json")
USER_AGENT = "chessnerd-titled-players-sync/1.6 (contact: moving.form.of.dust@gmail.com)"
REQUEST_TIMEOUT = 10
STALE_AFTER_DAYS = 30
PROGRESS_SAVE_EVERY = 50
ACTIVE_STATUSES = {"basic", "premium", "staff", "gold", "platinum", "diamond"}
MAX_RUN_SECONDS = int(os.environ.get("MAX_RUN_SECONDS", "0")) or None

# --- SESSION SETUP ---
session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})
adapter = HTTPAdapter(max_retries=Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[500, 502, 503, 504],
))
session.mount("https://", adapter)
session.mount("http://", adapter)


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_request(url):
    """Fetch URL synchronously; handle 429 by sleeping Retry-After seconds."""
    while True:
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "10"))
                print(f"  [!] Rate limit (429). Pausing {retry_after}s...")
                time.sleep(retry_after)
                continue
            if 500 <= resp.status_code < 600:
                print(f"  [!] Server error {resp.status_code}. Retrying in 5s...")
                time.sleep(5)
                continue
            return None
        except requests.exceptions.RequestException as e:
            print(f"  [!] Network error: {e}. Retrying in 5s...")
            time.sleep(5)
            continue


def get_player_data(username, title):
    data = {
        "username": username,
        "title": title,
        "name": "",
        "avatar": "",
        "country": "??",
        "rapid": 0,
        "blitz": 0,
        "bullet": 0,
        "status": "inactive",
        "updated_at": utc_now_iso(),
        "fetch_ok": False,
    }

    stats = safe_request(f"https://api.chess.com/pub/player/{username}/stats")
    profile = safe_request(f"https://api.chess.com/pub/player/{username}")

    if stats:
        def get_rating(key):
            return stats.get(key, {}).get("last", {}).get("rating", 0)
        data["rapid"] = get_rating("chess_rapid")
        data["blitz"] = get_rating("chess_blitz")
        data["bullet"] = get_rating("chess_bullet")

    if profile:
        data["name"] = profile.get("name", "") or ""
        data["avatar"] = profile.get("avatar", "") or ""
        url_parts = (profile.get("country", "") or "").split("/")
        data["country"] = url_parts[-1].upper() if url_parts else "??"
        data["status"] = "active" if profile.get("status") in ACTIVE_STATUSES else "inactive"

    data["fetch_ok"] = bool(stats or profile)
    return data


def sort_key(player):
    return (TITLE_RANK.get(player["title"], 99), player["username"].lower())


def save_db(players):
    """Atomic write."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUTPUT_FILE)


def main():
    run_start = time.monotonic()

    # 1. Load existing
    existing = {}
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
            # Handle both flat list and legacy {"players": [...]} wrapper
            player_list = raw if isinstance(raw, list) else raw.get("players", [])
            existing = {p["username"]: p for p in player_list}
            print(f"Loaded {len(existing):,} existing players.")
        except Exception as e:
            print(f"Could not load existing data ({e}). Starting fresh.")

    # 2. Fetch master title lists
    print("Phase 1: Fetching master lists...")
    username_to_title: dict[str, str] = {}
    for title in TITLES:
        print(f"  Fetching {title}...")
        resp = safe_request(f"https://api.chess.com/pub/titled/{title}")
        if resp and "players" in resp:
            for u in resp["players"]:
                if u in username_to_title:
                    if TITLE_RANK.get(title, 99) < TITLE_RANK.get(username_to_title[u], 99):
                        username_to_title[u] = title
                else:
                    username_to_title[u] = title

    print(f"  Found {len(username_to_title):,} titled players in total.")

    # 3. Identify stale / new players
    now = datetime.now(timezone.utc)
    to_refresh: list[str] = []
    for u in sorted(username_to_title):
        record = existing.get(u)
        if record:
            record["title"] = username_to_title[u]  # keep title current
        if not record:
            to_refresh.append(u)
            continue
        is_stale = False
        if not record.get("updated_at"):
            is_stale = True
        else:
            try:
                dt = datetime.fromisoformat(record["updated_at"].replace("Z", "+00:00"))
                if (now - dt).days >= STALE_AFTER_DAYS:
                    is_stale = True
            except ValueError:
                is_stale = True
        is_incomplete = (
            not record.get("fetch_ok")
            or record.get("country") in ["??", None]
            or (record["rapid"] == 0 and record["blitz"] == 0 and not record["name"])
        )
        if is_stale or is_incomplete:
            to_refresh.append(u)

    print(f"Phase 2: Syncing {len(to_refresh):,} players...")

    # 4. Sync serially with optional time cap
    count = 0
    stopped_early = False
    try:
        for u in to_refresh:
            if MAX_RUN_SECONDS:
                elapsed = time.monotonic() - run_start
                if elapsed >= MAX_RUN_SECONDS:
                    print(f"[!] Time limit ({MAX_RUN_SECONDS}s) reached after {count} players. Saving and stopping.")
                    stopped_early = True
                    break

            new_data = get_player_data(u, username_to_title[u])
            if not new_data["fetch_ok"] and u in existing:
                existing[u]["updated_at"] = utc_now_iso()
            else:
                existing[u] = new_data

            count += 1
            if count % 10 == 0:
                print(f"  {count}/{len(to_refresh)}: {u} ({new_data['title']})")
            if count % PROGRESS_SAVE_EVERY == 0:
                save_db(sorted(existing.values(), key=sort_key))

    except KeyboardInterrupt:
        print("\n[!] Interrupted. Saving progress...")
        stopped_early = True

    # 5. Final save
    final_list = sorted(existing.values(), key=sort_key)
    save_db(final_list)
    remaining = len(to_refresh) - count
    print(f"Done. {len(final_list):,} players saved. {count} refreshed this run.", end="")
    if stopped_early and remaining > 0:
        print(f" ({remaining} will be picked up on the next run.)", end="")
    print()


if __name__ == "__main__":
    main()
