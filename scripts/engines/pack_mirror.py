"""Build platform ZIPs from an explicitly reviewed list of release files."""

import json
import posixpath
import shutil
import stat
import tarfile
import zipfile
from collections import defaultdict
from pathlib import PurePosixPath

from stage_mirror import path_component, sha256


PLATFORMS = {'Windows', 'macOS', 'Linux', 'Android'}


def zip_entry(name, executable=False):
    info = zipfile.ZipInfo(name)
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    return info


def add_stream(output, name, stream, executable=False):
    with output.open(zip_entry(name, executable), 'w', force_zip64=True) as destination:
        shutil.copyfileobj(stream, destination)


def add_asset(output, asset, members):
    if not members:
        with asset.open('rb') as stream:
            add_stream(output, asset.name, stream, executable=True)
        return
    paths = [PurePosixPath(member) for member in members]
    if any(path.is_absolute() or any(path_component(part) != part for part in path.parts) for path in paths):
        raise ValueError('Unsafe path for an archive member')
    common = posixpath.commonpath([path.parent.as_posix() for path in paths])
    names = [path.relative_to(common or '.').as_posix() for path in paths]
    if len({name.casefold() for name in names}) != len(names):
        raise ValueError('Unsafe or duplicate output name for an archive member')
    if zipfile.is_zipfile(asset):
        with zipfile.ZipFile(asset) as archive:
            for index, (member, name) in enumerate(zip(members, names, strict=True)):
                info = archive.getinfo(member)
                if info.is_dir() or stat.S_ISLNK(info.external_attr >> 16):
                    raise ValueError(f'Expected a regular archive member: {member}')
                with archive.open(info) as stream:
                    add_stream(output, name, stream, executable=index == 0)
    else:
        with tarfile.open(asset) as archive:
            for index, (member, name) in enumerate(zip(members, names, strict=True)):
                info = archive.getmember(member)
                if not info.isfile():
                    raise ValueError(f'Expected a regular archive member: {member}')
                with archive.extractfile(info) as stream:
                    add_stream(output, name, stream, executable=index == 0)


def build_platform_packages(plan, sources, assets, release, review, original, output):
    engine = plan['engine']
    if path_component(engine) != engine:
        raise ValueError('Use a Drive-safe display name for the engine')
    support = plan.get('include', list(review['accompanying_sha256']))
    if not set(support) <= review['accompanying_sha256'].keys():
        raise ValueError('Include only files covered by the redistribution review')
    groups = defaultdict(dict)
    seen = set()
    for build in plan['builds']:
        platform, label, asset = (build[key] for key in ('platform', 'label', 'asset'))
        if platform not in PLATFORMS or path_component(label) != label or asset not in assets:
            raise ValueError(f'Invalid platform build: {build}')
        filename = f'{label}.zip'
        key = (platform, filename.casefold())
        if key in seen:
            raise ValueError(f'Duplicate platform ZIP name: {filename}')
        seen.add(key)
        directory = output / platform
        directory.mkdir(exist_ok=True)
        destination = directory / filename
        members = build.get('members', [])
        metadata = {
            'engine': engine, 'platform': platform, 'tag': release['tag'],
            'upstream_release': release['url'], 'original_release_and_source': original,
            'upstream_asset': assets[asset], 'upstream_members': members,
            'source_url': review['source_url'], 'license_notes': review['license_notes'],
        }
        with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
            add_asset(bundle, sources[asset], members)
            for name in sorted(support):
                with sources[name].open('rb') as stream:
                    add_stream(bundle, f'Notices and source/{name}', stream)
            bundle.writestr(zip_entry('Chess Nerd release.json'), json.dumps(metadata, indent=2) + '\n')
            bundle.writestr(zip_entry('Chess Nerd source.txt'),
                            f'{engine} {release["tag"]}\n\nOriginal release, notices and source\n{original}\n'
                            f'\nUpstream release\n{release["url"]}\n\n{review["license_notes"]}\n')
        with zipfile.ZipFile(destination) as bundle:
            names = bundle.namelist()
            if len(names) != len(set(names)) or bundle.testzip() is not None:
                raise ValueError(f'Invalid platform ZIP: {filename}')
        groups[platform][filename] = destination
    for platform, packages in groups.items():
        manifest = output / platform / 'SHA256SUMS.txt'
        manifest.write_bytes(''.join(f'{sha256(path)}  {name}\n' for name, path in sorted(packages.items())).encode())
        packages[manifest.name] = manifest
    return groups
