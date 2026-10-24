#!/usr/bin/env python3
"""Prepare verified, independent FIDE ZIP bundles and upload them to Pixeldrain.

Credentials stay outside the repository. Upload receipts are saved after each
verified upload, so rerunning skips completed uploads. No site files are changed.
"""
import argparse
import base64
import hashlib
import http.client
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import zipfile


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(4 * 1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def save(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def prepare(store, output, limit):
    manifest = json.loads((store / 'manifest.json').read_text(encoding='utf-8'))
    groups = {}
    seen = set()
    for row in manifest['files']:
        relative = Path(row['path'])
        if relative.is_absolute() or '..' in relative.parts or row['path'] in seen:
            raise ValueError('Unsafe or duplicate manifest path')
        seen.add(row['path'])
        source = store / relative
        if source.stat().st_size != row['bytes'] or digest(source) != row['sha256']:
            raise ValueError(f"Source checksum mismatch: {row['path']}")
        groups.setdefault((row['source'], row['period'][:4] or 'undated'), []).append(row)
    batches = []
    batch = []
    size = 0
    previous_source = None
    for (source, year), rows in sorted(groups.items()):
        group_size = sum(row['bytes'] for row in rows)
        if group_size > limit:
            raise ValueError(f'{source}/{year} exceeds bundle size; increase --max-bytes')
        if batch and (source != previous_source or size + group_size > limit):
            batches.append(batch)
            batch, size = [], 0
        batch.extend(rows)
        size += group_size
        previous_source = source
    if batch:
        batches.append(batch)
    output.mkdir(parents=True, exist_ok=True)
    previous_path = output / 'bundles.json'
    previous = {b['name']: b for b in json.loads(previous_path.read_text())['bundles']} if previous_path.exists() else {}
    bundles = []
    for rows in batches:
        years = sorted({r['period'][:4] for r in rows if r['period']}) or ['undated']
        name = f"fide-archive-{rows[0]['source']}-{years[0]}-{years[-1]}.zip"
        path = output / name
        old = previous.get(name)
        if old and path.exists() and digest(path) == old['sha256']:
            with zipfile.ZipFile(path) as z:
                unchanged = json.loads(z.read('manifest.json'))['files'] == rows
            if unchanged:
                bundles.append(old)
                print(f'Reusing verified bundle: {name}', flush=True)
                continue
        part = path.with_suffix('.zip.part')
        print(f'Packing {name}: {len(rows)} files', flush=True)
        with zipfile.ZipFile(part, 'w', allowZip64=True) as z:
            for row in rows:
                compression = zipfile.ZIP_STORED if row['name'].lower().endswith('.zip') else zipfile.ZIP_DEFLATED
                z.write(store / row['path'], row['path'], compress_type=compression, compresslevel=1)
            z.writestr('manifest.json', json.dumps({**manifest, 'files': rows}, indent=1))
            description = ('Locally saved FIDE player-list files, preserved byte for byte.\n'
                           'Acquisition and publication dates are unconfirmed. Available file timestamps are recorded as evidence.\n'
                           if rows[0]['source'] == 'local-snapshots' else
                           'Original files from FIDE and Olimpbase, preserved byte for byte.\n'
                           'manifest.json records original source URLs, periods, sizes and SHA-256 checksums.\n'
                           'Internet Archive URLs in that source manifest are historical planned locations.\n')
            z.writestr('README.txt', 'FIDE rating-list archive\n\n' + description +
                       'This ZIP is independent and does not require the other bundles.\n')
        with zipfile.ZipFile(part) as z:
            if z.testzip():
                raise ValueError(f'Corrupt ZIP: {name}')
            for row in rows:
                h = hashlib.sha256()
                with z.open(row['path']) as f:
                    while chunk := f.read(4 * 1024 * 1024):
                        h.update(chunk)
                if h.hexdigest() != row['sha256']:
                    raise ValueError(f"Bundled checksum mismatch: {row['path']}")
        part.replace(path)
        bundles.append({'name': name, 'bytes': path.stat().st_size, 'sha256': digest(path),
                        'source': rows[0]['source'], 'years': years,
                        'paths': [r['path'] for r in rows], 'fileCount': len(rows)})
        print(f'Verified {name}: {path.stat().st_size:,} bytes', flush=True)
    save(output / 'bundles.json', {'sourceGenerated': manifest['generated'], 'bundles': bundles})


def info(file_id):
    if not isinstance(file_id, str) or not file_id.isalnum():
        raise ValueError('Invalid Pixeldrain file ID')
    with urllib.request.urlopen(f'https://pixeldrain.com/api/file/{file_id}/info', timeout=60) as response:
        return json.load(response)


def verify(remote, bundle):
    if (remote.get('size') != bundle['bytes'] or remote.get('hash_sha256') != bundle['sha256']
            or remote.get('name') != bundle['name'] or remote.get('availability')):
        raise ValueError(f"Remote verification failed: {bundle['name']}")


def upload(output, key_file):
    key = os.environ.get('PIXELDRAIN_API_KEY') or key_file.read_text(encoding='utf-8-sig').strip()
    if not key or '\n' in key:
        raise ValueError('Missing or malformed Pixeldrain API key')
    auth = 'Basic ' + base64.b64encode((':' + key).encode()).decode()
    doc = json.loads((output / 'bundles.json').read_text())
    receipt_path = output / 'pixeldrain-receipts.json'
    receipts = json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
    for bundle in doc['bundles']:
        path = output / bundle['name']
        if path.stat().st_size != bundle['bytes'] or digest(path) != bundle['sha256']:
            raise ValueError(f'Local bundle changed: {path.name}')
        previous = receipts.get(bundle['sha256'])
        if previous:
            verify(info(previous['id']), bundle)
            print(f'Already uploaded: {path.name}', flush=True)
            continue
        connection = http.client.HTTPSConnection('pixeldrain.com', timeout=1800)
        try:
            connection.putrequest('PUT', '/api/file/' + urllib.parse.quote(path.name))
            connection.putheader('Authorization', auth)
            connection.putheader('Content-Type', 'application/octet-stream')
            connection.putheader('Content-Length', str(bundle['bytes']))
            connection.endheaders()
            sent = 0
            with path.open('rb') as f:
                while chunk := f.read(4 * 1024 * 1024):
                    connection.send(chunk)
                    sent += len(chunk)
                    if sent // 100_000_000 != (sent - len(chunk)) // 100_000_000:
                        print(f'{path.name}: {sent / bundle["bytes"]:.0%}', flush=True)
            response = connection.getresponse()
            result = json.loads(response.read())
            if response.status != 201:
                raise RuntimeError(f'Pixeldrain upload HTTP {response.status}: {result.get("value", "unknown")}')
        finally:
            connection.close()
        verify(info(result['id']), bundle)
        receipts[bundle['sha256']] = {**bundle, 'id': result['id'], 'url': f'https://pixeldrain.com/u/{result["id"]}'}
        save(receipt_path, receipts)
        print(f'Uploaded and verified: {path.name} {receipts[bundle["sha256"]]["url"]}', flush=True)
    publication_path = output / 'pixeldrain.json'
    bundles = [receipts[b['sha256']] for b in doc['bundles']]
    previous = json.loads(publication_path.read_text()) if publication_path.exists() else None
    if previous and [b['id'] for b in previous['bundles']] == [b['id'] for b in bundles]:
        list_id = previous['listId']
    else:
        title = 'Saved FIDE player lists' if all(b['source'] == 'local-snapshots' for b in bundles) else 'FIDE rating-list archive'
        payload = json.dumps({'title': title, 'anonymous': False,
                              'files': [{'id': b['id']} for b in bundles]}).encode()
        request = urllib.request.Request('https://pixeldrain.com/api/list', data=payload,
                                         headers={'Authorization': auth, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=60) as response:
            list_id = json.load(response)['id']
    if not isinstance(list_id, str) or not list_id.isalnum():
        raise ValueError('Invalid Pixeldrain list ID')
    with urllib.request.urlopen(f'https://pixeldrain.com/api/list/{list_id}', timeout=60) as response:
        remote_list = json.load(response)
    if [f['id'] for f in remote_list['files']] != [b['id'] for b in bundles]:
        raise ValueError('Pixeldrain collection coverage mismatch')
    save(publication_path, {'sourceGenerated': doc['sourceGenerated'], 'listId': list_id,
                            'listUrl': f'https://pixeldrain.com/l/{list_id}', 'bundles': bundles})
    print(f'Collection verified: https://pixeldrain.com/l/{list_id}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'upload'])
    parser.add_argument('--store', type=Path, default=Path('D:/fide-archive'))
    parser.add_argument('--output', type=Path, default=Path('D:/fide-archive/pixeldrain'))
    parser.add_argument('--max-bytes', type=int, default=2_000_000_000)
    parser.add_argument('--key-file', type=Path, default=Path.home() / '.config/chessnerd/pixeldrain-api-key.txt')
    args = parser.parse_args()
    if args.command == 'prepare':
        prepare(args.store, args.output, args.max_bytes)
    else:
        upload(args.output, args.key_file)
