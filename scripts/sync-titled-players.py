"""Daily Chess.com snapshot; failed runs keep public data and save checkpoints.

All ten title lists and required player requests must succeed before publication.
Ratings are fetched once per UTC day, profiles weekly. MAX_RUN_SECONDS bounds
the whole run, including request retries and backoff.
"""
import json
import os
from pathlib import Path
import re
import time
from datetime import datetime, timezone, timedelta

import requests

TITLES = ['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM', 'NM', 'WNM', 'CM', 'WCM']
TITLE_PRIORITY = ['GM', 'IM', 'FM', 'NM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM', 'WNM']
TITLE_RANK = {title: i for i, title in enumerate(TITLE_PRIORITY)}
OUTPUT_FILE = Path('public/data/titled-players.json')
META_FILE = Path('public/data/titled-players.meta.json')
CHECKPOINT_FILE = Path('.cache/titled-players.json')
MAX_RUN_SECONDS = int(os.environ.get('MAX_RUN_SECONDS', '18000'))
MAX_REMOVED_SHARE = 0.1
ACTIVE_STATUSES = {'basic', 'premium', 'staff', 'gold', 'platinum', 'diamond', 'mod'}
session = requests.Session()
session.headers['User-Agent'] = 'chessnerd-titled-players-sync/2.0 (contact: moving.form.of.dust@gmail.com)'
deadline = float('inf')


def utc_now():
    return datetime.now(timezone.utc)


def iso():
    return utc_now().isoformat(timespec='seconds')


def check_budget():
    if time.monotonic() >= deadline:
        raise TimeoutError('Refresh time limit reached; public snapshot has not been replaced')


def safe_request(url):
    for attempt in range(4):
        check_budget()
        try:
            response = session.get(url, timeout=min(20, max(0.1, deadline - time.monotonic())))
            if response.status_code == 200:
                value = response.json()
                if not isinstance(value, dict):
                    raise ValueError(f'Unexpected API response: {url}')
                return value
            if response.status_code != 429 and response.status_code < 500:
                raise ValueError(f'API HTTP {response.status_code}: {url}')
            retry = response.headers.get('Retry-After', '')
            delay = min(120, int(retry)) if retry.isdigit() else 2 ** (attempt + 1)
        except (requests.RequestException, json.JSONDecodeError):
            delay = 2 ** (attempt + 1)
        if attempt == 3:
            break
        if time.monotonic() + delay >= deadline:
            raise TimeoutError('API retry would exceed refresh time limit')
        time.sleep(delay)
    raise RuntimeError(f'API retries exhausted: {url}')


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temp.replace(path)


def load(path):
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(raw, list) or any(not isinstance(p, dict) or not p.get('username') for p in raw):
        raise ValueError(f'Invalid saved player snapshot: {path}')
    result = {p['username'].lower(): p for p in raw}
    if len(result) != len(raw):
        raise ValueError(f'Duplicate saved players: {path}')
    return result


def stats_current(record, now):
    # Legacy updated_at sometimes advanced on failed fetches. Only a new,
    # explicit stats timestamp can establish daily freshness.
    return bool(record.get('fetch_ok')) and record.get('stats_updated_at', '')[:10] == now.date().isoformat()


def profile_current(record, now):
    try:
        stamp = datetime.fromisoformat(record['profile_updated_at'])
        return timedelta(0) <= now - stamp < timedelta(days=7)
    except (KeyError, ValueError, TypeError):
        return False


