from contextlib import closing
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('fide_sync', Path(__file__).parents[1] / 'sync_fide_monthly.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class FideTests(unittest.TestCase):
    def fixture(self, root):
        source = root / 'source'
        source.mkdir()
        period = '2026-11'
        tag = 'standard-sqlite-2026-11-monthly'
        name = 'fide-standard-2026-11.sqlite'
        sources = {}
        for kind in ('registry', 'standard', 'rapid', 'blitz'):
            source_name = 'players_list_xml.zip' if kind == 'registry' else kind + '_nov26frl_xml.zip'
            (source / source_name).write_bytes(b'fixture original')
            sources[kind] = {'name': source_name, 'url': 'https://ratings.fide.com/download/' + source_name, 'bytes': 16, 'sha256': sync.digest(b'fixture original')}
        metadata = {'schema': '1', 'list_date': period, 'rows': '1', 'source_file': sources['standard']['name'], 'source_sha256': sources['standard']['sha256']}
        with closing(sqlite3.connect(source / name)) as db:
            db.execute('CREATE TABLE players (' + ','.join(c + (' INTEGER' if c in sync.INTS else ' TEXT') for c in sync.COLUMNS) + ')')
            db.execute('INSERT INTO players (list_date,name,rating) VALUES (?,?,?)', (period, 'Test', 2600))
            db.execute('CREATE TABLE meta (key TEXT, value TEXT)')
            db.executemany('INSERT INTO meta VALUES (?,?)', metadata.items())
            db.commit()
        database = (source / name).read_bytes()
        with zipfile.ZipFile(source / (name + '.zip'), 'w') as archive:
            archive.writestr(name, database)
        zip_data = (source / (name + '.zip')).read_bytes()
        row = {'period': period, 'rows': 1, 'databaseName': name, 'databaseBytes': len(database), 'databaseSha256': sync.digest(database),
               'name': name + '.zip', 'zipBytes': len(zip_data), 'zipSha256': sync.digest(zip_data), 'release': tag, 'sourceRevision': 'a' * 40,
               'url': f'https://github.com/{sync.REPO}/releases/download/{tag}/{name}.zip', 'effectiveFrom': period + '-01T00:00:00Z', 'metadata': metadata}
        sync.save(source / 'players.json', [{'id': 1, 'name': 'Test', 'active': True, 'std': 2600, 'rapid': 0, 'blitz': 0}])
        sync.save(source / 'players.meta.json', {'period': period, 'count': 1, 'min_rating': 2500, 'sources': sources})
        # Reproduce Windows-origin release bytes even when tests run on Linux.
        for filename in ('players.json', 'players.meta.json'):
            path = source / filename
            path.write_bytes(path.read_bytes().rstrip(b'\r\n') + b'\r\n')
        assets = [{'name': p.name, 'bytes': p.stat().st_size, 'sha256': sync.digest(p.read_bytes())} for p in source.iterdir() if p.suffix != '.sqlite']
        sync.save(source / 'monthly.json', {'schema': 1, 'period': period, 'effectiveFrom': row['effectiveFrom'], 'repository': sync.REPO, 'release': tag,
                                           'sourceRevision': 'a' * 40, 'list': row, 'sources': sources, 'counts': {'standard': 1}, 'assets': assets})
        path = source / 'monthly.json'
        path.write_bytes(path.read_bytes().rstrip(b'\r\n') + b'\r\n')
        sync.save(root / 'public/data/fide-archive/standard-lists.json', {'lists': [{'period': '2026-10', 'rows': 1, 'url': 'existing-url'}]})
        sync.save(root / 'public/data/fide-players.meta.json', {'period': '2026-10'})
        sync.save(root / 'public/data/fide-players.json', [{'name': 'October'}])
        return source

    def test_preparation_and_activation_preserve_history(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.fixture(root)
            before = (root / 'public/data/fide-players.json').read_bytes()
            sync.sync('2026-11', root, source, datetime(2026, 10, 31, 23, 59, tzinfo=timezone.utc))
            self.assertEqual((root / 'public/data/fide-players.json').read_bytes(), before)
            self.assertEqual((root / 'public/data/fide-monthly/2026-11/players.json').read_bytes(), (source / 'players.json').read_bytes())
            self.assertEqual((root / 'public/data/fide-monthly/2026-11/players.meta.json').read_bytes(), (source / 'players.meta.json').read_bytes())
            self.assertEqual((root / 'public/data/fide-monthly/2026-11/monthly.json').read_bytes(), (source / 'monthly.json').read_bytes())
            catalog = json.loads((root / 'public/data/fide-archive/standard-lists.json').read_text())
            self.assertEqual(catalog['lists'][1]['url'], 'existing-url')
            sync.sync('2026-11', root, source, datetime(2026, 11, 1, tzinfo=timezone.utc))
            self.assertEqual(json.loads((root / 'public/data/fide-players.meta.json').read_text())['period'], '2026-11')

    def test_corrupt_download_blocks_all_public_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.fixture(root)
            before = {p: p.read_bytes() for p in (root / 'public').rglob('*') if p.is_file()}
            (source / 'players.json').write_text('[]')
            with self.assertRaises(ValueError):
                sync.sync('2026-11', root, source)
            self.assertEqual({p: p.read_bytes() for p in (root / 'public').rglob('*') if p.is_file()}, before)


if __name__ == '__main__':
    unittest.main()
