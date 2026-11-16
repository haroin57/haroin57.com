# Codex実装タスク: If-Then習慣トラッカー (Phase 1 + 公開ログ) & Products記事書き直し

リポジトリ: haroin57/haroin57.com (React 19 + TypeScript + Vite, Cloudflare Pages フロント / Workers API `src/workers/`, D1/KV/R2)
ブランチ: `feat/habit-ifthen` で作業すること。
要件の原文は `docs/habit/requirements-web.md` と `docs/habit/requirements-ios.md` に置いてある。必ず両方を読んでから実装すること。

## 既存構成の事実（確認済み・前提として使うこと）
- Workerエントリは `src/workers/index.ts`。パスで振り分けし、`checkOrigin` を通す。Origin/Refererが両方空なら通るのでiOSショートカットからの直接POSTは既存チェックで問題ない。
- 認証の既存パターンは `src/workers/auth.ts` の `X-Admin-Secret` vs `ADMIN_SECRET`。
- ルーティングは `src/components/AnimatedRoutes.tsx`（クライアント）と `src/components/ServerRoutes.tsx`（SSR）の両方に同じRoute定義がある。追加時は両方 + `src/lib/preloadRoutes.ts` にも追加すること。
- 生成物 `src/data/*.json` は手編集禁止（AGENTS.md）。ビルドは `npm run build` が通ることが最低条件。未使用importで落ちるので注意。
- D1は新規に `Habit` を作成済み: database_id `0613c2b8-a849-4baf-8a81-61090eccd26c`。wrangler.toml に binding `HABIT_DB` として追加すること（既存の POSTS_DB / BBS_DB の書き方に倣う）。

## タスク1: 習慣トラッカー実装

### DB (migrations/0003_habit.sql を新規作成)
要件iOS版のテーブル案を正とする:
- `habit_logs`: id, target_date (DATE/UNIQUE), squat_count INT, pushup_sets INT, abs_sets INT, bike_minutes INT, english_count INT, drawing_done 0/1, screenshot_count INT, work_focus_done 0/1, circuit_done 0/1, shadowing_done 0/1, memo TEXT, drawing_image_url TEXT, tweeted 0/1, created_at, updated_at
- `daily_todos`: id, target_date (DATE), priority 1-3, title TEXT, is_completed 0/1, created_at

### 日付境界
JSTで朝4:00切り替え。4:00未満は前日を target_date とするユーティリティ関数を作り、Worker側の全処理で使うこと。

### API (src/workers/habit.ts を新規作成し index.ts に組み込む)
パスは `/api/habit/*`。habit系は認証方式が異なるため、既存の checkOrigin は habit パスでは適用しない（ショートカットはOrigin無しで通るが、Web UIは同一オリジン。どちらもBearer認証で守る）。CORSヘッダは既存の buildCorsHeaders を使う。
認証: `Authorization: Bearer <token>` が env `HABIT_TOKEN` と一致、または既存 `X-Admin-Secret` が `ADMIN_SECRET` と一致すればOK。env型 (types.ts) に `HABIT_DB: D1Database` と `HABIT_TOKEN?: string` を追加。トークン未設定時は書き込み系を503で拒否すること（フェイルクローズ）。

1. `POST /api/habit/quick` — {action_type, value?} で当日のhabit_logsを加算 (INSERT ... ON CONFLICT(target_date) DO UPDATE で原子的に)。
   action_type のマッピング:
   - toilet_sq_en: squat_count += 30, english_count += 1
   - jump_sq: squat_count += 20
   - squat30: squat_count += 30
   - pushup_set: pushup_sets += 1
   - abs_set: abs_sets += 1
   - plank: abs_sets += 1 （プランクはabs系に集計）
   - english: english_count += 1
   - screenshot: screenshot_count += 1
   - work_focus: work_focus_done = 1
   未知のaction_typeは400。
   レスポンス: {status:"ok", target_date, streak_days, today_summary:{...全カウント}, tweet_text}
   tweet_text は日本語で、そのアクションの完了文 + 「本日累計SQ：X回 / 連続N日目🔥」+ `#IfThen習慣 #今日の積み上げ` を含む。
