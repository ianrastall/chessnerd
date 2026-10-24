#!/usr/bin/env python3
"""File the Chess.com PGNs dropped in this folder.

Handles Titled Tuesday, Bullet Brawl, 3-0 Thursday and CCC downloads. For every
PGN sitting next to this script it works out the series, previews the import
with that archive repo's own importer, asks once, and then does the whole of
HOW-TO-ADD-CHESSCOM-PGNS.md: pull, import, commit and push each archive repo,
sync the manifests into the site, commit and push the site, and add a row to
the runbook's import log. Filed PGNs are moved into ``filed``; anything that
could not be filed stays where it is with the reason printed.

Any other Chess.com event PGN goes to the Events tab instead: it is moved into
``cc-events`` and the cc-events-archive pipeline is run, which decides by its
own rule whether the event is kept, rebuilds the manifest and the prepared
databases, and is then committed and pushed like the rest.

    python file_pgns.py            preview, ask, then file
    python file_pgns.py --dry-run  preview only
    python file_pgns.py --yes      file without asking
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
# The archive checkouts retain their own histories and original location.
BASE = Path(os.environ.get('CHESSNERD_ARCHIVE_ROOT', r'D:\dev\proj\chessnerd'))
RUNBOOK = HERE / 'import-log.md'
FILED = HERE / 'filed'
LIVE = 'https://chessnerd.net/data/{repo}/manifest.json'
EVENTS_REPO = BASE / 'cc-events-archive'
EVENTS_INBOX = BASE / 'cc-events'
EVENTS_INBOXES = [EVENTS_INBOX, Path(r'D:\dev\proj\cc-events-download')]   # where the pipeline looks for raw files
EVENTS_PYTHON = Path(r'D:\dev\proj\ctml\.venv\Scripts\python.exe')        # has python-chess and lxml
EVENTS_STAGES = ('scan', 'enrich', 'match', 'tables', 'classify', 'ctml', 'pgn')

SERIES = {
    'tt': dict(label='Titled Tuesday', short='TT', repo='titled-tuesday-archive',
               importer=['archive_metadata.py', '--import-pgn'], manifest='tt_manifest.json',
               tracked=['tt_manifest.json', 'tt_links.txt', 'tt_events.txt', 'tt_game_counts.txt'],
               sync='sync:tt', weekday=1, sessions={'': '', 'a': ' early', 'b': ' late'}),
    'bb': dict(label='Bullet Brawl', short='BB', repo='bullet-brawl-archive',
               importer=['archive_metadata.py', '--import-pgn'], manifest='bb_manifest.json',
               tracked=['bb_manifest.json', 'bb_links.txt', 'bb_events.txt', 'bb_game_counts.txt', 'README.md'],
               sync='sync:bb', weekday=5, sessions={'': ''}),
    't30': dict(label='3-0 Thursday', short='T30', repo='3-0-thursday-archive',
                importer=['archive_metadata.py', '--import-pgn'], manifest='t30_manifest.json',
                tracked=['t30_manifest.json', 't30_links.txt', 't30_events.txt', 't30_game_counts.txt', 'README.md'],
                sync='sync:t30', weekday=3, sessions={'a': ' First', 'b': ' Second', 'c': ' Third'}),
    'ccc': dict(label='CCC', short='CCC', repo='ccc-archive',
                importer=['scripts/import_pgn.py'], manifest='ccc_manifest.json',
                tracked=['ccc_manifest.json', 'ccc_links.txt', 'events.txt', 'game_counts.txt'],
                sync='sync:ccc'),
}
WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
FIRST_EVENT = re.compile(rb'^\[Event "(.*)"\]', re.M)
IMPORT_LINE = re.compile(r'-> (\S+\.zip): ([\d,]+) games')
ZIP_DATE = re.compile(r'_(\d{4}-\d{2}-\d{2})([abc]?)\.zip$')


@dataclass
class Item:
    path: Path
    key: str
    event: str
    zip: str = ''
    games: int = 0

    @property
    def date(self) -> date | None:
        match = ZIP_DATE.search(self.zip)
        return date.fromisoformat(match[1]) if match and self.key != 'ccc' else None

    @property
    def letter(self) -> str:
        match = ZIP_DATE.search(self.zip)
        return match[2] if match and self.key != 'ccc' else ''

    @property
    def what(self) -> str:
        if self.key == 'ccc':
            return self.event
        return f"{SERIES[self.key]['label']} {self.date:%b} {self.date.day}{SERIES[self.key]['sessions'][self.letter]}"


def run(command, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True, encoding='utf-8',
                          errors='replace', shell=isinstance(command, str),
                          env={**os.environ, 'PYTHONUTF8': '1'})


def git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return run(['git', *args], repo)


def last_line(result: subprocess.CompletedProcess) -> str:
    lines = [line.strip() for line in (result.stderr + '\n' + result.stdout).splitlines() if line.strip()]
    reason = re.sub(r'^\w*Error: ', '', lines[-1]) if lines else f'exit code {result.returncode}'
    reason = re.sub(r'^Archive already exists(?: or was selected twice)?: (?:.*[\\/])?', 'already in the archive as ', reason)
    return re.sub(r'^Event overlaps an existing archive: .*', 'this CCC event is already in the archive', reason)


def long_date(day: date) -> str:
    return f'{day:%B} {day.day}, {day.year}'


def classify(path: Path) -> tuple[str | None, str]:
    with path.open('rb') as handle:
        head = handle.read(65536)
    match = FIRST_EVENT.search(head)
    event = match[1].decode('utf-8', 'replace').strip() if match else ''
    name = path.name.lower().replace('_', '-')
    if 'titled-tuesday' in name:
        return 'tt', event
    if 'bullet-brawl' in name:
        return 'bb', event
    if '3-0-thursday' in name:
        return 't30', event
    if event.upper().startswith('CCC'):
        return 'ccc', event
    # A Chess.com event export: its Site is the event's page, or (from 2024) the
    # venue, with the Board and Variant tags no other source writes together.
    if b'chess.com/events/' in head or (b'[Variant "' in head and b'[Board "' in head):
        return 'events', event
    return None, event


def importer(key: str, files: list[Path], write: bool) -> subprocess.CompletedProcess:
    series = SERIES[key]
    command = [sys.executable, *series['importer'], *map(str, files)] + (['--write'] if write else [])
    return run(command, BASE / series['repo'])


def preview(key: str, items: list[Item]) -> tuple[list[Item], list[tuple[Item, str]]]:
    """Dry-run the importer. A failing batch is retried file by file to find the culprit."""
    # CCC always goes one file at a time: in a batch its importer gives a second
    # copy of the same event a suffix instead of refusing it.
    if len(items) > 1 and key != 'ccc':
        result = importer(key, [item.path for item in items], write=False)
        lines = IMPORT_LINE.findall(result.stdout)
        if result.returncode == 0 and len(lines) == len(items):
            for item, (name, games) in zip(items, lines):
                item.zip, item.games = name, int(games.replace(',', ''))
            return items, []
    good, bad, targets = [], [], {}
    for item in items:
        result = importer(key, [item.path], write=False)
        lines = IMPORT_LINE.findall(result.stdout)
        if result.returncode != 0 or len(lines) != 1:
            bad.append((item, last_line(result)))
            continue
        item.zip, item.games = lines[0][0], int(lines[0][1].replace(',', ''))
        if item.zip in targets:
            bad.append((item, f'same event as {targets[item.zip]}'))
            continue
        targets[item.zip] = item.path.name
        good.append(item)
    return good, bad


def load_manifest(key: str) -> list[dict]:
    series = SERIES[key]
    return json.loads((BASE / series['repo'] / series['manifest']).read_text(encoding='utf-8-sig'))


def live_zips(key: str, cache: dict = {}) -> set[str] | None:
    """ZIP names the live site lists for a series; None when it cannot be reached."""
    if key not in cache:
        try:
            with urllib.request.urlopen(LIVE.format(repo=SERIES[key]['repo']), timeout=30) as response:
                cache[key] = {entry['zip'] for entry in json.load(response)}
        except (OSError, ValueError):
            cache[key] = None
    return cache[key]


def filed_status(item: Item, reason: str) -> tuple[bool, str, bool] | None:
    """Trace a PGN the importer refused as already archived through all three places.

    Returns (fully filed, description, site needs a re-sync), or None when the
    refusal was about something else. Fully filed means the archived copy has
    the same games byte for byte, its ZIP is on GitHub, and the live site lists it.
    """
    repo = BASE / SERIES[item.key]['repo']
    content = item.path.read_bytes()
    if item.key == 'ccc':
        if 'already in the archive' not in reason:
            return None
        spec = importlib.util.spec_from_file_location('ccc_import_pgn', repo / 'scripts' / 'import_pgn.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        content, found, _ = module.prepare_pgn(content)
        names = [entry['zip'] for entry in load_manifest('ccc') if entry['event'].strip() == found['event']
                 and entry['start'] <= found['end'] and found['start'] <= entry['end']]
        if not names:
            return None
        name = names[0]
    else:
        match = re.search(r'already in the archive as (\S+\.zip)', reason)
        if not match:
            return None
        name = match[1]
    path = f"{re.search(r'_(\d{4})-', name)[1]}/{name}"
    with zipfile.ZipFile(repo / path) as archive:
        archived = archive.read(archive.namelist()[0])
    if archived != content:
        here, there = (len(re.findall(rb'^\[Event ', data, re.M)) for data in (content, archived))
        return False, (f'archived as {name}, but this file is DIFFERENT: {here:,} games here, '
                       f'{there:,} in the archive. Not touched; decide which one is right.'), False
    if not git(repo, 'ls-tree', '--name-only', '@{u}', '--', path).stdout.strip():
        return False, f'saved as {name} (identical), but NOT on GitHub yet', False
    live = live_zips(item.key)
    if live is None:
        return False, f'saved as {name} (identical) and on GitHub; could not reach chessnerd.net to check the page', False
    if name not in live:
        return False, f'saved as {name} (identical) and on GitHub, but NOT shown on chessnerd.net yet', True
    return True, f'{name}: identical copy saved, on GitHub, shown on chessnerd.net', False


def concerns(key: str, items: list[Item]) -> list[str]:
    """Things worth a second look before filing; none of them block the import."""
    if key == 'ccc':
        return []
    series, notes = SERIES[key], []
    existing = [(date.fromisoformat(entry['date']), ZIP_DATE.search(entry['zip'])[2], entry['games'])
                for entry in load_manifest(key)]
    days = sorted({day for day, _, _ in existing} | {item.date for item in items})
    for item in sorted(items, key=lambda item: item.zip):
        if item.date.weekday() != series['weekday']:
            notes.append(f"{item.path.name}: {long_date(item.date)} is a {WEEKDAYS[item.date.weekday()]}, "
                         f"not a {WEEKDAYS[series['weekday']]}")
        recent = [games for _, letter, games in sorted(existing)[-60:] if letter == item.letter][-20:]
        if recent and item.games < 0.7 * min(recent):
            notes.append(f'{item.path.name}: only {item.games:,} games; recent ones had '
                         f'{min(recent):,}-{max(recent):,}. Downloaded before the event finished?')
    for day in sorted({item.date for item in items}):
        earlier = [other for other in days if other < day]
        if earlier and (day - earlier[-1]).days > 7:
            notes.append(f'Nothing archived between {long_date(earlier[-1])} and {long_date(day)}. Skipped a week?')
        if key == 't30':
            have = {letter for other, letter, _ in existing if other == day}
            have |= {item.letter for item in items if item.date == day}
            missing = [series['sessions'][letter].strip() for letter in 'abc' if letter not in have]
            if missing:
                notes.append(f"{long_date(day)}: no {' or '.join(missing)} session yet")
    return notes


def prepare_repo(repo: Path, *, pull: bool = True) -> str | None:
    """Pull a repo. Returns why it cannot be used, or None when it is ready."""
    status = git(repo, 'status', '--porcelain', '--untracked-files=no')
    if status.returncode != 0:
        return f'cannot read repository: {last_line(status)}'
    if status.stdout.strip():
        return 'has uncommitted changes'
    if not pull:
        return None
    result = git(repo, 'pull', '--ff-only')
    if result.returncode != 0:
        return f'git pull failed: {last_line(result)}'
    return None


def unpushed(repo: Path) -> bool:
    return git(repo, 'rev-list', '--count', '@{u}..HEAD').stdout.strip() not in ('', '0')


def bump_readme(key: str) -> None:
    """Keep the coverage sentence in the two READMEs that state one."""
    readme = BASE / SERIES[key]['repo'] / 'README.md'
    if key not in ('bb', 't30') or not readme.exists():
        return
    entries = load_manifest(key)
    last = max(date.fromisoformat(entry['date']) for entry in entries)
    with readme.open(encoding='utf-8', newline='') as handle:
        text = handle.read()
    if key == 'bb':
        games = sum(entry['games'] for entry in entries)
        updated = re.sub(
            r'contains [\d,]+ (Bullet Brawl events from .+?, through\s+)[A-Z][a-z]+\s+\d{1,2},\s+\d{4}:\s+[\d,]+(\s+)games',
            lambda m: f'contains {len(entries)} {m[1]}{long_date(last)}: {games:,}{m[2]}games', text, flags=re.S)
        updated = re.sub(r'(currently covers [A-Z][a-z]+ \d{4} through\s+)[A-Z][a-z]+\s+\d{4}',
                         lambda m: f'{m[1]}{last:%B} {last.year}', updated)
    else:
        updated = re.sub(r'(currently covers [A-Z][a-z]+ \d{1,2}, \d{4} through\s+)[A-Z][a-z]+\s+\d{1,2},\s+\d{4}',
                         lambda m: f'{m[1]}{long_date(last)}', text)
    if updated != text:
        with readme.open('w', encoding='utf-8', newline='') as handle:
            handle.write(updated)


def move_original(path: Path, destination: Path) -> None:
    """Keep every downloaded copy, including repeated filenames."""
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / path.name
    number = 1
    while target.exists():
        target = destination / f'{path.stem}.{number}{path.suffix}'
        number += 1
    shutil.move(str(path), str(target))


def commit_message(key: str, items: list[Item]) -> str:
    if key == 'tt':
        return 'Titled Tuesday archive: add ' + ', '.join(f'{item.date.isoformat()}{item.letter}' for item in items)
    if key == 'ccc':
        return 'CCC archive: add ' + ', '.join(re.sub(r'(?i)^ccc\s+', '', item.event) for item in items)
    return f"Add {SERIES[key]['label']} " + '; '.join(long_date(day) for day in sorted({item.date for item in items}))


def file_series(key: str, items: list[Item]) -> bool:
    """Import, commit and push one series. True when the archive repo is pushed."""
    series = SERIES[key]
    repo = BASE / series['repo']
    items.sort(key=lambda item: item.zip)
    result = importer(key, [item.path for item in items], write=True)
    if result.returncode != 0:
        print(f"  {series['label']}: import FAILED: {last_line(result)}")
        print(f'    Nothing was pushed. Check {repo} before running again.')
        return False
    FILED.mkdir(exist_ok=True)
    for item in items:
        move_original(item.path, FILED)
    bump_readme(key)
    zips = [f"{re.search(r'_(\d{4})-', item.zip)[1]}/{item.zip}" for item in items]
    tracked = [name for name in series['tracked'] if (repo / name).exists()]
    for step in (['add', '--', *zips, *tracked], ['commit', '-m', commit_message(key, items)], ['push']):
        result = git(repo, *step)
        if result.returncode != 0:
            print(f"  {series['label']}: imported, but git {step[0]} FAILED: {last_line(result)}")
            print(f'    Fix it in {repo}, then run this again to finish.')
            return False
    print(f"  {series['label']}: imported {len(items)}, committed and pushed.")
    return True


def game_count(path: Path) -> int:
    return len(re.findall(rb'^\[Event "', path.read_bytes(), re.M))


def events_catalog(stems: list[str]) -> dict[str, sqlite3.Row]:
    """What the events pipeline has decided about these raw files, by file stem."""
    catalog = EVENTS_REPO / 'work' / 'catalog.sqlite'
    if not catalog.is_file() or not stems:
        return {}
    con = sqlite3.connect(f'file:{catalog.as_posix()}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    marks = ','.join('?' * len(stems))
    rows = con.execute(f'select slug, decision, reason, pub_name, games, avg_rating from event where slug in ({marks})',
                       stems).fetchall()
    con.close()
    return {row['slug']: row for row in rows}


def event_verdict(row: sqlite3.Row) -> str:
    if row['decision'] == 'keep':
        return f"kept as {row['pub_name']} ({row['games']:,} games, average {row['avg_rating']})"
    return f"not kept ({row['decision']}): {row['reason']}"


def event_status(path: Path, cache: dict = {}) -> tuple[str, str]:
    """('new' | 'changed' | 'smaller' | 'filed' | 'unshown', description) for an events PGN.

    'filed' means the pipeline already has this exact file and has judged it,
    and, if it kept the event, the live site lists it. 'unshown' is the same
    except that the live site does not list it yet."""
    existing = next((folder / path.name for folder in EVENTS_INBOXES if (folder / path.name).is_file()), None)
    if existing is None:
        return 'new', ''
    if existing.read_bytes() != path.read_bytes():
        if game_count(path) < game_count(existing):
            return 'smaller', (f'the copy in {existing.parent} has more games '
                               f'({game_count(existing):,} there, {game_count(path):,} here)')
        return 'changed', (f'replaces the copy in {existing.parent} '
                           f'({game_count(existing):,} games there, {game_count(path):,} here)')
    row = events_catalog([path.stem]).get(path.stem)
    if row is None:
        return 'new', ''
    if row['decision'] != 'keep':
        return 'filed', event_verdict(row)
    if 'live' not in cache:
        try:
            with urllib.request.urlopen(LIVE.format(repo='cc-events-archive'), timeout=60) as response:
                cache['live'] = {entry['slug'] for entry in json.load(response)}
        except (OSError, ValueError):
            cache['live'] = None
    if cache['live'] is None:
        return 'filed', event_verdict(row) + '; could not reach chessnerd.net to check the page'
    if row['pub_name'] in cache['live']:
        return 'filed', event_verdict(row) + ', shown on chessnerd.net'
    return 'unshown', event_verdict(row) + ', but NOT shown on chessnerd.net yet'


def file_events(paths: list[Path]) -> tuple[bool, list[str]]:
    """Move event PGNs into cc-events, run the events pipeline, commit and push
    cc-events-archive. Returns (archive pushed, one line per kept event)."""
    reason = prepare_repo(EVENTS_REPO)
    if reason:
        print(f'  Events: skipped, {EVENTS_REPO} {reason}. The PGNs stay in the workspace.')
        return False, []
    stems = []
    for path in paths:
        for folder in EVENTS_INBOXES:
            old = folder / path.name
            if old.is_file():
                # A fuller download replaces the earlier one; the earlier one is kept aside, not deleted.
                aside = FILED / 'superseded'
                aside.mkdir(parents=True, exist_ok=True)
                move_original(old, aside)
        target = EVENTS_INBOX / path.name
        shutil.move(str(path), str(target))
        if time.time() - target.stat().st_mtime < 180:
            # The pipeline leaves files touched in the last two minutes alone, as still downloading.
            os.utime(target, (time.time() - 300, time.time() - 300))
        stems.append(path.stem)

    def stage(*args: str) -> bool:
        print(f"  -- events pipeline: {' '.join(args)}", flush=True)
        result = subprocess.run([str(EVENTS_PYTHON), 'pipeline/cc_events.py', *args], cwd=EVENTS_REPO)
        if result.returncode != 0:
            print(f"  Events: stage {args[0]} FAILED. Nothing was pushed; the PGNs are in {EVENTS_INBOX}.")
        return result.returncode == 0

    for name in EVENTS_STAGES:
        if not stage(name):
            return False, []
    judged = events_catalog(stems)
    lines = []
    for stem in stems:
        row = judged.get(stem)
        print(f"  {stem}.pgn: " + (event_verdict(row) if row else 'not read by the pipeline; see its output above'))
        if row and row['decision'] == 'keep':
            # Every game of a new event is replayed against its source before it is published.
            check = run([str(EVENTS_PYTHON), 'pipeline/cc_events.py', 'verify', '--only', stem], EVENTS_REPO)
            if check.returncode != 0 or ' 0 events with differences' not in check.stdout:
                print(f'  Events: {stem} did not verify against its source: {last_line(check)}')
                print('    Nothing was published or pushed.')
                return False, []
            lines.append(f"{row['pub_name']} ({row['games']:,})")
    if not stage('publish'):
        return False, []
    if not git(EVENTS_REPO, 'status', '--porcelain').stdout.strip():
        print('  Events: nothing new to publish.')
        return False, lines
    years = sorted(folder.name for folder in EVENTS_REPO.iterdir() if folder.is_dir() and re.fullmatch(r'\d{4}', folder.name))
    message = 'Events: add ' + ', '.join(line.split(' (')[0] for line in lines) if lines else 'Events: republish'
    for step in (['add', '-A', '--', *years, 'cc_events_manifest.json', 'cc_events_bundles.json'],
                 ['commit', '-m', message[:400]], ['push']):
        result = git(EVENTS_REPO, *step)
        if result.returncode != 0:
            print(f'  Events: published locally, but git {step[0]} FAILED: {last_line(result)}')
            print(f'    Fix it in {EVENTS_REPO}, then run this again to finish.')
            return False, lines
    print(f'  Events: {len(lines)} kept of {len(stems)}, committed and pushed.')
    return True, lines


def sync_site(keys: list[str], through: str, extra: tuple[str, ...] = ()) -> bool:
    reason = prepare_repo(SITE) if not git(SITE, 'diff', '--cached', '--quiet').returncode else 'has staged changes'
    if reason:
        print(f'  Site: skipped, {SITE} {reason}.')
        print('    The archives are pushed; the live page picks them up on its next deployment.')
        return False
    for command in [f"npm run {SERIES[key]['sync']}" for key in dict.fromkeys(keys)] + [f'npm run {name}' for name in extra] + ['npm test', 'npm run build']:
        result = run(command, SITE)
        if result.returncode != 0:
            print(f'  Site: "{command}" FAILED: {last_line(result)}')
            print(f'    Nothing was pushed to the site. Fix it in {SITE} and run the syncs by hand.')
            return False
    # Stage only the outputs of these syncs, including their provenance receipt.
    paths = [f"public/data/{SERIES[key]['repo']}/manifest.json" for key in dict.fromkeys(keys)]
    if 'sync:events' in extra:
        paths += ['public/data/cc-events-archive/manifest.json', 'public/data/cc-events-archive/bundles.json']
    result = git(SITE, 'add', '--', *paths, 'public/data/archive-sources.json')
    if result.returncode != 0:
        print(f'  Site: git add FAILED: {last_line(result)}')
        return False
    if git(SITE, 'diff', '--cached', '--quiet').returncode == 0 and not unpushed(SITE):
        print('  Site: manifests already up to date.')
        return True
    for step in (['commit', '-m', f'Sync Chess.com archive manifests through {through}'], ['push']):
        if step[0] == 'commit' and git(SITE, 'diff', '--cached', '--quiet').returncode == 0:
            continue
        result = git(SITE, *step)
        if result.returncode != 0:
            print(f'  Site: git {step[0]} FAILED: {last_line(result)}')
            return False
    print('  Site: manifests synced, committed and pushed. The live page updates in a few minutes.')
    return True


def read_import_log() -> str:
    if not RUNBOOK.exists():
        return '# Workspace import log\n\n## Import log\n\n| Date done | Added |\n| --- | --- |\n'
    with RUNBOOK.open(encoding='utf-8', newline='') as handle:
        return handle.read()


def log_events(lines: list[str]) -> None:
    manifest = json.loads((EVENTS_REPO / 'cc_events_manifest.json').read_text(encoding='utf-8'))
    row = (f"| {date.today().isoformat()} | **Events**: {'; '.join(lines)}. Total after: {len(manifest):,} events / "
           f"{sum(entry['games'] for entry in manifest):,} games. Filed with `workspace\\File PGNs.bat`. |")
    text = read_import_log()
    newline = '\r\n' if '\r\n' in text else '\n'
    updated = re.sub(r'(## Import log\s+\|[^\n]*\n\|[ :|-]+\r?\n)', lambda m: m[1] + row + newline, text, count=1)
    if updated != text:
        with RUNBOOK.open('w', encoding='utf-8', newline='') as handle:
            handle.write(updated)


def log_import(done: dict[str, list[Item]]) -> None:
    parts, totals = [], []
    for key, items in done.items():
        parts += [f'{item.what} ({item.games:,})' for item in items]
        entries = load_manifest(key)
        totals.append(f"{SERIES[key]['short']} {len(entries):,} events / {sum(entry['games'] for entry in entries):,} games")
    row = (f"| {date.today().isoformat()} | {'. '.join(parts)}. Totals after: {'; '.join(totals)}. "
           'Filed with `workspace\\File PGNs.bat`. |')
    text = read_import_log()
    newline = '\r\n' if '\r\n' in text else '\n'
    updated = re.sub(r'(## Import log\s+\|[^\n]*\n\|[ :|-]+\r?\n)', lambda m: m[1] + row + newline, text, count=1)
    if updated != text:
        with RUNBOOK.open('w', encoding='utf-8', newline='') as handle:
            handle.write(updated)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dry-run', action='store_true', help='Preview only; change nothing.')
    parser.add_argument('--yes', action='store_true', help='File without asking.')
    args = parser.parse_args()

    files = sorted(path for path in HERE.iterdir() if path.is_file() and path.suffix.lower() == '.pgn')
    print(f'{len(files)} PGN file(s) in {HERE}\n')

    groups: dict[str, list[Item]] = {}
    left: list[tuple[str, str]] = []
    seen: dict[str, str] = {}
    events: list[tuple[Path, str]] = []          # event PGNs for the pipeline, with a note
    events_filed: list[tuple[Path, str]] = []    # event PGNs the pipeline already has
    events_resync = False
    for path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in seen:
            left.append((path.name, f'identical to {seen[digest]}'))
            continue
        seen[digest] = path.name
        key, event = classify(path)
        if key is None:
            left.append((path.name, f'not a Chess.com series or event PGN (Event "{event}")'))
        elif key == 'events':
            state, text = event_status(path)
            if state in ('filed', 'unshown'):
                events_filed.append((path, text))
                events_resync = events_resync or state == 'unshown'
            elif state == 'smaller':
                left.append((path.name, text))
            else:
                events.append((path, text))
        else:
            groups.setdefault(key, []).append(Item(path, key, event))

    print('Checking local archive repos (no pull in dry run)...' if args.dry_run else 'Pulling the archive repos...')
    blocked = {key: reason for key in SERIES if (reason := prepare_repo(BASE / SERIES[key]['repo'], pull=not args.dry_run))}
    for key, reason in blocked.items():
        print(f"  {SERIES[key]['repo']}: {reason}")
        left += [(item.path.name, f"{SERIES[key]['repo']} {reason}") for item in groups.pop(key, [])]
    # Commits a previous run made but could not push.
    pending = [key for key in SERIES if key not in blocked and unpushed(BASE / SERIES[key]['repo'])]

    notes: list[str] = []
    dupes: list[tuple[Item, str]] = []
    resync: list[str] = []
    for key in list(groups):
        print(f"Checking {SERIES[key]['label']}" + ('...' if key == 'ccc' else
              ' (re-validates the whole archive, can take half a minute)...'))
        groups[key], bad = preview(key, groups[key])
        for item, reason in bad:
            status = filed_status(item, reason)
            if status and status[0]:
                dupes.append((item, status[1]))
            else:
                left.append((item.path.name, status[1] if status else reason))
            if status and status[2] and key not in resync:
                resync.append(key)
        if groups[key]:
            notes += concerns(key, groups[key])
        else:
            del groups[key]

    print()
    for key, items in groups.items():
        for item in sorted(items, key=lambda item: item.zip):
            print(f"  {item.path.name}\n      -> {SERIES[key]['repo']}\\{item.zip}   {item.games:,} games")
    if events:
        print('\nEVENTS (moved to cc-events; the events pipeline decides which are kept, about ten minutes):')
        for path, text in events:
            print(f'  {path.name}   {game_count(path):,} games' + (f'\n      {text}' if text else ''))
    if dupes or events_filed:
        print('\nALREADY FILED (the raw file just moves to filed):')
        for item, status in dupes:
            print(f'  {item.path.name}\n      {status}')
        for path, text in events_filed:
            print(f'  {path.name}\n      {text}')
    if left:
        print('\nNOT filing (left where they are):')
        for name, reason in left:
            print(f'  {name}\n      {reason}')
    if notes:
        print('\nWORTH A LOOK:')
        for note in notes:
            print(f'  {note}')
    for key in pending:
        print(f"\n{SERIES[key]['repo']} has commits from an earlier run that were never pushed; they will be pushed.")

    for key in resync:
        print(f"\n{SERIES[key]['label']} has events on GitHub that the site does not show; the site will be re-synced.")

    if not groups and not pending and not dupes and not resync and not events and not events_filed:
        print('\nNothing to file.')
        return 1 if left else 0
    if args.dry_run:
        print('\nDry run: nothing was changed.')
        return 0
    if not args.yes and input('\nGo ahead? [Y/N] ').strip().lower() not in ('y', 'yes'):
        print('Nothing was changed.')
        return 0

    print()
    if dupes:
        FILED.mkdir(exist_ok=True)
        for item, _ in dupes:
            move_original(item.path, FILED)
        print(f'  Moved {len(dupes)} already-filed PGN(s) to filed.')
    if events_filed:
        FILED.mkdir(exist_ok=True)
        for path, _ in events_filed:
            move_original(path, FILED)
        print(f'  Moved {len(events_filed)} already-filed event PGN(s) to filed.')
    events_pushed, event_lines = file_events([path for path, _ in events]) if events else (False, [])
    if events_pushed and event_lines:
        log_events(event_lines)
    done = {key: items for key, items in groups.items() if file_series(key, items)}
    pushed = list(done) + [key for key in resync if key not in groups]
    for key in pending:
        if key not in groups:
            result = git(BASE / SERIES[key]['repo'], 'push')
            print(f"  {SERIES[key]['label']}: " + ('pushed earlier commits.' if result.returncode == 0
                                                  else f'git push FAILED: {last_line(result)}'))
            if result.returncode == 0:
                pushed.append(key)
    if done:
        log_import(done)
    site_ok = True
    if pushed or events_pushed or events_resync:
        dates = [item.date for items in done.values() for item in items if item.date]
        site_ok = sync_site(pushed, long_date(max(dates)) if dates else long_date(date.today()),
                  ('sync:events',) if events_pushed or events_resync else ())
    failed = len(done) != len(groups) or (bool(events) and not events_pushed) or not site_ok
    print('\nDone.' if not failed and not left else '\nFinished, with the problems listed above.')
    return 1 if failed or left else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
