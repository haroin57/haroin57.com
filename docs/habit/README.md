# If-Then Habit（Phase 1＋公開ログ）

## 構成

- `/habit`: オーナー用のクイック記録、夜の総括、今日のTo-Do完了操作です。
- `/logs`: 認証不要の365日ヒートマップ、全期間の累計、直近30日間の実績・公開メモです。To-Doは公開しません。
- `src/workers/habit.ts`: 既存Workerから分岐するAPIです。`HABIT_DB`には専用D1 `Habit` を接続します。
- `migrations/0003_habit.sql`: `habit_logs`と`daily_todos`を作成します。
- `src/workers/habit-date.ts`: JST午前4時を境界とする対象日とストリークの計算です。0:00〜3:59は前日扱いです。
- `public/manifest.webmanifest`: ホーム画面追加用のmanifestです。Service Workerやオフライン保存はPhase 1に含めません。

## セットアップとデプロイ

リポジトリ直下で実行します。以下のリモート操作は実装作業中には実行していません。

```bash
npm ci
node --experimental-strip-types tests/habit.test.mjs
npm run build
wrangler d1 execute Habit --remote --file=migrations/0003_habit.sql
wrangler secret put HABIT_TOKEN
wrangler deploy
```

既存の`migrations/`にはPosts/BBS用のSQLもあるため、Habitには上記のファイル指定で習慣用SQLだけを適用します。`wrangler d1 migrations apply Habit --remote`でディレクトリ全体を適用する運用にはしません。SQLは`IF NOT EXISTS`により初期化の再実行が可能です。

その後、既存のCloudflare Pages配信手順で`npm run build`の`dist/`を配信します。WorkerとPagesは別のデプロイです。`/api/*`は既存のWorkerルートで処理され、`/habit`と`/logs`はPagesのSPAフォールバックで表示します。

`HABIT_TOKEN`は推測困難なランダム値を設定し、`/habit`とiOSショートカットに同じ値を登録します。画面は`localStorage`の`habit_token`に保存します。「トークンを削除・再入力」で端末から削除できます。ソースコードや公開環境変数には保存しません。

既存`ADMIN_SECRET`の`X-Admin-Secret`でも認証できます。ただし、`HABIT_TOKEN`未設定時は管理者認証でも書き込みを503で拒否します。閲覧用`today`にはいずれかの有効な認証が必要です。

ローカルWorkerを使う場合は、未追跡の`.dev.vars`に`HABIT_TOKEN`を設定し、以下を実行します。

```bash
wrangler d1 execute Habit --local --file=migrations/0003_habit.sql
wrangler dev
```

Viteの既存`/api`プロキシは本番サイトを向いています。ローカルDBで動作確認する場合は開発中のみ`vite.config.ts`のプロキシ先をローカルWorker（通常`http://localhost:8787`）に変更します。

## API

すべてのレスポンスはJSONです。書き込みは`Content-Type: application/json`を指定します。習慣パスは既存のOrigin/Referer検査を適用せず、Bearerまたは管理者シークレットで認証します。CORSには既存の`buildCorsHeaders`を使います。

| メソッド・パス | 認証 | 入出力 |
| --- | --- | --- |
| `POST /api/habit/quick` | 必須 | `{action_type, value?: 1}`を受け取り、固定量を原子的に加算します。 |
| `POST /api/habit/daily-close` | 必須 | 完了フラグとバイク分数を当日の値に置き換え、指定された場合は翌日To-Doも一括保存します。 |
| `GET /api/habit/today` | 必須 | `{target_date, log, todos, streak_days}`を返します。未記録の`log`は`null`です。 |
| `GET /api/habit/stats` | 不要 | `{days: [{date, score}], totals, streak_days, logs}`を返します。 |
| `POST /api/habit/todo/complete` | 必須 | `{id}`を受け取り、今日に属するTo-Doだけを完了にします。 |

クイック記録のアクションは以下のとおりです。`value`は省略または`1`のみを受け付けます。

| action_type | 加算・設定 |
| --- | --- |
| `toilet_sq_en` | SQ＋30、英語＋1 |
| `jump_sq` | SQ＋20 |
| `squat30` | SQ＋30 |
| `pushup_set` | 腕立て＋1セット |
| `abs_set` | 腹筋＋1セット |
| `plank` | 腹筋＋1セット |
| `english` | 英語＋1 |
| `screenshot` | スクショ資料＋1 |
| `work_focus` | 仕事初動を完了に設定 |

クイック記録・総括の成功時は`{status:"ok", target_date, streak_days, today_summary, tweet_text}`を返します。`today_summary`は全カウントを含む日次ログです。

総括リクエストの例です。

```json
{
  "circuit_done": true,
  "bike_minutes": 48,
  "shadowing_done": true,
  "drawing_done": true,
  "work_focus_done": true,
  "memo": "公開される一言メモです。",
  "next_todos": ["明日の最重要タスク", "制作", "調査"]
}
```

フラグはbooleanまたは0/1です。バイクは0〜1440の整数、メモは140字以内、翌日To-Doは最大3件・各200字以内です。空欄To-Doは除外します。`next_todos`指定時は翌日分を置き換え、空配列で全削除、省略時は既存の翌日分を維持します。画面もTo-Do欄を編集した場合だけ置き換えます。クイック加算は総括の再保存でも維持します。総括は加算操作ではありません。

未知のactionや不正な入力は400、不正な認証は401、対象外のTo-Doは404、メソッド違反は405、JSON以外は415、未設定の書き込みトークンは503、DBエラーは500です。

`score`は10項目（SQ、腕立て、腹筋・プランク、バイク、英語、クロッキー、資料、仕事初動、サーキット、シャドーイング）のうち値が正の項目数です。ストリークも同じ判定を使い、今日が未達成なら昨日から遡ります。ヒートマップは今日を含む365日をゼロ埋めし、タイムラインは今日を含む30日間を返します。累計とストリークは365日より前も対象です。

## iOSショートカット

1. 「URLの内容を取得」で`https://haroin57.com/api/habit/quick`をPOST先に指定します。
2. ヘッダーを`Authorization: Bearer <HABIT_TOKEN>`、`Content-Type: application/json`にし、JSON本文に`action_type: toilet_sq_en`を設定します。
3. レスポンスの辞書から`tweet_text`を取得し、URLエンコードします。HTTPエラーや`error`が返った場合は投稿画面を開かず終了する分岐を付けます。
4. `https://twitter.com/intent/tweet?text=<エンコード済み文字列>`を開きます。Xアプリを直接開く場合は`x://post?message=<エンコード済み文字列>`を使用し、アプリが利用できない場合はWeb Intentを使用します。
5. ショートカットをホーム画面・ウィジェットなどに配置します。アクション別に複製し、`action_type`を変更します。

夜は`/habit`を開くショートカットを作成します。Safariの共有メニューから「ホーム画面に追加」も利用できます。保存後のXリンクはユーザーがタップして開き、投稿の確定はX側で行います。

## Phase 1の範囲と検証

画像アップロード・画像ギャラリー・X APIによる自動投稿・投稿済み検出は未実装です。総括はJSONのみを受け付けます。`drawing_image_url`と`tweeted`は将来用にDBに確保しています。画像は必要に応じてXの投稿画面で手動添付します。公開メモに個人のTo-Doや秘密情報を記入しないでください。

テストはNode.js 24の標準SQLiteでmigrationとSQLを実行し、日付境界、認証、原子的加算、総括とTo-Doのロールバック、公開データの範囲、入力検証を確認します。外部テスト依存は追加していません。Cloudflare上でのデプロイおよび実機iOSのホーム画面追加は別途確認します。
