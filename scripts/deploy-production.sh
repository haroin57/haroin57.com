#!/usr/bin/env bash
# Direct Worker/Pages deployment. Never invokes git push or modifies existing habit data.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:---plan}" != --apply ]]; then
  cat <<'PLAN'
配備順序:
1. Muse側VMのcf-wrangler（Account API Token）で認証、既存Pagesプロジェクトとmainブランチ、既存secret名を確認します。
2. BECS/既存API/ショートカットのテストとnpm run buildを実行します。
3. Habit DBをバックアップし、件数を記録して0004_becs.sqlだけを適用します。
4. BECS_ADMIN_SECRETが未設定の場合だけ新規設定します。既存secretは変更しません。
5. Workerを--keep-varsで配備し、既存データ件数とsecret名の維持を確認します。
6. SSRサーバー成果物を除いたPages資産をmainへ直接配備します。pushは実行しません。
7. 公開API、本人認証境界、release.json、ショートカット配信を読み取りで検証します。
実行: PAGES_PROJECT=確認済みの既存名 bash scripts/deploy-production.sh --apply
PLAN
  exit 0
fi
PAGES_PROJECT="${PAGES_PROJECT:-haroin}"
if ! command -v cf-wrangler >/dev/null; then
  echo 'Muse側VMのcf-wranglerが必要です。OAuthログインやUbuntuへのトークン転送は行いません。' >&2
  exit 1
fi
release_dir="$(mktemp -d /tmp/haroin-production.XXXXXX)"
chmod 700 "$release_dir"
export WRANGLER_LOG_PATH="$release_dir/wrangler.log"
export WRANGLER_SEND_METRICS=false
cf() { cf-wrangler "$@"; }
cf whoami > "$release_dir/auth.txt"
cf pages project list --json > "$release_dir/pages-projects.json"
cf pages deployment list --project-name "$PAGES_PROJECT" --environment production --json > "$release_dir/pages-deployments-before.json"
python3 scripts/check-deploy-target.py "$release_dir/pages-projects.json" "$release_dir/pages-deployments-before.json" "$PAGES_PROJECT"
cf secret list --format json > "$release_dir/secrets-before.json"
npm run test:becs
node --experimental-strip-types tests/habit.test.mjs
node --experimental-strip-types tests/habit-public.test.mjs
python3 tests/shortcuts.test.py
npm run build
cf deploy --dry-run --outdir "$release_dir/worker-dryrun"
cf d1 export Habit --remote --output "$release_dir/habit-backup.sql"
chmod 600 "$release_dir/habit-backup.sql"
counts_sql='SELECT (SELECT COUNT(*) FROM habit_logs) AS habit_logs, (SELECT COUNT(*) FROM daily_todos) AS daily_todos;'
cf d1 execute Habit --remote --command "$counts_sql" --json > "$release_dir/counts-before.json"
cf d1 execute Habit --remote --file migrations/0004_becs.sql --yes > "$release_dir/migration.txt"
if ! python3 - "$release_dir/secrets-before.json" <<'PY'
import json, sys
raise SystemExit(0 if any(item['name']=='BECS_ADMIN_SECRET' for item in json.load(open(sys.argv[1]))) else 1)
PY
then
  # A new owner secret is generated only when its name is absent remotely.
  # Preserve this 0600 file in the owner's password manager before deleting the release directory.
  python3 - "$release_dir/BECS_ADMIN_SECRET" <<'PY'
import os, secrets, sys
with os.fdopen(os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as out:
    out.write(secrets.token_urlsafe(48))
PY
  cf secret put BECS_ADMIN_SECRET < "$release_dir/BECS_ADMIN_SECRET"
fi
cf deploy --keep-vars | tee "$release_dir/worker-deploy.txt"
cf d1 execute Habit --remote --command "$counts_sql" --json > "$release_dir/counts-after.json"
cf secret list --format json > "$release_dir/secrets-after.json"
python3 - "$release_dir" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1])
def read(name): return json.loads((p/name).read_text())
before={item['name'] for item in read('secrets-before.json')}
after={item['name'] for item in read('secrets-after.json')}
if not before <= after: raise SystemExit('既存secret名の維持を確認できません。')
a=read('counts-before.json')[0]['results'][0]; b=read('counts-after.json')[0]['results'][0]
if any(b[key] < a[key] for key in a): raise SystemExit('既存Habitデータ件数が減少しています。配備を中断します。')
PY
node scripts/stage-pages-release.mjs "$release_dir/pages" > "$release_dir/release-stage.json"
source_commit="$(git rev-parse HEAD)"
source_dirty="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).working_tree_dirty' "$release_dir/pages/release.json")"
cf pages deploy "$release_dir/pages" --project-name "$PAGES_PROJECT" --branch main --commit-hash "$source_commit" --commit-dirty="$source_dirty" | tee "$release_dir/pages-deploy.txt"
python3 scripts/verify-production.py --expected-release "$release_dir/pages/release.json" | tee "$release_dir/verification.json"
echo "配備記録とDBバックアップ: $release_dir"
if [[ -f "$release_dir/BECS_ADMIN_SECRET" ]]; then
  echo "新規本人認証secretの保管先（値は非表示）: $release_dir/BECS_ADMIN_SECRET"
fi
