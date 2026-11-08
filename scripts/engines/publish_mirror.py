#!/usr/bin/env python3
"""Publish one reviewed release to the Chess Nerd Google Drive mirror."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from pack_mirror import build_platform_packages
from stage_mirror import path_component, sha256


def rclone(*args, capture=False):
    return subprocess.run(['rclone', *map(str, args)], capture_output=capture, check=True).stdout


def validate_review(root, review):
    relative = Path(*map(path_component, (*review['repo'].split('/'), review['tag'])))
    receipts = root / 'receipts' / relative
    release = json.loads((receipts / 'release.json').read_text(encoding='utf-8'))
    if any(review[key] != release[key] for key in ('repo', 'tag', 'id')):
        raise ValueError('Review refers to a different upstream release')
    if not review['license_notes'].strip() or not review['source_url'].startswith('https://'):
        raise ValueError('Review must record the redistribution terms and source')

    assets = {}
    for receipt_path in sorted(receipts.glob('[0-9]*.json')):
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        name = path_component(receipt['name'])
        path = root / 'assets' / relative / name
        if path.stat().st_size != receipt['size'] or sha256(path) != receipt['sha256']:
            raise ValueError(f'Staged bytes differ from receipt for {name}')
        assets[name] = receipt
    def identity(asset):
        return asset['name'], asset['url'], asset['size']

    if {identity(asset) for asset in assets.values()} != {identity(asset) for asset in release['assets']}:
        raise ValueError('Staged files do not cover the release')
    if {str(asset['id']): asset['sha256'] for asset in assets.values()} != review['asset_sha256']:
        raise ValueError('Review does not cover the staged asset IDs and checksums')
    return relative, release, assets


def verify_remote(remote, sources):
    entries = json.loads(rclone('lsjson', remote, '--hash', '--hash-type', 'MD5', capture=True))
    if len(entries) != len(sources) or {entry['Name'] for entry in entries} != sources.keys():
        raise ValueError(f'Unexpected file inventory at {remote}')
    for entry in entries:
        path = sources[entry['Name']]
        with path.open('rb') as stream:
            checksum = hashlib.file_digest(stream, lambda: hashlib.md5(usedforsecurity=False)).hexdigest()
        if (entry['IsDir'] or entry['Size'] != path.stat().st_size
                or entry.get('Hashes', {}).get('md5') != checksum):
            raise ValueError(f'Drive checksum mismatch for {entry["Name"]}')


def publish_files(public, staging, sources, original_manifest=None):
    status = subprocess.run(['rclone', 'lsjson', public, '--stat'], capture_output=True)
    if status.returncode == 3:
        directories = defaultdict(list)
        for name, source in sources.items():
            if source.name != name or '\n' in name or '\r' in name:
                raise ValueError(f'Invalid upload filename: {name}')
            directories[source.parent].append(name)
        with tempfile.TemporaryDirectory() as temp:
            files = Path(temp) / 'files.txt'
            for directory, names in directories.items():
                files.write_bytes(('\n'.join(names) + '\n').encode('utf-8'))
                rclone('copy', directory, staging, '--files-from-raw', files,
                       '--immutable', '--checksum', '--drive-chunk-size', '32M',
                       '--transfers', '2', '--checkers', '2', '--tpslimit', '8')
        verify_remote(staging, sources)
        rclone('moveto', staging, public, '--immutable')
    else:
        status.check_returncode()
        if original_manifest:
            remote_bytes = rclone('cat', f'{public}/mirror-manifest.json', capture=True)
            remote_manifest = json.loads(remote_bytes)
            if stable_manifest(remote_manifest) != stable_manifest(original_manifest):
                raise ValueError(f'Existing Drive manifest differs from the reviewed release at {public}')
            sources['mirror-manifest.json'].write_bytes(remote_bytes)
    verify_remote(public, sources)


def stable_manifest(manifest):
    return {**manifest, 'assets': {
        name: {key: value for key, value in asset.items() if key != 'downloads'}
        for name, asset in manifest['assets'].items()
    }}


def drive_folder_url(remote):
    parent, _, name = remote.rpartition('/')
    entries = json.loads(rclone('lsjson', parent, '--dirs-only', capture=True))
    matches = [entry['ID'] for entry in entries if entry['Name'] == name and entry.get('ID')]
    if len(matches) != 1:
        raise ValueError(f'Cannot identify the original Drive release folder at {remote}')
    return f'https://drive.google.com/drive/folders/{matches[0]}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path, help='Local staging root.')
    parser.add_argument('review', type=Path, help='Review JSON and directory containing any accompanying files.')
    parser.add_argument('--drive', default='gdrive:', help='Rclone Drive remote, including the colon.')
    parser.add_argument('--packages', type=Path, help='Reviewed platform and build layout JSON.')
    args = parser.parse_args()
    review = json.loads(args.review.read_text(encoding='utf-8'))
    package_file = args.packages or args.review.with_name('packages.json')
    plan = json.loads(package_file.read_text(encoding='utf-8')) if args.packages or package_file.is_file() else None
    relative, release, assets = validate_review(args.root, review)
    sources = {name: args.root / 'assets' / relative / name for name in assets}
    for name, digest in review['accompanying_sha256'].items():
        if name in sources or name == 'mirror-manifest.json' or path_component(name) != name:
            raise ValueError(f'Invalid accompanying filename: {name}')
        path = args.review.parent / name
        if sha256(path) != digest:
            raise ValueError(f'Accompanying file differs from review: {name}')
        sources[name] = path
    if 'mirror-manifest.json' in sources:
        raise ValueError('Upstream asset name conflicts with the mirror manifest')

    if not args.drive.endswith(':'):
        parser.error('Specify an rclone remote ending in a colon')
    base = args.drive
    public_root = f'{base}Chess Nerd Engine Releases'
    public = f'{public_root}/Original releases/{relative.as_posix()}'
    staging = f'{base}Chess Nerd Engine Releases Staging/{relative.as_posix()}'
    with tempfile.TemporaryDirectory() as temp:
        manifest = Path(temp) / 'mirror-manifest.json'
        original_manifest = {
            **{key: release[key] for key in ('repo', 'tag', 'id', 'url', 'published_at')},
            'source_url': review['source_url'], 'license_notes': review['license_notes'],
            'assets': assets, 'accompanying_sha256': review['accompanying_sha256'],
        }
        manifest.write_text(json.dumps(original_manifest, indent=2) + '\n', encoding='utf-8')
        sources[manifest.name] = manifest
        publish_files(public, staging, sources, original_manifest)
        print(f'Verified {len(assets)} upstream assets for {relative.as_posix()}', flush=True)
        if plan:
            published_assets = json.loads(manifest.read_bytes())['assets']
            groups = build_platform_packages(plan, sources, published_assets, release, review,
                                             drive_folder_url(public), Path(temp))
            with ThreadPoolExecutor(max_workers=2) as pool:
                publications = []
                for platform, packages in groups.items():
                    path = f'{platform}/{plan["engine"]}/{relative.name}'
                    publications.append(pool.submit(publish_files, f'{public_root}/{path}',
                                                    f'{base}Chess Nerd Engine Releases Staging/Platforms/{path}',
                                                    packages))
                for publication in publications:
                    publication.result()
            print(f'Verified {sum(len(files) - 1 for files in groups.values())} platform ZIPs for {relative.as_posix()}')


if __name__ == '__main__':
    main()
