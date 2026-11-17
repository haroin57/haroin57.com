# 本番配備と今回の実行記録

対象は既存Worker `haroin-api`、既存Habit D1、Pagesプロジェクト `haroin`、公開ドメイン `haroin57.com`です。Pages名はユーザーから共有されています。Git pushは実行しません。

## 今回の状態

- ホーム`/home`のHabitデータ表示は削除しました。`/habit`へのナビゲーションボタンと他のUIを維持しています。公開ログの取得・表示は`/habit`に残しています。
- 本番配備はMuse側VMでマナが実行します。`cf-wrangler`が保管済みAccount API Tokenを`CLOUDFLARE_API_TOKEN`として注入します。UbuntuでOAuthログインを行わず、Account API TokenをUbuntuへ転送しません。
- `deploy-production.sh`のCloudflare操作はすべて`cf-wrangler`を経由します。ラッパーがない環境では、DBや本番へ接続する前に停止します。
- Codex側ではビルド・テスト・Worker dry run・署名成果物・コミットを準備します。本番の`release.json`では前回コミット`c821cc84eee96023289f5bca110b477592ceede8`の配備を確認しました。今回のショートカット修正・ホーム変更の配備はMuse側VMでの実行待ちです。
- Mac署名の結果は[mac-signing.md](mac-signing.md)に記録します。

## 配備手順

Muse側VMでコミット済みのリポジトリを用意し、`npm ci`で依存関係を導入します。Node.js 24、Python 3、g++、`cf-wrangler`が必要です。保存済みのトークン値は表示しません。

```bash
bash scripts/deploy-production.sh --plan
PAGES_PROJECT=haroin bash scripts/deploy-production.sh --apply
```

スクリプトは次を実行します。

1. 認証を確認し、`cf-wrangler pages project list --json`の実際の出力項目で、プロジェクト`haroin`が`haroin57.com`へ接続されていることを照合します。本番deployment一覧の`Environment=Production`と`Branch=main`を確認します。別プロジェクトの新規作成は行いません。
2. BECS、既存Habit、ショートカット、公開GETのテストとビルドを実行します。
3. 権限0700の`/tmp/haroin-production.*`へD1のバックアップと配備記録を保存します。既存`habit_logs`と`daily_todos`の件数を記録します。
4. Habitへ`migrations/0004_becs.sql`だけを適用します。既存テーブルに対する削除・置き換えはありません。別DB向けmigrationをまとめて適用しません。
5. secret名を確認し、`BECS_ADMIN_SECRET`がない場合だけ新しい値を生成・設定します。既存secretを上書き・削除しません。新規値は権限0600の非公開ファイルへ保存し、値をログへ表示しません。作成された場合は本人がパスワード管理先へ保存してから一時ファイルを削除します。
6. Workerを`--keep-vars`で配備し、既存secret名の維持と既存データ件数の非減少を確認します。実行中の本人の追加記録による件数増加は許容します。
7. Pages向けに`dist/server`を除いた資産を別のディレクトリへコピーします。source commit・作業差分の有無・ソースハッシュ・資産ハッシュ・release IDを`release.json`へ記録します。
8. `--project-name haroin --branch main`で直接配備します。Git pushは実行しません。`release.json`に記録した差分の有無を`--commit-dirty`へ渡します。
9. `scripts/verify-production.py`で公開APIの365日、本人APIの無認証401、各画面、資格情報を含まないテンプレート、署名済み6本のハッシュ、release IDを確認します。検証はGETのみで、本番の生活フェーズや習慣データを進めません。

公開APIの取得と認証境界は、ローカルのmockだけで本番確認済みと扱いません。実ブラウザで`/habit`のfetch・エラー・再取得と、`/home`がHabitデータを表示せずボタンを維持していることも確認します。

## 個別のローカル確認

```bash
npm run test:becs
node --experimental-strip-types tests/habit.test.mjs
node --experimental-strip-types tests/habit-public.test.mjs
python3 tests/shortcuts.test.py
npm run build
cf-wrangler deploy --dry-run --outdir /tmp/haroin-worker-dryrun
node scripts/stage-pages-release.mjs /tmp/haroin-pages-release
python3 scripts/verify-production.py --expected-release /tmp/haroin-pages-release/release.json
```

staging先は空のディレクトリを指定します。配備成果物の識別子と本番配備IDは異なります。最後のオンライン確認が通信失敗の場合、`NOT_VERIFIED`を返して失敗終了します。

## マナへの引き継ぎ

Codex側で本番への書き込みは実行していません。Muse側VMにこのコミットを反映し、既存の`cf-wrangler`がPATHで利用できる状態で実行します。ラッパーがshell関数の場合は、子プロセスから呼べるよう`export -f cf-wrangler`するか、実行可能なラッパーをPATHへ配置します。Account API Tokenの値はリポジトリ・成果物・Ubuntuへ保存しません。

```bash
PAGES_PROJECT=haroin bash scripts/deploy-production.sh --apply
```

成功時はWorker/Pages配備IDとGET検証結果を含む`/tmp/haroin-production.*`の記録を確認します。新規BECS本人用secretが作成された場合は、その非公開ファイルを本人のパスワード管理先へ保管します。iPhoneでショートカットを追加し、資格情報とNFCを設定する作業は別途残ります。