2. `POST /api/habit/daily-close` — JSON body: {circuit_done, bike_minutes, shadowing_done, drawing_done, work_focus_done, memo?, next_todos?: string[] (最大3)}。当日ログを更新し、next_todos を「翌日 (target_date+1)」の daily_todos として保存（既存の翌日分は置き換え）。レスポンスに総括 tweet_text（要件Web版のテンプレート形式）を含める。画像アップロード (multipart) はPhase 1では任意対応とし、無理なら JSON のみでよい（その旨をREADMEに明記）。
3. `GET /api/habit/today` — 認証必須。当日ログ + 今日のtodos + streak。
4. `GET /api/habit/stats` — 公開用（認証不要）。直近365日の {date, score} 配列（scoreはその日の達成項目数）、累計 {total_squat, total_bike_minutes, total_english, drawing_days}, streak_days, 直近30日のログ（memo含む）。個人のtodoは含めない。
5. `POST /api/habit/todo/complete` — 認証必須。{id} のtodoを完了にする。
streak計算: habit_logs に行があり主要項目のいずれかが0でない日を達成日とし、今日（未記録なら昨日）から遡って連続日数を数える。

### フロントエンド
1. `src/routes/Habit.tsx` — オーナー用記録画面 `/habit`:
   - 初回はトークン入力欄（localStorageキー `habit_token` に保存）→ 以後はそれをBearerで使う。
   - クイックボタン群: トイレSQ30+英語 / ジャンプSQ20 / SQ30 / 腕立て+1set / 腹筋ローラー+1set / 英語+1 / スクショ資料+1 / 仕事25分初動。各ボタンを押すと POST quick し、結果の tweet_text で X Web Intent リンク (`https://twitter.com/intent/tweet?text=...`) を表示（自動で開かない、タップで開く）。
   - 夜の総括セクション: チェック群（サーキット筋トレ / バイク1話24分・2話48分 / シャドーイング / クロッキー / 仕事初動）、メモ欄、明日のTo-Do 3欄、「記録してX投稿文を作る」ボタン → daily-close → tweet_text と Intent リンク表示。
   - 今日のTo-Do表示（あれば）と完了ボタン。
   - モバイルファースト、タップしやすい大きいボタン。既存サイトのダークなデザイン/ Tailwind の流儀に合わせる。
2. `src/routes/Logs.tsx` — 公開ページ `/logs`: GET stats を表示。GitHub風ヒートマップ（365日、scoreで濃淡、外部ライブラリ追加なし・divグリッドで実装）、累計スタッツカード、ストリーク、直近ログのタイムライン。
3. PWA: `public/manifest.webmanifest` を新規作成 (name: "If-Then Habit", short_name: "Habit", start_url: "/habit", display: "standalone", アイコンは既存 public/icon 配下の流用可なら流用、無ければ profile.webp を指定)、`index.html` に manifest リンクと theme-color を追加。Service WorkerはPhase 1では追加しない（manifestのみ）。
4. ルート追加: AnimatedRoutes / ServerRoutes / preloadRoutes に `/habit` と `/logs` を追加。

### ドキュメント
`docs/habit/README.md` に: 構成、API仕様、必要なsecret (`wrangler secret put HABIT_TOKEN`)、migration適用コマンド (`wrangler d1 migrations apply Habit --remote` 相当。既存migrations運用に合わせる)、iOSショートカットの作り方（docs/habit/ios-shortcuts.md の内容要約でも可）を書く。

## タスク2: Products記事の書き直し
`content/products/haroin57-com.md`（https://haroin57.com/products/haroin57-com の元原稿）を一から書き直す。内容・構成は全面的に任せる。ただし:
- frontmatter の形式（title/summary/date/product/tags）は既存形式を維持し、dateは今日の日付に更新する。
- 事実はこのリポジトリの実コードから読み取ること（React 19/Vite/SSRプリレンダ/Workers/D1/KV/R2/BBS/CMS等）。存在しない技術（例: Tailwind v4、Vite 7、Rolldownなど現行package.jsonに無いもの）を書かない。package.json と wrangler.toml と src/ を必ず確認すること。
- 今回タスク1で追加する習慣トラッカーにも触れてよい。
- 書き直し後は生成スクリプト経由で反映されるよう、他の生成物は手編集しない（buildで生成される）。

## 完了条件
- `npm ci` 後 `npm run build` が成功する。
- 変更を2コミットに分ける: (1) feat: habit tracker (タスク1) (2) docs: rewrite haroin57-com product page (タスク2)。生成JSONの差分があれば含める。
- pushはしない。最後に、何を作ったか・ファイル一覧・残課題（デプロイ手順とsecret設定が必要なこと）を簡潔に報告する。
