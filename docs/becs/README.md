# BECS NFC v2.1

原本は[requirements-v2.1-nfc.md](requirements-v2.1-nfc.md)です。既存の公開ログ `/habit` と既存の `/api/habit/*` を維持し、本人専用の生活チェックポイントを `/control`、集中を `/focus`、タグ確認を `/tap/:tagId` に追加します。公開Habit画面には記録フォームを戻していません。

## 実装範囲

- タグの登録・下書き/有効/無効/交換、用途と版、設置場所、最後の成功、iPhoneとの紐付け・停止。
- Web本人認証、HttpOnly/Secure/SameSite=Strictの1時間セッション、CSRFとOrigin検査。端末資格情報はハッシュ保存・端末別スコープ・失効/再発行。NFCやURLには秘密を保存しません。
- `scan_id`の冪等性（受理・拒否とも元の応答を返す）、2秒リバウンド抑止、2分を超える/未来30秒を超える/確定状態より古いタッチの拒否。タグ用途はサーバーが決定します。
- 朝45分、研究、集中、帰宅、3セット、バイク、入浴、クロッキー、日次クローズ、就寝のReducer。手動チェックポイント・理由付き訂正・休養を区別して監査します。
- 集中は10秒ごとのサーバー時刻によるheartbeatで計測し、30秒を超える欠落を中断扱いにします。ページが非表示になる場合も中断要求を送ります。単なる開始後25分やタグの再タッチでは報酬を付与しません。これはタイマーの計測で、本人の研究内容の客観的証明ではありません。
- 25分計測後に1回だけ最大15分の解放権を発行し、JSTの日付を跨いで持ち越しません。研究90分の休憩案内と10分休憩を別に管理します。
- セッションは開始日の計画に帰属します。既存Habit APIの午前4時境界と混同せず、BECSの生活日付はJSTの暦日です。進行中セッションを日付だけで自動完了しません。
- 日次クローズは3セット・バイク実測24分・入浴・クロッキー・翌日To-Do3枠・レビューを再検証します。休養日は運動とクロッキー条件を免除します。条件不足のクローズでは確定状態を変えません。翌日の起床で3枠を当日のタスクに引き継ぎます。
- X投稿は文案だけを生成し、本人がIntentを開いて確定します。To-Doとレビューは公開ログや投稿文案へ含めません。
- OBSERVEポリシー、2分の期限、revision、端末別コマンド、ACK、失敗/部分成功/未反映を分離します。cronによる更新・期限処理はリクエストとは独立しています。
- 緊急解除・一時解除・休養はNFCや達成条件を要求しません。PCのローカル解除はサーバーに依存しません。
- PWAの通信断画面、未確認操作の同一IDによる再試行、90日監査保持、本人によるBECS非公開履歴の削除。Service Workerは認証ページ・API・行動記録をキャッシュしません。
- macOS User LaunchAgent用OBSERVEエージェントと、ESP32用ローカル回転判定の参照実装を同梱します。

## セットアップ

この変更は本番へ未デプロイです。DB・secret・Workerの配備は、フロントエンドのビルドとは別に必要です。既存の指示によりpushは行いません。

1. HabitのD1へ `migrations/0004_becs.sql` **だけ**を適用します。既存データを削除しません。既存の他DB向けmigrationをまとめて適用しません。
2. Workerのsecret `BECS_ADMIN_SECRET` に推測困難な本人ログイン専用の値を設定します。既存の`HABIT_TOKEN`・`ADMIN_SECRET`とは分離します。
3. `ALLOWED_ORIGIN`を実際のHTTPSオリジンへ合わせます。本番は既存の`https://haroin57.com`です。ローカル検証時はWorkerの設定とViteのAPIプロキシ先をローカル環境に合わせます。本番APIへ開発用データを送信しません。
4. WorkerとPagesを配備します。既存Worker設定に毎分のcronを追加しています。secret未設定ならBECS定期処理は無効です。
5. `/control`で本人認証し、`/control/tags`からiPhoneを作成します。表示された端末IDと端末資格情報を一度だけ控えます。資格情報は再表示しません。通信で受領できなかった場合は再発行します。
6. 最初は起床・外出・研究室の3枚だけを下書き登録して有効化し、iPhoneとShortcuts方式で紐付けます。タグは公開IDです。登録端末や紐付けが失効した場合の新規スキャンは拒否します。
7. [実機検証表](validation.md)に結果を記入します。未測定の成功率やp95を達成済みとは扱いません。

