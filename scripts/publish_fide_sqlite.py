#!/usr/bin/env python3
"""Validate existing standard-rating SQLite lists and publish individual ZIPs.

Original databases and the independent archive checkout are opened read only.
GitHub credentials are handled by gh. A draft release is published only after
every asset's server-reported SHA-256 and size have been verified.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import threading
import time
import zipfile

REPO = 'ianrastall/fide-db-archive'
COLUMNS = ['list_date', 'line_no', 'rank', 'rank_note', 'fide_id', 'name', 'fed', 'sex',
           'title', 'w_title', 'o_title', 'foa_title', 'title_raw', 'rating', 'change',
           'games', 'k', 'birth_year', 'birth_date', 'birth_raw', 'flag', 'section']


def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def save(path, data):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, indent=1) + '\n', encoding='utf-8')
    temp.replace(path)


def gh(*args):
    return subprocess.check_output(['gh', *map(str, args)], text=True, encoding='utf-8')


def prepare(args):
    inventory = json.loads(args.inventory.read_text(encoding='utf-8'))
    sources = [row for group in inventory['files'] for row in group['lists']]
    if not sources or len({r['source_db'] for r in sources}) != len(sources):
        raise ValueError('Empty or duplicate source inventory')
    if any(r['rating_type'] != 'standard' for r in sources):
        raise ValueError('Only standard rating lists are accepted')
    args.output.mkdir(parents=True, exist_ok=True)
    previous_path = args.output / 'standard-lists.json'
    previous_doc = json.loads(previous_path.read_text()) if previous_path.exists() else {'lists': []}
    previous = {r['databaseName']: r for r in previous_doc['lists']}

    def package(expected):
        name = expected['source_db']
        if not re.fullmatch(r'fide-standard-\d{4}(?:-\d{2})?\.sqlite', name):
            raise ValueError(f'Invalid source filename: {name}')
        if name != f"fide-standard-{expected['list_date']}.sqlite":
            raise ValueError(f'Source filename and period disagree: {name}')
        source = args.source / name
        before = (source.stat().st_size, source.stat().st_mtime_ns)
        if source.stat().st_size != expected['bytes'] or sha(source) != expected['sha256']:
            raise ValueError(f'Source differs from verified archive inventory: {name}')
        if any(Path(str(source) + s).exists() for s in ('-wal', '-shm', '-journal')):
            raise ValueError(f'Active SQLite database: {name}')
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro&immutable=1', uri=True)) as db:
            if db.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
                raise ValueError(f'SQLite integrity failure: {name}')
            if [r[1] for r in db.execute('PRAGMA table_info(players)')] != COLUMNS:
                raise ValueError(f'Unexpected player schema: {name}')
            metadata = dict(db.execute('SELECT key,value FROM meta'))
            count = db.execute('SELECT count(*) FROM players').fetchone()[0]
            dates = db.execute('SELECT DISTINCT list_date FROM players').fetchall()
            if count != expected['rows'] or count != int(metadata['rows']) or count <= 0:
                raise ValueError(f'Row count mismatch: {name}')
            if dates != [(expected['list_date'],)] or metadata['list_date'] != expected['list_date']:
                raise ValueError(f'List date mismatch: {name}')
        old = previous.get(name)
        dest = args.output / (name + '.zip')
        if old and old['databaseSha256'] == expected['sha256'] and dest.exists() and sha(dest) == old['zipSha256']:
            return {**old, 'url': f'https://github.com/{REPO}/releases/download/{args.tag}/{old["name"]}'}
        part = dest.with_suffix('.zip.part')
        with zipfile.ZipFile(part, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            z.write(source, name)
        with zipfile.ZipFile(part) as z:
            with z.open(name) as f:
                if hashlib.file_digest(f, 'sha256').hexdigest() != expected['sha256']:
                    raise ValueError(f'ZIP does not restore the original SQLite: {name}')
        if before != (source.stat().st_size, source.stat().st_mtime_ns):
            raise ValueError(f'Source changed during packaging: {name}')
        part.replace(dest)
        return {'period': expected['list_date'], 'rows': count, 'databaseName': name,
                'databaseBytes': expected['bytes'], 'databaseSha256': expected['sha256'],
                'name': dest.name, 'zipBytes': dest.stat().st_size, 'zipSha256': sha(dest),
                'url': f'https://github.com/{REPO}/releases/download/{args.tag}/{dest.name}',
                'metadata': metadata}

    rows = []
    with ThreadPoolExecutor(args.workers) as pool:
        futures = [pool.submit(package, source) for source in sources]
        for future in as_completed(futures):
            rows.append(future.result())
            if len(rows) % 20 == 0 or len(rows) == len(sources):
                print(f'Validated and packaged {len(rows)}/{len(sources)} periods', flush=True)
    rows.sort(key=lambda r: r['period'], reverse=True)
    if len({r['period'] for r in rows}) != len(rows):
        raise ValueError('Duplicate rating-list period')
    publication = {'schema': 1, 'ratingType': 'standard', 'repository': REPO,
                         'release': args.tag, 'sourceRevision': args.revision,
                         'sourceInventorySha256': sha(args.inventory),
                         'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                         'lists': rows}
    if all(previous_doc.get(k) == v for k, v in publication.items() if k != 'generated'):
        publication['generated'] = previous_doc['generated']
    save(previous_path, publication)
    print(f"Ready: {len(rows)} periods, {sum(r['rows'] for r in rows):,} rows, "
          f"{sum(r['zipBytes'] for r in rows):,} download bytes", flush=True)


def assets(release_id):
    pages = json.loads(gh('api', f'repos/{REPO}/releases/{release_id}/assets?per_page=100', '--paginate', '--slurp'))
    return {a['name']: a for page in pages for a in page}


def publish(args):
    manifest_path = args.output / 'standard-lists.json'
    doc = json.loads(manifest_path.read_text())
    if doc['release'] != args.tag or doc['sourceRevision'] != args.revision:
        raise ValueError('Prepared publication does not match release parameters')
    notes = args.output / 'release-notes.md'
    periods = sorted(row['period'] for row in doc['lists'])
    scope = f'{periods[0]} through {periods[-1]}'
    notes.write_text(
        f"Standard FIDE ratings: {len(doc['lists'])} separate period databases, "
        f"{sum(r['rows'] for r in doc['lists']):,} source rows, {scope}.\n\n"
        'Each ZIP contains one SQLite database with players and meta tables. '
        'All 22 original columns, nulls, duplicate records and source metadata are preserved. '
        'Only standard ratings are included. Historical partial/change lists remain partial; '
        'no missing dates or player values are inferred. Year-only dates retain that precision.\n\n'
        'standard-lists.json records period dates, row counts, database and ZIP SHA-256 hashes, '
        'source metadata and individual download URLs. Original player-list registries and '
        'alternate source files remain reference material outside this publication.\n', encoding='utf-8')
    result = subprocess.run(['gh', 'release', 'view', args.tag, '--repo', REPO,
                             '--json', 'databaseId,isDraft'], capture_output=True, text=True)
    if result.returncode:
        gh('release', 'create', args.tag, '--repo', REPO, '--draft', '--target', args.revision,
           '--title', f'Standard FIDE rating lists: {scope}', '--notes-file', notes)
        release = json.loads(gh('release', 'view', args.tag, '--repo', REPO, '--json', 'databaseId,isDraft'))
    else:
        release = json.loads(result.stdout)
    present = assets(release['databaseId'])
    expected = {r['name']: (r['zipBytes'], r['zipSha256']) for r in doc['lists']}
    expected[manifest_path.name] = (manifest_path.stat().st_size, sha(manifest_path))
    upload_gate = threading.Lock()
    next_upload = [0.0]

    def verify(asset, size, digest):
        if asset['size'] != size or asset.get('digest') != 'sha256:' + digest or asset['state'] != 'uploaded':
            raise ValueError(f"Remote asset mismatch: {asset['name']}")

    def send(item):
        name, (size, digest) = item
        if name in present:
            verify(present[name], size, digest)
            return name
        if not release['isDraft']:
            raise ValueError('Published release is incomplete; refusing to change it')
        path = args.output / name
        if path.stat().st_size != size or sha(path) != digest:
            raise ValueError(f'Local asset changed: {name}')
        for attempt in range(3):
            try:
                with upload_gate:
                    delay = max(0.0, next_upload[0] - time.monotonic())
                    next_upload[0] = time.monotonic() + delay + 0.9
                if delay:
                    time.sleep(delay)
                gh('release', 'upload', args.tag, path, '--repo', REPO)
                return name
            except subprocess.CalledProcessError:
                remote = assets(release['databaseId'])
                if name in remote:
                    verify(remote[name], size, digest)
                    return name
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)

    with ThreadPoolExecutor(args.workers) as pool:
        futures = [pool.submit(send, item) for item in expected.items()]
        for count, future in enumerate(as_completed(futures), 1):
            future.result()
            if count % 20 == 0 or count == len(expected):
                print(f'Uploaded {count}/{len(expected)} assets', flush=True)
    remote = assets(release['databaseId'])
    for name, (size, digest) in expected.items():
        verify(remote[name], size, digest)
    if release['isDraft']:
        gh('release', 'edit', args.tag, '--repo', REPO, '--draft=false', '--latest=false')
    print(f'Published and verified: https://github.com/{REPO}/releases/tag/{args.tag}', flush=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['prepare', 'publish'])
    p.add_argument('--source', type=Path, default=Path('D:/fide/fide-archive/sqlite'))
    p.add_argument('--inventory', type=Path, default=Path('D:/fide/fide-db-archive/data/inventory.json'))
    p.add_argument('--output', type=Path, default=Path('D:/fide/standard-list-downloads'))
    p.add_argument('--tag', default='standard-sqlite-2026-10')
    p.add_argument('--revision', default='71ec60e260324c157ab0f8f0fbd34b4519bc1da8')
    p.add_argument('--workers', type=int, default=4)
    a = p.parse_args()
    prepare(a) if a.command == 'prepare' else publish(a)
