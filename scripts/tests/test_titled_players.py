import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch, Mock
from datetime import datetime, timezone, timedelta

spec = importlib.util.spec_from_file_location('titled_sync', Path(__file__).parents[1] / 'sync-titled-players.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class TitledTests(unittest.TestCase):
    def setUp(self):
        sync.deadline = float('inf')

    def test_stats_failure_preserves_old_ratings_and_timestamp(self):
        old = {'username': 'test', 'rapid': 2700, 'updated_at': '2026-10-01T00:00:00Z'}
        with patch.object(sync, 'safe_request', side_effect=RuntimeError('network')):
            with self.assertRaises(RuntimeError):
                sync.get_player_data('test', 'GM', old)
        self.assertEqual(old['rapid'], 2700)
        self.assertEqual(old['updated_at'], '2026-10-01T00:00:00Z')

    def test_profile_failure_does_not_commit_partial_stats(self):
        old = {'rapid': 2700}
        with patch.object(sync, 'safe_request', side_effect=[{'chess_rapid': {'last': {'rating': 2800}}}, ValueError('HTTP 404')]):
            with self.assertRaises(ValueError):
                sync.get_player_data('test', 'GM', old)
        self.assertEqual(old, {'rapid': 2700})

    def test_daily_stats_and_weekly_profile(self):
        now = sync.utc_now()
        self.assertFalse(sync.stats_current({'fetch_ok': True, 'updated_at': now.isoformat()}, now))
        old = {'fetch_ok': True, 'stats_updated_at': now.isoformat(), 'profile_updated_at': now.isoformat(), 'name': 'Known'}
        self.assertTrue(sync.stats_current(old, now))
        self.assertFalse(sync.stats_current(old, now + timedelta(days=1)))
        with patch.object(sync, 'safe_request', return_value={}) as request:
            data = sync.get_player_data('test', 'GM', old)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(data['rapid'], 0)  # Successful empty stats means unrated.
        self.assertEqual(data['name'], 'Known')

    def test_rate_limit_is_bounded(self):
        response = Mock(status_code=429, headers={'Retry-After': '120'})
        sync.deadline = time.monotonic() + 1
        with patch.object(sync.session, 'get', return_value=response), patch.object(sync.time, 'sleep') as sleep:
            with self.assertRaises(TimeoutError):
                sync.safe_request('https://api.chess.com/pub/player/test/stats')
        sleep.assert_not_called()

    def test_stats_404_is_not_an_unrated_player(self):
        old = {'username': 'test', 'rapid': 2700, 'stats_updated_at': '2026-10-01T00:00:00Z'}
        response = Mock(status_code=404)
        with patch.object(sync.session, 'get', return_value=response) as request, patch.object(sync.time, 'sleep') as sleep:
            with self.assertRaisesRegex(sync.NotFound, 'API HTTP 404'):
                sync.get_player_data('test', 'GM', old)
        request.assert_called_once()
        sleep.assert_not_called()
        self.assertEqual(old['rapid'], 2700)
        self.assertEqual(old['stats_updated_at'], '2026-10-01T00:00:00Z')

    def test_timeout_saves_checkpoint_and_same_day_retry_resumes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output, meta, checkpoint = (root / name for name in ('public.json', 'meta.json', 'checkpoint.json'))
            old = [{'username': user, 'title': 'GM', 'rapid': 2700,
                    'stats_updated_at': '2026-10-01T00:00:00Z'} for user in ('alice', 'bob')]
            output.write_text(json.dumps(old))
            meta.write_text('{"previous":true}')
            before = output.read_bytes(), meta.read_bytes()
            now = datetime(2026, 10, 24, 6, tzinfo=timezone.utc)

            def request(url):
                if '/titled/' in url:
                    return {'players': ['alice', 'bob']}
                if url.endswith('/stats'):
                    return {'chess_rapid': {'last': {'rating': 2800}}}
                if url.endswith('/bob'):
                    raise TimeoutError('Refresh time limit reached')
                return {'username': 'alice', 'status': 'basic'}

            with patch.multiple(sync, OUTPUT_FILE=output, META_FILE=meta, CHECKPOINT_FILE=checkpoint), patch.object(sync, 'utc_now', return_value=now):
                # Time out after one complete player and the next player's stats.
                with patch.object(sync, 'safe_request', side_effect=request):
                    with self.assertRaises(TimeoutError):
                        sync.main()
                self.assertEqual((output.read_bytes(), meta.read_bytes()), before)
                saved = sync.load(checkpoint)
                self.assertEqual(saved['alice']['rapid'], 2800)
                self.assertTrue(sync.stats_current(saved['alice'], now))
                self.assertEqual(saved['bob'], old[1])

                def retry(url):
                    if url.endswith('/bob'):
                        return {'username': 'bob', 'status': 'basic'}
                    return request(url)

                with patch.object(sync, 'safe_request', side_effect=retry) as resumed:
                    sync.main()
                self.assertFalse(any('/player/alice' in call.args[0] for call in resumed.call_args_list))
                self.assertEqual(len(sync.load(output)), 2)
                self.assertEqual(json.loads(meta.read_text())['refreshed'], 1)

    def run_404_fixture(self, root, players, missing):
        output, meta, checkpoint = (root / name for name in ('public.json', 'meta.json', 'checkpoint.json'))
        output.write_text(json.dumps([{'username': u, 'title': 'GM', 'rapid': 2700} for u in players]))
        meta.write_text('{"previous":true}')

        def request(url):
            if '/titled/' in url:
                return {'players': players}
            username = url.split('/player/')[1].split('/')[0]
            if username in missing:
                raise sync.NotFound(f'API HTTP 404: {url}')
            if url.endswith('/stats'):
                return {'chess_rapid': {'last': {'rating': 2800}}}
            return {'username': username, 'status': 'basic'}

        patches = patch.multiple(sync, OUTPUT_FILE=output, META_FILE=meta, CHECKPOINT_FILE=checkpoint)
        return output, meta, checkpoint, patches, request

    def test_404_players_are_omitted_and_counted(self):
        with tempfile.TemporaryDirectory() as temp:
            players = [f'p{i:03}' for i in range(200)]
            output, meta, checkpoint, patches, request = self.run_404_fixture(Path(temp), players, {'p007'})
            with patches, patch.object(sync, 'safe_request', side_effect=request):
                sync.main()
            published = sync.load(output)
            self.assertEqual(len(published), 199)
            self.assertNotIn('p007', published)
            self.assertEqual(json.loads(meta.read_text())['unavailable'], ['p007'])
            self.assertEqual(sync.load(checkpoint)['p007']['rapid'], 2700)

    def test_widespread_404s_block_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            output, meta, checkpoint, patches, request = self.run_404_fixture(Path(temp), ['test'], {'test'})
            before = output.read_bytes(), meta.read_bytes()
            with patches, patch.object(sync, 'safe_request', side_effect=request):
                with self.assertRaisesRegex(RuntimeError, 'Unavailable guard'):
                    sync.main()
            self.assertEqual((output.read_bytes(), meta.read_bytes()), before)
            self.assertEqual(sync.load(checkpoint)['test']['rapid'], 2700)

    def test_invalid_response_blocks_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output, meta, checkpoint = (root / name for name in ('public.json', 'meta.json', 'checkpoint.json'))
            output.write_text(json.dumps([{'username': 'test', 'title': 'GM', 'rapid': 2700}]))
            meta.write_text('{"previous":true}')
            before = output.read_bytes(), meta.read_bytes()

            def request(url):
                if '/titled/' in url:
                    return {'players': ['test']}
                raise ValueError('API HTTP 403')

            with patch.multiple(sync, OUTPUT_FILE=output, META_FILE=meta, CHECKPOINT_FILE=checkpoint), patch.object(sync, 'safe_request', side_effect=request):
                with self.assertRaisesRegex(RuntimeError, 'Incomplete daily snapshot'):
                    sync.main()
            self.assertEqual((output.read_bytes(), meta.read_bytes()), before)
            self.assertEqual(sync.load(checkpoint)['test']['rapid'], 2700)

    def run_fixture(self, root, failed=False, bad_title=False):
        output = root / 'public.json'
        meta = root / 'meta.json'
        checkpoint = root / 'checkpoint.json'
        old = [{'username': 'test', 'title': 'GM', 'rapid': 2700, 'updated_at': '2026-10-01T00:00:00Z'}]
        output.write_text(json.dumps(old))
        before = output.read_bytes()

        def request(url):
            if '/titled/' in url:
                return {'players': [] if bad_title else ['test']}
            if failed:
                raise RuntimeError('API failure')
            if url.endswith('/stats'):
                return {'chess_rapid': {'last': {'rating': 2800}}}
            return {'username': 'test', 'status': 'basic', 'country': 'https://api.chess.com/pub/country/US'}

        with patch.multiple(sync, OUTPUT_FILE=output, META_FILE=meta, CHECKPOINT_FILE=checkpoint), patch.object(sync, 'safe_request', side_effect=request):
            if failed or bad_title:
                with self.assertRaises((RuntimeError, ValueError)):
                    sync.main()
                self.assertEqual(output.read_bytes(), before)
                self.assertFalse(meta.exists())
            else:
                sync.main()
                self.assertEqual(json.loads(output.read_text())[0]['rapid'], 2800)
                self.assertEqual(json.loads(meta.read_text())['failed'], 0)
                self.assertTrue(checkpoint.exists())

    def test_only_complete_snapshots_are_published(self):
        for options in ({}, {'failed': True}, {'bad_title': True}):
            with self.subTest(options=options), tempfile.TemporaryDirectory() as temp:
                self.run_fixture(Path(temp), **options)


if __name__ == '__main__':
    unittest.main()
