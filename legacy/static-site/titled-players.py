import json
import os
import time
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
TITLES = ["GM", "WGM", "IM", "WIM", "FM", "WFM", "NM", "WNM", "CM", "WCM"]
TITLE_PRIORITY = ["GM", "IM", "FM", "NM", "CM", "WGM", "WIM", "WFM", "WCM", "WNM"]
TITLE_RANK = {title: index for index, title in enumerate(TITLE_PRIORITY)}
OUTPUT_FILE = Path("titled-players.json")
USER_AGENT = "chessnerd-titled-players-sync/1.5 (contact: moving.form.of.dust@gmail.com)"
REQUEST_TIMEOUT = 10
STALE_AFTER_DAYS = 7
PROGRESS_SAVE_EVERY = 50
ACTIVE_STATUSES = {"basic", "premium", "staff", "gold", "platinum", "diamond"}

# --- SESSION SETUP ---
# We use a session for connection pooling (keep-alive), but NO parallel requests.
session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})

# Retry strategy for standard server errors (5xx), NOT for rate limits (429)
adapter = HTTPAdapter(max_retries=Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[500, 502, 503, 504]
))
session.mount("https://", adapter)
session.mount("http://", adapter)


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_request(url):
    """
    Fetch URL synchronously.
    Handles 429 by sleeping exactly as requested by the server.
    """
    while True:
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT)
            
            if resp.status_code == 200:
                return resp.json()
            
            if resp.status_code == 429:
                # Respect the server's "Retry-After" header explicitly
                retry_after = int(resp.headers.get("Retry-After", "10"))
                print(f"  [!] Rate limit (429). Pausing for {retry_after}s...")
                time.sleep(retry_after)
                continue  # Retry the same request
                
            if 500 <= resp.status_code < 600:
                print(f"  [!] Server error {resp.status_code}. Retrying in 5s...")
                time.sleep(5)
                continue
                
            # For 404s or other 4xx, return None so we can skip
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

    # 1. Fetch Stats
    stats = safe_request(f"https://api.chess.com/pub/player/{username}/stats")
    
    # 2. Fetch Profile
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


def save_db(players):
    """Atomic save."""
    tmp_path = OUTPUT_FILE.with_name(f"{OUTPUT_FILE.name}.tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp_path, OUTPUT_FILE)


def main():
    # 1. Load Existing
    existing = {}
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing = {p["username"]: p for p in data.get("players", [])}
            print(f"Loaded {len(existing):,} existing players.")
        except Exception as e:
            print(f"Could not load DB ({e}). Starting fresh.")

    # 2. Fetch Current Titles (The only part that loops over titles)
    print("Phase 1: Fetching master lists...")
    username_to_title = {}
    for title in TITLES:
        print(f"  Fetching {title}...")
        resp = safe_request(f"https://api.chess.com/pub/titled/{title}")
        if resp and "players" in resp:
            for u in resp["players"]:
                # Priority check
                if u in username_to_title:
                    old_rank = TITLE_RANK.get(username_to_title[u], 99)
                    new_rank = TITLE_RANK.get(title, 99)
                    if new_rank < old_rank:
                        username_to_title[u] = title
                else:
                    username_to_title[u] = title
    
    current_usernames = set(username_to_title.keys())
    print(f"  Found {len(current_usernames):,} titled players total.")

    # 3. Identify Work
    to_refresh = []
    now = datetime.now(timezone.utc)
    
    for u in sorted(current_usernames):
        record = existing.get(u)
        
        # Criteria for refresh: New, Incomplete, or Stale
        if not record:
            to_refresh.append(u)
        else:
            # Update title in memory immediately
            record["title"] = username_to_title[u]
            
            # Check staleness
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
            
            # Check completeness
            is_incomplete = (
                not record.get("fetch_ok") or 
                record.get("country") in ["??", None] or
                (record["rapid"] == 0 and record["blitz"] == 0 and not record["name"])
            )

            if is_stale or is_incomplete:
                to_refresh.append(u)

    # 4. Main Loop (SERIAL)
    print(f"Phase 2: Syncing {len(to_refresh):,} players sequentially...")
    
    count = 0
    try:
        for u in to_refresh:
            # The Magic: Simple, blocking, sequential call.
            # This satisfies "one server call at a time".
            new_data = get_player_data(u, username_to_title[u])
            
            # If the fetch failed, keep old data but mark as tried
            if not new_data["fetch_ok"] and u in existing:
                 existing[u]["updated_at"] = utc_now_iso()
            else:
                existing[u] = new_data
            
            count += 1
            if count % 10 == 0:
                print(f"  Synced {count}/{len(to_refresh)}: {u} ({new_data['title']})")
            
            if count % PROGRESS_SAVE_EVERY == 0:
                save_db(sorted(existing.values(), key=lambda x: (TITLE_RANK.get(x["title"], 99), x["username"])))
                
    except KeyboardInterrupt:
        print("\n[!] Stopped by user. Saving progress...")
    
    # Final Save
    final_list = sorted(existing.values(), key=lambda x: (TITLE_RANK.get(x["title"], 99), x["username"]))
    save_db(final_list)
    print(f"Done. Database contains {len(final_list):,} players.")

if __name__ == "__main__":
    main()