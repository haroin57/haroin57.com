#!/usr/bin/env bash
# Run actual Apple Shortcuts against an isolated local instance of the Worker handlers.
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'This E2E requires macOS Shortcuts.' >&2; exit 1; }
for executable in node python3 shortcuts osascript; do command -v "$executable" >/dev/null; done
root="$(cd "$(dirname "$0")/../.." && pwd)"
run_directory="${1:-$(mktemp -d /tmp/haroin-shortcuts-e2e.XXXXXX)}"
mkdir -p "$run_directory"
chmod 700 "$run_directory"
run_directory="$(cd "$run_directory" && pwd)"
export BECS_E2E_PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
node "$root/scripts/shortcuts-e2e/server.mjs" "$run_directory" > "$run_directory/server.log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
python3 - "$run_directory/ready.json" "$server_pid" <<'PY'
import json, pathlib, sys, time
path=pathlib.Path(sys.argv[1])
for _ in range(100):
    if path.exists() and json.loads(path.read_text()).get('pid')==int(sys.argv[2]): break
    time.sleep(.1)
else: raise SystemExit('Fixture did not start. Inspect server.log in the run directory.')
PY
python3 "$root/scripts/shortcuts-e2e/generate.py" "$run_directory" "${@:2}"
python3 -u "$root/scripts/shortcuts-e2e/run-mac.py" "$run_directory"
printf 'E2E report: %s/report.json\n' "$run_directory"
