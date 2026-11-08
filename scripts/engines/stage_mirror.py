#!/usr/bin/env python3
"""Stage exact copies of the release assets recorded by the engine feed."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path, PureWindowsPath
from urllib.parse import quote, unquote, urlsplit

from update_engines import DEFAULT_OUTPUT


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def path_component(value):
    if not isinstance(value, str) or not value or value in {'.', '..'}:
        raise ValueError(f'Invalid path component: {value!r}')
    encoded = quote(value, safe=' ._-').rstrip('. ')
    suffix = value[len(value.rstrip('. ')):]
    encoded += ''.join(f'%{ord(character):02X}' for character in suffix)
    if PureWindowsPath(encoded).is_reserved():
        encoded = f'%{ord(encoded[0]):02X}{encoded[1:]}'
    return encoded


def valid_github_asset(url, repo, tag, name):
    parsed = urlsplit(url)
    expected = f'/{repo}/releases/download/{tag}/{name}'
    return (parsed.scheme == 'https' and parsed.netloc == 'github.com'
            and not parsed.query and not parsed.fragment
            and unquote(parsed.path).casefold() == expected.casefold())


def jobs_from_feed(feed):
    if feed['source'] != 'https://github.com' or feed['count'] != len(feed['engines']):
        raise ValueError('Invalid engine feed')
    seen = {}
    jobs = []
    for engine in feed['engines']:
        release = engine['latest_release']
        if not release or not release['assets']:
            continue
        repo = engine['repo']
        if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo, flags=re.ASCII):
            raise ValueError(f'Invalid repository: {repo}')
        tag = release['tag']
        relative = Path(*map(path_component, (*repo.split('/'), tag)))
        key = relative.as_posix().casefold()
        if key in seen:
            if seen[key] == (repo, release):
                continue
            raise ValueError(f'Colliding release path: {relative}')
        seen[key] = (repo, release)
        asset_paths = set()
        for asset in release['assets']:
            name, url, size = (asset[key] for key in ('name', 'url', 'size'))
            if type(size) is not int or size < 0 or not valid_github_asset(url, repo, tag, name):
                raise ValueError(f'Invalid asset: {repo} {tag} {name}')
            path = (relative / path_component(name)).as_posix().casefold()
            if path in asset_paths:
                raise ValueError(f'Colliding asset path: {path}')
            asset_paths.add(path)
        jobs.append((engine, release, relative))
    return jobs


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stage_asset(asset, upstream, directory, receipt_directory):
    name = asset['name']
    if upstream['size'] != asset['size'] or upstream['browser_download_url'] != asset['url']:
        raise ValueError('GitHub asset has changed since the feed snapshot')
    digest = upstream.get('digest')
    if digest and not re.fullmatch(r'sha256:[a-f0-9]{64}', digest):
        raise ValueError('Unsupported GitHub digest')
    receipt = receipt_directory / f"{upstream['id']}.json"
    destination = directory / path_component(name)
    previous = json.loads(receipt.read_text(encoding='utf-8')) if receipt.is_file() else {}
    if destination.is_file():
        checksum = sha256(destination)
        expected = digest or f"sha256:{previous.get('sha256')}"
        if destination.stat().st_size == asset['size'] and f'sha256:{checksum}' == expected:
            write_json(receipt, {**asset, 'id': upstream['id'], 'sha256': checksum,
                                 'upstream_digest': digest})
            return
        raise ValueError('Existing staged file differs from its upstream digest or receipt')

    temporary = receipt_directory / f"{upstream['id']}.part"
    subprocess.run([
        'curl', '--fail', '--silent', '--show-error', '--location',
        '--proto', '=https', '--proto-redir', '=https', '--connect-timeout', '20',
        '--speed-limit', '1024', '--speed-time', '60', '--retry', '2', '--retry-max-time', '180',
        '--output', str(temporary), asset['url'],
    ], check=True)
    checksum = sha256(temporary)
    if temporary.stat().st_size != asset['size'] or (digest and f'sha256:{checksum}' != digest):
        raise ValueError('Downloaded size or checksum differs from GitHub')
    write_json(receipt, {**asset, 'id': upstream['id'], 'sha256': checksum,
                         'upstream_digest': digest})
    temporary.replace(destination)


def stage_release(engine, release, relative, output, asset_workers):
    repo, tag = engine['repo'], release['tag']
    response = subprocess.run(['gh', 'api', f'repos/{repo}/releases/tags/{quote(tag, safe="")}'],
                              capture_output=True, check=False)
    if response.returncode:
        raise ValueError(response.stderr.decode('utf-8', errors='replace').strip())
    upstream = json.loads(response.stdout)
    if not upstream or upstream['html_url'] != release['url'] or upstream['tag_name'] != tag:
        raise ValueError('GitHub no longer returns the recorded release')
    directory = output / 'assets' / relative
    receipts = output / 'receipts' / relative
    directory.mkdir(parents=True, exist_ok=True)
    receipts.mkdir(parents=True, exist_ok=True)
    write_json(receipts / 'release.json', {
        'repo': repo, 'tag': tag, 'url': release['url'], 'id': upstream['id'],
        'published_at': release['published_at'], 'repository_license_hint': engine['license'],
        'source_zip_url': upstream['zipball_url'], 'source_tar_url': upstream['tarball_url'],
        'assets': release['assets'],
    })
    by_name = {asset['name']: asset for asset in upstream['assets']}

    def stage(asset):
        try:
            stage_asset(asset, by_name[asset['name']], directory, receipts)
        except (KeyError, OSError, ValueError, subprocess.SubprocessError) as exc:
            return {'asset': asset['name'], 'error': str(exc)}
        return None

    if asset_workers > 1:
        with ThreadPoolExecutor(max_workers=asset_workers) as pool:
            return [failure for failure in pool.map(stage, release['assets']) if failure]
    return [failure for asset in release['assets'] if (failure := stage(asset))]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--feed', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--repo', help='Stage only this owner/repository pair.')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    feed = json.loads(args.feed.read_text(encoding='utf-8'))
    jobs = jobs_from_feed(feed)
    if args.repo:
        jobs = [job for job in jobs if job[0]['repo'].casefold() == args.repo.casefold()]
        if not jobs:
            parser.error('No downloadable release for this repository in the feed')
    args.output.mkdir(parents=True, exist_ok=True)
    snapshots = args.output / 'snapshots'
    snapshots.mkdir(exist_ok=True)
    generated = feed['generated']
    if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', generated):
        raise ValueError('Invalid feed timestamp')
    snapshot = snapshots / f"{generated.replace(':', '')}.json"
    if snapshot.exists() and json.loads(snapshot.read_text(encoding='utf-8')) != feed:
        raise ValueError('A different feed is already staged for this timestamp')
    if not snapshot.exists():
        write_json(snapshot, feed)
    report = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {
            pool.submit(stage_release, engine, release, relative, args.output,
                        args.workers if args.repo else 1): (engine, release)
            for engine, release, relative in jobs
        }
        for future in as_completed(pending):
            engine, release = pending[future]
            try:
                failures = future.result()
            except (KeyError, OSError, ValueError, RuntimeError) as exc:
                failures = [{'error': str(exc)}]
            count = len(release['assets'])
            label = 'needs attention' if failures else f'{count} verified'
            print(f"{engine['repo']} {release['tag']}: {label}", flush=True)
            report.append({'repo': engine['repo'], 'tag': release['tag'],
                           'asset_count': count, 'failures': failures})
    scope = f"-{path_component(args.repo)}" if args.repo else ''
    write_json(args.output / f'{snapshot.stem}{scope}-report.json', sorted(report, key=lambda row: row['repo']))
    return int(any(row['failures'] for row in report))


if __name__ == '__main__':
    sys.exit(main())
