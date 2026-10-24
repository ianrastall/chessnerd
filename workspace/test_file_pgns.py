"""Publication and preview checks: python -m unittest discover -s workspace."""
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import file_pgns as filing


def completed(code=0, stdout='', stderr=''):
    return subprocess.CompletedProcess([], code, stdout, stderr)


class WorkspaceTests(unittest.TestCase):
    def test_dry_run_does_not_pull_import_or_move(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pgn = root / '2026-titled-tuesday-blitz-october-20.pgn'
            pgn.write_text('[Event "Titled Tuesday"]\n')
            def preview(key, items):
                items[0].zip = 'titled-tuesday_2026-10-20.zip'
                items[0].games = 2000
                return items, []
            with patch.object(filing, 'HERE', root), \
                 patch.object(filing, 'git', return_value=completed(stdout='0')) as git, \
                 patch.object(filing, 'prepare_repo', return_value=None) as prepare, \
                 patch.object(filing, 'preview', side_effect=preview), \
                 patch.object(filing, 'concerns', return_value=[]), \
                 patch.object(filing, 'file_series') as write, \
                 patch('sys.argv', ['file_pgns.py', '--dry-run']):
                self.assertEqual(filing.main(), 0)
                self.assertTrue(pgn.exists())
                write.assert_not_called()
                self.assertTrue(all(call.kwargs == {'pull': False} for call in prepare.call_args_list))
                self.assertFalse(any(call.args[1] in ('pull', 'push', 'add', 'commit') for call in git.call_args_list))

    def test_sync_or_validation_failure_never_stages_or_pushes(self):
        for failure in range(3):  # sync, unit tests, build
            with self.subTest(failure=failure), \
                 patch.object(filing, 'prepare_repo', return_value=None), \
                 patch.object(filing, 'git', return_value=completed()) as git, \
                 patch.object(filing, 'run', side_effect=[completed()] * failure + [completed(1, stderr='failed')]):
                self.assertFalse(filing.sync_site(['tt'], 'October 20, 2026'))
                self.assertEqual([call.args[1:] for call in git.call_args_list], [('diff', '--cached', '--quiet')])

    def test_missing_repository_is_blocked(self):
        with patch.object(filing, 'git', return_value=completed(128, stderr='not a repository')) as git:
            self.assertIn('cannot read repository', filing.prepare_repo(Path('missing')))
            self.assertEqual(git.call_count, 1)

    def test_log_created_locally(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(filing, 'RUNBOOK', Path(folder) / 'import-log.md'):
            self.assertIn('| Date done | Added |', filing.read_import_log())

    def test_repeated_filename_keeps_both_originals(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / '514.pgn'
            filed = root / 'filed'
            filed.mkdir()
            (filed / source.name).write_text('earlier download')
            source.write_text('new download')
            filing.move_original(source, filed)
            self.assertEqual((filed / '514.pgn').read_text(), 'earlier download')
            self.assertEqual((filed / '514.1.pgn').read_text(), 'new download')


if __name__ == '__main__':
    unittest.main()