新規npm依存は追加していません。Next.js/PostgreSQLを採用しなかった理由と残作業は[ADR](adr-001-existing-stack.md)に記載します。

## iPhone Shortcuts

新しい6本の成果物と設定は[shortcuts.md](shortcuts.md)、本人Macでのコンパイル・署名は[mac-signing.md](mac-signing.md)、本番配備は[deployment.md](deployment.md)に記載します。

各タグについて「個人用オートメーション→NFC」で登録します。タグのNDEF内容からtag_idを取り出すと仮定せず、APIに発行されたIDを固定して設定します。

「URLの内容を取得」で、`POST https://haroin57.com/api/v1/nfc/scans`へ以下を送ります。`Authorization: Bearer <そのiPhoneの端末資格情報>`と`Content-Type: application/json`を指定します。管理者シークレットを使用しません。

```json
{
  "scan_id": "タッチごとに生成したUUID",
  "tag_id": "nfc_サーバー発行UUID",
  "device_id": "登録したiPhoneのID",
  "source": "IOS_SHORTCUTS",
  "occurred_at": "2026-11-17T09:00:00+09:00"
}
```

「UUIDを生成」をタッチ試行ごとに実行します。ネットワーク再試行では**同じscan_idと本文**を再利用します。認証は端末ID・有効な紐付け・Shortcuts送信元を検査します。schemaは[becs-nfc-scan.schema.json](../../schemas/becs-nfc-scan.schema.json)です。

- HTTP成功でも`outcome`を確認し、受理と端末ACKを区別します。拒否理由を表示します。
- 通信失敗時は「未確認」と表示します。応答を取得できない状態を成功と通知しません。キューを持たないShortcutsでは自動再送を前提にしません。
- NDEF方式は`https://haroin57.com/tap/<tag_id>`を書き込みます。画面表示や先読みは状態を変えません。本人認証後に確認ボタンからPOSTします。
- 起動可否はiOS・設定・ロック状態で変わります。100%自動実行や、NFCの物理真正性は保証しません。
- NFC_DAILY_CLOSEはレビュー確認を要求します。APIから自動クローズしません。NDEF確認画面は日次レビューを案内します。

## API

本人セッションと端末資格情報を併用しません。Webの変更要求はJSON・正しいOrigin・`X-BECS-CSRF`が必要です。GETは状態を変更しません。変更操作にはUUIDの`request_id`、NFCスキャンには`scan_id`を指定します。同じIDで別の本文を送ると409です。認証は再送でも毎回検証します。

