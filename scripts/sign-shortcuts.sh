#!/usr/bin/env bash
set -euo pipefail
input_dir="${1:-public/shortcuts}"
output_dir="${2:-/tmp/haroin-signed-shortcuts}"
if [[ "$(uname -s)" != Darwin ]] || ! command -v shortcuts >/dev/null; then
  echo 'Appleのshortcuts CLIがあるmacOSで署名してください。この環境では署名していません。' >&2
  exit 1
fi
mkdir -p "$output_dir"
signing_dir="$(mktemp -d /tmp/haroin-shortcut-sign.XXXXXX)"
chmod 700 "$signing_dir"
for workflow in "$input_dir"/*.unsigned.shortcut; do
  # Personal device credentials must be entered after import, not uploaded for sharing/signing.
  basename="$(basename "$workflow" .unsigned.shortcut)"
  python3 - "$workflow" "$signing_dir/$basename.input.shortcut" <<'PY'
import plistlib, sys
workflow = plistlib.load(open(sys.argv[1], 'rb'))
for action in workflow['WFWorkflowActions']:
    headers = action['WFWorkflowActionParameters'].get('WFHTTPHeaders', {}).get('Value', {}).get('WFDictionaryFieldValueItems', [])
    for entry in headers:
        if entry['WFKey']['Value']['string'] == 'Authorization' and entry['WFValue']['Value']['string'] != 'Bearer CONFIGURE_DEVICE_SCOPED_TOKEN':
            raise SystemExit('端末資格情報を含むファイルは共有用に署名しません。')
# Apple signing accepts legacy binary plists reliably; keep XML as editable sources.
with open(sys.argv[2], 'wb') as output:
    plistlib.dump(workflow, output, fmt=plistlib.FMT_BINARY, sort_keys=False)
PY
  signed=false
  for attempt in 1 2 3; do
    candidate="$signing_dir/$basename.$attempt.shortcut"
    # The Apple CLI can print a timeout while returning success. Validate the output too.
    shortcuts sign --mode anyone --input "$signing_dir/$basename.input.shortcut" --output "$candidate" || true
    if python3 - "$candidate" <<'PY_VERIFY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
if not p.is_file() or p.stat().st_size < 100 or p.read_bytes()[:4] != b'AEA1':
    raise SystemExit(1)
PY_VERIFY
    then
      cp "$candidate" "$output_dir/$basename.shortcut"
      signed=true
      break
    fi
    echo "Apple署名を再試行します: $basename ($attempt/3)" >&2
  done
  if [[ "$signed" != true ]]; then
    echo "署名済みファイルを確認できません: $basename" >&2
    exit 1
  fi
done
