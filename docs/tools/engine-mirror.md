# Engine release mirror

The mirror starts with the Engine Releases feed generated on 7 November 2026 at
15:09 UTC (feed commit `99e5c22`). Add releases as later daily feeds discover
them, retaining earlier versions in Drive. The feed and its GitHub links remain
the source for the website. Users browse `platform/engine/tag` for individual
build ZIPs and their SHA-256 checksums. The untouched files live under
`Original releases/owner/repository/tag`, with a `mirror-manifest.json` that
records the upstream URL, asset IDs, sizes, hashes and redistribution notes.

## Stage files

Run from the repository root with Python 3.12+, an authenticated GitHub CLI
and curl. Use a single staging process per output directory.

```powershell
python scripts/engines/stage_mirror.py D:/chessnerd-engine-mirror
```

Pass `--feed` to stage a saved feed snapshot. For a targeted retry, pass
`--repo owner/repository`. The staging directory retains the input snapshots,
verified files, per-asset receipts, and a report for each run. An incomplete
run exits with an error. Retry against the same input to verify and reuse
completed files and fetch missing ones. To catch up after missing a day, use the
feed revisions on `origin/main` since the last captured snapshot in order.

## Publish a release

Review the exact tagged release and its bundles for redistribution terms. A
repository license label is a starting point. Record the notices and source
for included libraries, models and other components. Keep files with unclear
terms or incomplete corresponding source in local staging. For a reviewed
release, save a review JSON beside its accompanying license and source files.

| Review key | Value |
| --- | --- |
| `repo`, `tag`, `id` | Match the local `release.json` receipt |
| `license_notes` | Redistribution evidence and instructions for accompanying files |
| `source_url` | Upstream source URL for this exact version |
| `asset_sha256` | Object mapping every upstream asset ID to its verified SHA-256 |
| `accompanying_sha256` | Object mapping any extra filename to its SHA-256 |

For a desktop or Android release, place `packages.json` beside `review.json`.
Set `engine` to its display name and `builds` to a list of objects. Each build
has a `platform` (`Windows`, `macOS`, `Linux`, or `Android`), a `label` that
becomes the ZIP filename, and an `asset` matching the reviewed upstream file.
Include the architecture and CPU variant in `label` where applicable. For a
ZIP or tar archive, list the exact `members` to include, with the executable
first. Include runtime files needed by the build and check the upstream
relative paths before packaging. An asset without `members` is copied as-is
into its ZIP. Use the same engine display name for future versions.

The ZIP includes the reviewed accompanying files by default. An optional
`include` list selects a subset when the original public release folder
supplies the rest, as with large matching source packages. Each ZIP includes
the original release and source links. Confirm that users can reach the
required source and notices before publishing.

```powershell
python scripts/engines/publish_mirror.py D:/chessnerd-engine-mirror D:/path/to/review.json
```

The publisher validates the review against the receipts and staged bytes,
uploads to a private Drive staging folder, checks every Drive file against the
local size and MD5, and moves the verified release folder into the public
mirror. A retry verifies any already published copy. Keep the Drive staging
folder restricted. The default rclone remote is `gdrive:`.

The daily **Maintain the Chess Nerd engine mirror** task runs in the desktop
app on Ian's computer. It captures new feed snapshots and works through the
release review queue. The host and app need to be running for this task.
