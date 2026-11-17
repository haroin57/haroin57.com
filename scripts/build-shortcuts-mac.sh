#!/usr/bin/env bash
# Run only on the owner's Mac after inspecting the existing nine-shortcut build setup.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo '本人のMacで実行してください。署名環境がないという判定ではありません。' >&2
  exit 1
fi
python3 - <<'PY_CHECK'
from pathlib import Path
import re
for file in Path('shortcuts/sources').glob('*.cherri'):
    if re.search(r'Bearer (?!CONFIGURE_DEVICE_SCOPED_TOKEN)',file.read_text()):
        raise SystemExit('資格情報を含むソースは共有用にコンパイル・署名しません。')
PY_CHECK
command -v cherri
cherri --version
command -v shortcuts
output_dir="${1:-$(mktemp -d /tmp/haroin-shortcuts.XXXXXX)}"
mkdir -p "$output_dir/cherri" "$output_dir/signed"
# Keep the exact exported-plist path available alongside Cherri compilation results.
# This script never reads Keychain, edits existing Shortcuts, or publishes a credential.
for basename in control departure focus habit-public-log lab-arrival wake; do
  source="shortcuts/sources/$basename.cherri"
  if ! cherri "$source" --share=anyone --output="$output_dir/cherri/$basename.shortcut" --no-ansi > "$output_dir/cherri/$basename.log" 2>&1; then
    echo "Cherriコンパイル失敗: $basename。検証済みplistをApple CLIで署名します。ログ: $output_dir/cherri/$basename.log" >&2
  fi
done
bash scripts/sign-shortcuts.sh public/shortcuts "$output_dir/signed"
python3 - "$output_dir" <<'PY'
import hashlib, json, pathlib, sys
root=pathlib.Path(sys.argv[1]); records=[]
for folder in ['cherri','signed']:
    files=sorted((root/folder).glob('*.shortcut'))
    if folder == 'signed' and len(files)!=6: raise SystemExit('配布用の署名成果物が6本揃っていません。')
    for file in files:
        data=file.read_bytes()
        if len(data)<100 or data[:4] != b'AEA1':
            raise SystemExit('署名済み成果物であることを確認できません: '+str(file))
        records.append({'file':str(file.relative_to(root)), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()})
(root/'artifact-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('署名コマンドの成功・成果物数・ハッシュを確認しました。iPhoneへの追加とNFC実機確認は別途必要です。')
PY
echo "成果物: $output_dir"