| API | 権限・用途 |
|---|---|
| `POST /api/v1/auth/session` | 本人用secretでセッション発行。IP/分で試行を制限します。 |
| `DELETE /api/v1/auth/session` | 本人セッションを失効します。 |
| `GET /api/v1/state` | 本人のみ。状態・タグ・セッション・端末適用状況。資格情報のハッシュも返しません。 |
| `POST/GET /api/v1/nfc/tags` | 本人のみ。登録・台帳。 |
| `GET/PATCH /api/v1/nfc/tags/:id` | 本人のみ。用途/ラベル/設置/有効状態。更新は版を増やします。 |
| `POST /api/v1/nfc/tags/:id/disable` | 本人のみ。旧ログを残して失効します。 |
| `POST /api/v1/nfc/tags/:id/replace` | 本人のみ。旧IDをREPLACEDにし、新しいDRAFT IDを発行します。 |
| `POST /api/v1/nfc/bindings` | 本人のみ。tag_id/device_id/modeを登録します。 |
| `DELETE /api/v1/nfc/bindings/:id` | 本人のみ。紐付け停止。 |
| `POST /api/v1/nfc/prepare` | 登録したiPhoneのみ。有効なShortcuts紐付けを検査して新しいscan_idと準備時刻を返します。生活状態は変更しません。 |
| `POST /api/v1/nfc/scans` | iPhoneの資格情報または本人セッション。サーバーのタグ用途を解決します。 |
| `POST /api/v1/devices` | 本人のみ。label/typeから端末を登録します。 |
| `POST /api/v1/devices/:id/revoke` | 本人のみ。端末と紐付けを失効します。 |
| `POST /api/v1/devices/:id/rotate` | 本人のみ。旧資格情報を失効して再発行します。 |
| `POST /api/v1/routine/confirm` | 本人のみ。purpose/reasonの自己申告、correct_phase/reasonの訂正、rest_day/reasonの休養。 |
| `POST /api/v1/sessions` | 本人のみ。kind=FOCUS/BREAK/BIKE。 |
| `POST /api/v1/sessions/:id/heartbeat` | 本人のみ。集中のサーバー時刻計測。 |
| `POST /api/v1/sessions/:id/complete` | 本人のみ。条件を満たす計測済み完了、またはinterrupted=trueで中断。 |
| `POST /api/v1/tasks/:id/complete` | 本人のみ。当日タスク完了申告。 |
| `POST /api/v1/daily-close` | 本人のみ。review/tomorrow_top3を再検証します。 |
| `POST/DELETE /api/v1/overrides[/id]` | 本人のみ。一時/緊急解除と解除終了。 |
| `GET /api/v1/report/daily` | 本人のみ。日次集計と直近100件の監査。 |
| `GET /api/v1/devices/:id/policy` | そのMAC/DNS/ESP32端末のみ。期限付きコマンドを取得します。GETで期限を延ばしません。 |
| `POST /api/v1/device-commands/:id/ack` | コマンドの宛先端末のみ。APPLIED/PARTIAL/FAILEDとdetail。旧revisionや期限切れを拒否します。 |
| `POST /api/v1/devices/:id/telemetry` | そのESP32のみ。event_id/rpm/local_state/active_seconds/playback_allowed_locally/occurred_at。実測秒数はセッション経過時間を超えられません。 |
| `DELETE /api/v1/privacy/history` | 本人のみ。confirm=DELETE_PRIVATE_HISTORYでBECSの非公開記録を削除します。 |

## PC / DNS / バイク

[agents/becs/becs-agent.py](../../agents/becs/becs-agent.py)はPython標準ライブラリだけを使います。権限0600のトークンファイルと`BECS_BASE_URL`、`BECS_DEVICE_ID`、`BECS_TOKEN_FILE`を設定して`poll`で起動します。`--open-research`を明示したmacOSだけ、研究用エディタと`/focus`を開きます。rootは使いません。

```bash
python3 agents/becs/becs-agent.py poll
python3 agents/becs/becs-agent.py unlock
python3 agents/becs/becs-agent.py resume
```

`unlock`は資格情報、ネットワーク、NFC、サーバーなしで動作します。ローカル解除は`resume`まで維持します。期限切れ・古いrevision・他端末・OBSERVE以外のポリシーを拒否し、revisionの最高値を再起動後も保持します。[LaunchAgent例](../../agents/becs/com.haroin.becs.plist.example)の絶対パスを設定して、本人のユーザー領域だけに導入します。実機への導入は未実施です。

DNSはOBSERVEでは拒否リストを変更しません。NextDNSのプロファイルID・必須通信の許可範囲・復旧経路・反映遅延が未検証なので、外部サービスのブロックは接続していません。RESTRICTへの昇格は別の配備検証が必要です。

[firmware/becs-bike](../../firmware/becs-bike)はESP32/Arduino向け参照実装です。GPIO27のホール/リード入力、GPIO26の停止ボタン、1回転1パルスを前提とします。50rpmを3秒、45rpmの維持、5秒警告/10秒一時停止、低ペースの別猶予、FAULT、2分の視聴資格をローカルで処理します。シリアル`LEASE <ms>`は認証済みローカルBridgeからだけ供給する想定です。`STOP`で即時中断し、`READY`で新しいセッションを準備します。AC電源や物理ブレーキは操作しません。

センサー配線、実際の回転数、シリアルBridge/専用動画プレイヤーとの接続、ESP32への書き込みは未実施です。C++のロジック試験と実機試験を区別します。ブラウザやNFCだけでRPM実績を付与しません。

## 検証

```bash
npm run test:becs
node --experimental-strip-types tests/habit.test.mjs
npm run build
```

SQLiteによるD1互換ハーネスで実SQLとバッチのロールバックを検査します。100回再送、並行更新、認証・CSRF、失効・交換、古い時刻、25分計測、休養、ACK、履歴削除、定期処理を含みます。実Cloudflare、iOS、macOS、ESP32、DNSの実測値は[validation.md](validation.md)へ別に記録します。