def get_player_data(username, title, old=None):
    # Partial responses never mutate known good data.
    record = dict(old or {})
    stats = safe_request(f'https://api.chess.com/pub/player/{username}/stats')
    ratings = {}
    for key in ('rapid', 'blitz', 'bullet'):
        rating = stats.get('chess_' + key, {}).get('last', {}).get('rating', 0)
        if type(rating) is not int or not 0 <= rating <= 10000:
            raise ValueError(f'Invalid {key} rating: {username}')
        ratings[key] = rating
    if not profile_current(record, utc_now()):
        profile = safe_request(f'https://api.chess.com/pub/player/{username}')
        if str(profile.get('username', '')).lower() != username.lower() or not isinstance(profile.get('status'), str):
            raise ValueError(f'Invalid profile: {username}')
        country = (profile.get('country') or '').rsplit('/', 1)[-1].upper()
        record.update(name=profile.get('name') or '', avatar=profile.get('avatar') or '',
                      country=country if re.fullmatch('[A-Z]{2}', country) else '??',
                      status='active' if profile['status'] in ACTIVE_STATUSES else 'inactive', profile_updated_at=iso())
    record.update(username=username, title=title, **ratings, updated_at=iso(), stats_updated_at=iso(), fetch_ok=True)
    return record


def sort_key(player):
    return TITLE_RANK.get(player['title'], 99), player['username'].lower()


def main():
    global deadline
    deadline = time.monotonic() + MAX_RUN_SECONDS if MAX_RUN_SECONDS else float('inf')
    started = iso()
    public = load(OUTPUT_FILE)
    existing = {u: dict(p) for u, p in public.items()}
    for username, checkpoint in load(CHECKPOINT_FILE).items():
        if checkpoint.get('stats_updated_at', '') > existing.get(username, {}).get('stats_updated_at', ''):
            existing[username] = checkpoint
    title_map = {}
    for title in TITLES:
        response = safe_request(f'https://api.chess.com/pub/titled/{title}')
        users = response.get('players')
        if not isinstance(users, list) or not users or any(not isinstance(u, str) or not re.fullmatch('[a-zA-Z0-9_-]+', u) for u in users):
            raise ValueError(f'Invalid/empty {title} list; keeping public snapshot')
        for username in users:
            username = username.lower()
            if username not in title_map or TITLE_RANK[title] < TITLE_RANK[title_map[username]]:
                title_map[username] = title
    departed = set(public) - set(title_map)
    if public and len(departed) > MAX_REMOVED_SHARE * len(public):
        raise ValueError(f'Removal guard: {len(departed)} of {len(public)} saved players missing')
    working = {u: dict(p, title=title_map[u]) for u, p in existing.items() if u in title_map}
    failures = []
    refreshed = 0
    try:
        for index, username in enumerate(sorted(title_map), 1):
            check_budget()
            old = working.get(username, {})
            if stats_current(old, utc_now()) and profile_current(old, utc_now()):
                continue
            try:
                working[username] = get_player_data(username, title_map[username], old)
                refreshed += 1
            except (ValueError, RuntimeError, requests.RequestException) as exc:
                failures.append(username)
                print(f'Failed {username}: {exc}', flush=True)
            if index % 50 == 0:
                save(CHECKPOINT_FILE, sorted(working.values(), key=sort_key))
                print(f'{index}/{len(title_map)} checked; {refreshed} refreshed; {len(failures)} failed', flush=True)
        if failures or len(working) != len(title_map) or any(not stats_current(p, utc_now()) for p in working.values()):
            raise RuntimeError(f'Incomplete daily snapshot ({len(failures)} failed); public data retained')
        result = sorted(working.values(), key=sort_key)
        stamps = [p['stats_updated_at'] for p in result]
        meta = {'schema': 1, 'source': 'https://api.chess.com/pub/titled/{title}', 'started': started, 'completed': iso(),
                'count': len(result), 'refreshed': refreshed, 'oldestStats': min(stamps), 'newestStats': max(stamps),
                'removed': len(departed), 'failed': 0, 'titles': TITLES}
        save(OUTPUT_FILE, result)
        save(META_FILE, meta)
        print(f'Published complete daily snapshot: {len(result)} players, {refreshed} refreshed', flush=True)
    finally:
        save(CHECKPOINT_FILE, sorted(working.values(), key=sort_key))


if __name__ == '__main__':
    main()
