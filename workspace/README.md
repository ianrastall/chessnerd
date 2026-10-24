# File Chess.com PGNs

Put downloaded PGNs in this folder, then double-click **File PGNs.bat**.
It previews the imports and asks once before filing. Keep the original download
filenames for Titled Tuesday, Bullet Brawl and 3-0 Thursday. CCC files can have
any filename; the importer reads their event tags.

The script uses each archive's existing importer, pulls and pushes the archive
repositories, then syncs the website manifests, runs tests and builds before
committing and pushing the website. A failed sync or check stops website
publication. The GitHub Pages workflow validates the deployment again.
Already archived files are checked against the archive, GitHub and the live
site. Different copies stay in the inbox for review.

```powershell
python workspace/file_pgns.py --dry-run  # Preview local archives; no pull or writes
python workspace/file_pgns.py --yes     # File without the confirmation prompt
python -m unittest discover -s workspace  # Check preview and publication safeguards
```

Run these commands from the website root. The batch launcher also accepts
`--dry-run` and `--yes`, and works regardless of the current directory.

Python 3.12+, Git and the website's Node/npm installation are required; run
`npm ci` in the website checkout if its dependencies are missing. The archive
checkouts stay under `D:/dev/proj/chessnerd` with their independent Git histories.
Set `CHESSNERD_ARCHIVE_ROOT` to override that location if they move.

Other Chess.com event exports use the existing `cc-events-archive` pipeline,
its `cc-events` inbox and `D:/dev/proj/ctml/.venv/Scripts/python.exe` environment.
That pipeline applies its existing selection rules and publishes prepared
databases. Historical PgnTours files use their separate CTML workflow.

Filed originals go in `filed/`; this inbox, filed originals and `import-log.md`
are local files excluded from Git. Import failures leave diagnostics in the
terminal. If a commit or push fails after import, inspect the named archive
checkout before retrying; earlier unpushed commits are retried on the next run.

Restored from `D:/dev/proj/chessnerd/workspace/file_pgns.py` and its batch launcher
on 23 October 2026. The old checkout and its import history remain intact.
