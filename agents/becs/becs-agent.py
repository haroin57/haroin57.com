#!/usr/bin/env python3
"""User-level OBSERVE agent. Never kills apps, edits DNS, or switches AC power."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward device credentials to a redirect destination.


def iso_now():
    return dt.datetime.now(dt.timezone.utc)


def parse_date(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def save(path, value):
    temporary = path.with_suffix('.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(value, output)
    temporary.replace(path)


def local_unlock(directory):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    save(directory / 'local-override.json', {'started_at': iso_now().isoformat(), 'mode': 'EMERGENCY', 'source': 'LOCAL_OFFLINE'})
    (directory / 'applied-policy.json').unlink(missing_ok=True)
    print('Local habit controls released. No network or NFC required.')


def valid_policy(command, device_id, last_revision, now):
    policy = command.get('policy', {})
    return (command.get('device_id') == device_id and policy.get('device_id') == device_id
            and command.get('policy_revision') == policy.get('revision')
            and isinstance(policy.get('revision'), int) and policy['revision'] >= last_revision
            and policy.get('level') == 'OBSERVE'
            and parse_date(policy['issued_at']) <= now + dt.timedelta(seconds=30)
            and now < parse_date(policy['expires_at']) <= now + dt.timedelta(minutes=3)
            and not policy.get('domains', {}).get('deny')
            and not policy.get('apps', {}).get('terminate_only_if_safe'))


def run(args):
    directory = Path(args.state_dir).expanduser()
    if args.command == 'unlock':
        local_unlock(directory)
        return
    if args.command == 'resume':
        (directory / 'local-override.json').unlink(missing_ok=True)
        print('Local override ended. Future valid OBSERVE policies can be processed.')
        return
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    base = os.environ.get('BECS_BASE_URL', '')
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('BECS_BASE_URL must be an HTTPS origin.')
    device_id = os.environ['BECS_DEVICE_ID']
    token_path = Path(os.environ['BECS_TOKEN_FILE']).expanduser()
    if stat.S_IMODE(token_path.stat().st_mode) & 0o077:
        raise ValueError('Device token file must have permission 0600.')
    token = token_path.read_text().strip()
    opener = urllib.request.build_opener(NoRedirect())
    revision_file = directory / 'revision.json'
    last_revision = json.loads(revision_file.read_text())['revision'] if revision_file.exists() else -1
    seen_id = None
    opened_research = False

    def request(path, body=None):
        request = urllib.request.Request(base.rstrip('/') + '/api/v1' + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        with opener.open(request, timeout=5) as response:
            return json.load(response)

    while True:
        try:
            applied = directory / 'applied-policy.json'
            if applied.exists() and parse_date(json.loads(applied.read_text())['expires_at']) <= iso_now():
                applied.unlink(missing_ok=True)
            if (directory / 'local-override.json').exists():
                time.sleep(5)
                continue
            command = request('/devices/' + urllib.parse.quote(device_id, safe='') + '/policy')
            if command.get('status') == 'NO_PENDING_POLICY':
                time.sleep(5)
                continue
            if not valid_policy(command, device_id, last_revision, iso_now()):
                raise ValueError('Expired, stale, unsupported, or mismatched policy.')
            if command['command_id'] != seen_id:
                policy = command['policy']
                focus_url = policy.get('desktop', {}).get('focus_url')
                if args.open_research and focus_url and not opened_research:
                    if focus_url != base.rstrip('/') + '/focus' or sys.platform != 'darwin':
                        raise ValueError('Research launch requires local macOS and the configured /focus URL.')
                    subprocess.run(['/usr/bin/open', '-a', 'Visual Studio Code'], check=True, timeout=10)
                    subprocess.run(['/usr/bin/open', focus_url], check=True, timeout=10)
                    opened_research = True
                elif not focus_url:
                    opened_research = False
                save(revision_file, {'revision': policy['revision']})
                last_revision = policy['revision']
                save(applied, policy)
                request('/device-commands/' + command['command_id'] + '/ack', {
                    'request_id': str(uuid.uuid4()), 'status': 'APPLIED',
                    'detail': 'OBSERVE policy received; no DNS/app restriction. Local offline unlock available.'})
                last_revision = policy['revision']
                seen_id = command['command_id']
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
            # Failed delivery never extends a local lease. No credentials are logged.
            print('BECS synchronization failed: ' + type(error).__name__, file=sys.stderr)
        time.sleep(5)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['poll', 'unlock', 'resume'])
    parser.add_argument('--state-dir', default='~/.local/state/becs')
    parser.add_argument('--open-research', action='store_true', help='Explicitly allow opening the editor and /focus on macOS.')
    try:
        run(parser.parse_args())
    except KeyboardInterrupt:
        pass
