"""Consume verified monthly releases from the independent FIDE archive.

Future data is staged under versioned URLs. Legacy current URLs change only
after the effective UTC date. Existing archive periods/URLs are never replaced.
Any download, digest, schema or provenance failure stops before writing files.
"""
import argparse
import calendar
from contextlib import closing
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import sqlite3
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
REPO = 'ianrastall/fide-db-archive'
SHA = re.compile('[a-f0-9]{64}')
COLUMNS = 'list_date line_no rank rank_note fide_id name fed sex title w_title o_title foa_title title_raw rating change games k birth_year birth_date birth_raw flag section'.split()
INTS = set('line_no rank fide_id rating change games k birth_year'.split())


def target_period(now):
    if now.day == calendar.monthrange(now.year, now.month)[1]:
        return (now.replace(day=1) + timedelta(days=32)).strftime('%Y-%m')
    return now.strftime('%Y-%m') if now.day <= 2 else None


def digest(data):
    return hashlib.sha256(data).hexdigest()


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'ChessNerd-FIDE-monthly/1.0'})
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read()


def save(path, value, indent=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    options = {'indent': indent} if indent is not None else {'separators': (',', ':')}
    temp.write_text(json.dumps(value, ensure_ascii=False, **options) + '\n', encoding='utf-8')
    temp.replace(path)


def save_bytes(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_bytes(data)
    temp.replace(path)


def sync(period, root=ROOT, directory=None, now=None):
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', period):
        raise ValueError('Invalid monthly period')
    now = now or datetime.now(timezone.utc)
    tag = f'standard-sqlite-{period}-monthly'
    base = f'https://github.com/{REPO}/releases/download/{tag}/'
    release = None
    if directory:
        receipt_data = (directory / 'monthly.json').read_bytes()
    else:
        release = json.loads(download(f'https://api.github.com/repos/{REPO}/releases/tags/{tag}'))
        if release['draft'] or release['prerelease'] or release['tag_name'] != tag:
            raise ValueError('Monthly release is not published')
        receipt_data = download(base + 'monthly.json')
        asset = next(a for a in release['assets'] if a['name'] == 'monthly.json')
        if asset.get('digest') != 'sha256:' + digest(receipt_data) or asset['size'] != len(receipt_data):
            raise ValueError('Monthly receipt does not match release digest')
    receipt = json.loads(receipt_data)
    effective = period + '-01T00:00:00Z'
    if receipt['schema'] != 1 or receipt['period'] != period or receipt['repository'] != REPO or receipt['release'] != tag or receipt['effectiveFrom'] != effective or not re.fullmatch('[a-f0-9]{40}', receipt['sourceRevision']):
        raise ValueError('Invalid monthly release provenance')
    assets = {a['name']: a for a in receipt['assets']}
    if len(assets) != len(receipt['assets']):
        raise ValueError('Duplicate monthly assets')
    for name, expected in assets.items():
        if Path(name).name != name or not SHA.fullmatch(expected['sha256']) or expected['bytes'] <= 0:
            raise ValueError('Invalid monthly asset')
        if release:
            actual = next(a for a in release['assets'] if a['name'] == name)
            if actual['size'] != expected['bytes'] or actual.get('digest') != 'sha256:' + expected['sha256']:
                raise ValueError(f'Monthly server asset mismatch: {name}')

    def read(name):
        expected = assets[name]
        data = (directory / name).read_bytes() if directory else download(base + name)
        if len(data) != expected['bytes'] or digest(data) != expected['sha256']:
            raise ValueError(f'Monthly download mismatch: {name}')
        return data

    row = receipt['list']
    db_name = f'fide-standard-{period}.sqlite'
    if row['period'] != period or row['release'] != tag or row['sourceRevision'] != receipt['sourceRevision'] or row['effectiveFrom'] != effective or row['databaseName'] != db_name or row['name'] != db_name + '.zip' or row['url'] != base + row['name']:
        raise ValueError('Invalid standard-rating download')
    if row['rows'] <= 0 or row['rows'] != receipt['counts']['standard'] or row['metadata']['list_date'] != period or row['metadata']['rows'] != str(row['rows']):
        raise ValueError('Invalid standard-rating row count')
    if assets[row['name']]['sha256'] != row['zipSha256'] or assets[row['name']]['bytes'] != row['zipBytes']:
        raise ValueError('Standard ZIP manifest mismatch')
    with zipfile.ZipFile(io.BytesIO(read(row['name']))) as archive:
        if archive.namelist() != [db_name]:
            raise ValueError('Unexpected SQLite ZIP contents')
        database = archive.read(db_name)
    if digest(database) != row['databaseSha256'] or len(database) != row['databaseBytes']:
        raise ValueError('SQLite digest mismatch')
    with closing(sqlite3.connect(':memory:')) as db:
        db.deserialize(database)
        columns = db.execute('PRAGMA table_info(players)').fetchall()
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or [(r[1], r[2]) for r in columns] != [(c, 'INTEGER' if c in INTS else 'TEXT') for c in COLUMNS]:
            raise ValueError('SQLite schema or integrity failure')
        if db.execute('SELECT count(*) FROM players').fetchone()[0] != row['rows'] or db.execute('SELECT DISTINCT list_date FROM players').fetchall() != [(period,)]:
            raise ValueError('SQLite period/count mismatch')
        if dict(db.execute('SELECT * FROM meta')) != row['metadata']:
            raise ValueError('SQLite metadata mismatch')
    players_data, meta_data = read('players.json'), read('players.meta.json')
    players, meta = json.loads(players_data), json.loads(meta_data)
    if not isinstance(players, list) or not players or meta['period'] != period or meta['count'] != len(players) or meta['min_rating'] != 2500 or meta['sources'] != receipt['sources']:
        raise ValueError('Invalid 2500+ metadata')
    ids = set()
    for p in players:
        if not isinstance(p['id'], int) or p['id'] <= 0 or p['id'] in ids or not p['name'] or not isinstance(p['active'], bool):
            raise ValueError('Invalid/duplicate 2500+ player')
        ids.add(p['id'])
        if any(type(p[k]) is not int or not 0 <= p[k] <= 4000 for k in ('std', 'rapid', 'blitz')) or max(p[k] for k in ('std', 'rapid', 'blitz')) < 2500:
            raise ValueError('Invalid 2500+ rating')
    dt = datetime.strptime(period, '%Y-%m')
    suffix = calendar.month_abbr[dt.month].lower() + dt.strftime('%y') + 'frl_xml.zip'
    for kind in ('registry', 'standard', 'rapid', 'blitz'):
        source = receipt['sources'][kind]
        name = 'players_list_xml.zip' if kind == 'registry' else kind + '_' + suffix
        if source['url'] != 'https://ratings.fide.com/download/' + name or source['sha256'] != assets[name]['sha256'] or source['bytes'] != assets[name]['bytes']:
            raise ValueError('Invalid FIDE source provenance')
    if row['metadata']['source_sha256'] != receipt['sources']['standard']['sha256']:
        raise ValueError('Standard source hash mismatch')

    public = root / 'public/data'
    catalog = json.loads((public / 'fide-archive/standard-lists.json').read_text(encoding='utf-8'))
    original_catalog = json.dumps(catalog)
    existing = next((r for r in catalog['lists'] if r['period'] == period), None)
    if existing:
        if existing['rows'] != row['rows']:
            raise ValueError('Existing archive period has a different row count; review before updating')
        if existing.get('release') == tag and existing['zipSha256'] != row['zipSha256']:
            raise ValueError('Published monthly archive changed')
    else:
        catalog['lists'].append(row)
        catalog['lists'].sort(key=lambda r: r['period'], reverse=True)
    index_path = public / 'fide-monthly.json'
    index = json.loads(index_path.read_text()) if index_path.exists() else {'schema': 1, 'snapshots': []}
    entry = {'period': period, 'effectiveFrom': effective, 'data': f'/data/fide-monthly/{period}/players.json',
             'meta': f'/data/fide-monthly/{period}/players.meta.json', 'dataSha256': digest(players_data), 'metaSha256': digest(meta_data),
             'receipt': base + 'monthly.json'}
    old_entry = next((e for e in index['snapshots'] if e['period'] == period), None)
    if old_entry and old_entry != entry:
        raise ValueError('Previously staged monthly snapshot changed')
    index['snapshots'] = sorted([e for e in index['snapshots'] if e['period'] != period] + [entry], key=lambda e: e['period'])
    # All network, checksum and schema checks finish before any public write.
    save_bytes(public / f'fide-monthly/{period}/players.json', players_data)
    save_bytes(public / f'fide-monthly/{period}/players.meta.json', meta_data)
    save_bytes(public / f'fide-monthly/{period}/monthly.json', receipt_data)
    if json.dumps(catalog) != original_catalog:
        save(public / 'fide-archive/standard-lists.json', catalog, indent=1)
    save(index_path, index)
    if effective <= now.strftime('%Y-%m-%dT%H:%M:%SZ'):
        # Never let a manual backfill replace a newer current snapshot.
        current = json.loads((public / 'fide-players.meta.json').read_text())
        if current.get('period', '') <= period:
            save(public / 'fide-players.json', players)
            save(public / 'fide-players.meta.json', meta)
    print(f'Verified and staged {period}: {row["rows"]:,} standard rows, {len(players):,} 2500+ players')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--period')
    parser.add_argument('--directory', type=Path, help='Read locally verified producer output instead of GitHub')
    args = parser.parse_args()
    period = args.period or target_period(datetime.now(timezone.utc))
    if period:
        sync(period, directory=args.directory)
    else:
        print('No monthly preparation or recovery scheduled today.')


if __name__ == '__main__':
    main()
