#!/usr/bin/env python3
"""Read-only production verification; never submits a checkpoint or writes a habit."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request


def verify(origin, expected=None):
    origin = origin.rstrip('/')
    parts = urllib.parse.urlsplit(origin)
    if parts.scheme != 'https' or not parts.netloc or parts.username or parts.password or parts.path or parts.query or parts.fragment:
        raise ValueError('An HTTPS origin without credentials is required')
    checks = []

    def read(path, expected_status=200, as_json=False):
        try:
            with urllib.request.urlopen(origin + path, timeout=15) as response:
                status, body = response.status, response.read(2_000_000)
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read(2_000_000)
        if status != expected_status:
            raise ValueError(f'{path}: expected HTTP {expected_status}, got {status}')
        checks.append({'path': path, 'status': status})
        return json.loads(body) if as_json else body

    stats = read('/api/habit/stats', as_json=True)
    if len(stats.get('days', [])) != 365 or not isinstance(stats.get('logs'), list) or not isinstance(stats.get('totals'), dict):
        raise ValueError('Public Habit stats schema is invalid')
    if any(key in stats for key in ['todos', 'tomorrowTop3', 'devices', 'token']):
        raise ValueError('Unexpected private data in public Habit response')
    read('/api/v1/state', expected_status=401, as_json=True)
    read('/home'); read('/habit'); read('/control'); read('/shortcuts/')
    template = read('/shortcuts/wake.unsigned.shortcut')
    if b'CONFIGURE_DEVICE_SCOPED_TOKEN' not in template:
        raise ValueError('Public NFC shortcut is not a credential-free template')
    artifacts = read('/shortcuts/signed/artifact-manifest.json', as_json=True)
    expected_names = {name + '.shortcut' for name in ['control', 'departure', 'focus', 'habit-public-log', 'lab-arrival', 'wake']}
    if len(artifacts) != 6 or {item['file'] for item in artifacts} != expected_names:
        raise ValueError('Six signed shortcuts are required')
    for item in artifacts:
        content = read('/shortcuts/signed/' + item['file'])
        if content[:4] != b'AEA1' or len(content) != item['bytes'] or hashlib.sha256(content).hexdigest() != item['sha256']:
            raise ValueError('Signed shortcut checksum mismatch: ' + item['file'])
    if expected:
        release = read('/release.json', as_json=True)
        for key in ['release_id', 'source_commit', 'source_tree_sha256', 'assets_sha256']:
            if release.get(key) != expected.get(key):
                raise ValueError(f'Production release mismatch: {key}')
    return {'status': 'PASS', 'checks': checks, 'public_habit_days': len(stats['days'])}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', default='https://haroin57.com')
    parser.add_argument('--expected-release', type=Path)
    args=parser.parse_args()
    try:
        result=verify(args.origin, json.loads(args.expected_release.read_text()) if args.expected_release else None)
    except (OSError, ValueError) as error:
        print(json.dumps({'status': 'NOT_VERIFIED', 'reason': str(error)}, ensure_ascii=False))
        raise SystemExit(1)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
