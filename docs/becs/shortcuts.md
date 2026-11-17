# 新しいショートカット

6本の署名済みファイルを本人Macで作成し、`public/shortcuts/signed/`へ保存しました。Appleの`mode anyone`署名です。`/shortcuts/`の配布ページから取得できます。iPhoneへの追加・資格情報設定・NFCとの紐付けは本人端末で実施します。

署名前テンプレートは再生成用として保持しています。署名済みファイルと元のplistのハッシュは`public/shortcuts/signed/artifact-manifest.json`で照合できます。

| 名前 | 署名済みファイル | 処理 |
|---|---|---|
| BECS 起床 | `public/shortcuts/signed/wake.shortcut` | 起床タグの準備→NFC申告→実応答表示。 |
| BECS 外出 | `public/shortcuts/signed/departure.shortcut` | 外出タグの準備→NFC申告→実応答表示。 |
| BECS 研究室到着 | `public/shortcuts/signed/lab-arrival.shortcut` | 研究室タグの準備→NFC申告→実応答表示。 |
| Habit 公開ログを取得 | `public/shortcuts/signed/habit-public-log.shortcut` | 公開統計をGETし、連続達成日数を表示して`/habit`を開きます。認証不要です。 |
| BECS 管理画面 | `public/shortcuts/signed/control.shortcut` | 本人認証付きの`/control`を開きます。操作は本人が確定します。 |
| BECS 集中画面 | `public/shortcuts/signed/focus.shortcut` | `/focus`を開きます。画面を開くだけでは集中開始・達成になりません。 |

対応するソースは`shortcuts/sources/*.cherri`です。秘密情報は含めていません。Cherri 2.4.0では複雑な辞書のコンパイルに問題があるため、配布版6本は同じワークフローのバイナリplistをApple CLIで直接署名しました。詳細は[Mac署名記録](mac-signing.md)に記載しています。iPhoneでの実行可否と物理NFCの確認は未実施です。

## NFC用の初期設定

1. 配備後の`/control/tags`でiPhoneを登録します。端末IDと端末別資格情報を管理します。管理者シークレットをShortcutsに使用しません。
2. 起床・外出・研究室到着の3タグを登録して有効化し、そのiPhoneと`IOS_SHORTCUTS`方式で紐付けます。
3. 署名済みショートカットを追加すると、端末ID・タグID・そのiPhone専用の資格情報を入力する3つの設定項目が表示されます。管理者シークレットは使用しません。入力値は冒頭の3つのテキストアクションに保存され、準備・申告の両方で共有されます。Authorizationを2か所編集する必要はありません。
4. 後から変更する場合はショートカット冒頭の3つのテキスト欄を変更します。空欄または配布時のプレースホルダーのまま実行すると、初期設定の案内を表示してAPI送信前に停止します。設定後のショートカットを共有しません。
5. 公開IDを設定済みのテンプレートが必要な場合は、`shortcuts/becs.example.json`を本人用設定へコピーし、`python3 scripts/gen-shortcuts.py --config /tmp/becs-iphone-config.json`で生成して本人Macで再署名します。公開配布物へ実資格情報を埋め込みません。
6. iPhoneのNFCオートメーションで物理タグを登録し、「ショートカットを実行」に対応する1本を設定します。タグ内部からURLやtag_idを自動取得すると仮定しません。OS・ロック状態ごとの動作は実機で確認します。[Appleのオートメーション手順](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios)を参照します。

## 準備APIと結果の確認

`POST /api/v1/nfc/prepare`は、そのiPhoneの資格情報・device_id・有効なタグ・有効なShortcuts紐付けを検査します。毎分120回までです。応答は`scan_id`、`tag_id`、`device_id`、`source`、`occurred_at`です。`occurred_at`は準備APIのサーバー時刻であり、物理的なNFC検出時刻を測定した値ではありません。

テンプレートはこの応答のIDと時刻を参照し、`POST /api/v1/nfc/scans`へ送信します。UUID生成を追加アプリに依存させず、識別子をテンプレートへ固定しません。準備だけではチェックポイントを受理せず、生活状態・revision・達成を変更しません。無効化されたタグや端末は申告時にも再検査します。

実際のJSON応答の`outcome`、`message`、`state_revision`、`policy_status`を表示します。固定の成功通知や無確認の外部投稿は行いません。通信失敗は未確認です。自動再試行やショートカット全体の繰り返しは設定しません。全体を再実行すると新しいscan_idになるため、同じ送信の確認には元の準備応答・本文を再利用する必要があります。短い再タッチは2秒抑止、その他の重複は状態遷移で検証します。

iPhoneでは正常・無認証・失効・通信断・2回タッチ・遅延スキャンを確認します。`accepted`と実際の端末適用ACKは別です。

## 再生成と検査

```bash
python3 scripts/gen-shortcuts.py
python3 tests/shortcuts.test.py
```

非公開の個人用トークンファイルを使うオプションは、出力とCherriソースの両方をリポジトリ外へ指定し、ファイル権限0600に限定します。公開資産へ書き込もうとすると停止します。共有用署名スクリプトは本人の実資格情報を含むファイルを拒否します。配布用ファイルは常にプレースホルダー版です。

## Mac E2Eと修正版への更新

URLを開くアクションに`WFURL`を指定していたため、直前のリッチテキストをURLとして扱って失敗していました。修正版は`WFInput`と`Show-WFInput`で遷移先を明示します。公開ログ取得・管理画面・集中画面の3本が対象です。

Mac E2EはAppleの実際の署名・インポート・CLI実行を使用し、実WorkerハンドラーとSQLiteをMacのループバック上で実行します。端末ID・資格情報・タグは検証専用です。本番の状態を変更しません。Macのアクセシビリティ許可と、初回実行時の接続・出力許可が必要です。検証用ショートカットは`BECS-E2E-`で始まる名前で追加されます。検証結果は[実行記録](shortcuts-e2e-report.json)に保存します。iPhoneの物理NFC検出や端末適用ACKまで確認した記録ではありません。

```bash
bash scripts/shortcuts-e2e/start-mac.sh
```

修正版は配布ページから6本を追加し直します。NFC用3本では初期設定を実施し、必要に応じてNFCオートメーションの実行対象を更新します。

## 「scan_idを確認してください。」が表示された場合

`scan_id`は準備APIが毎回生成する識別子です。初期設定で手入力する値ではありません。このエラーは申告リクエストに必要な識別子が入っていないことを示します。

旧版には、準備APIが端末ID不一致・タグ未紐付け・API未対応などのエラーを返しても申告を続け、元のエラーを`scan_id`不足のエラーで隠してしまう問題がありました。このエラー文だけで実際の準備失敗理由は確定できません。

修正版は準備応答を辞書として扱い、`error`があればその本文を「準備APIで失敗しました: …」として表示し、申告前に停止します。`scan_id`・`occurred_at`が欠けた場合も停止します。NFC用3本を追加し直して設定し、表示された元のエラーに応じて端末ID・タグの有効化・Shortcutsへの紐付け・Workerの配備状況を確認します。資格情報をチャットへ送る必要はありません。

[準備応答のMac E2E記録](shortcuts-preparation-e2e-report.json)には正常6本・未設定4件・準備失敗3件の成功を記録しています。準備失敗では元のエラーが表示され、申告を送らずrevisionを維持しました。応答処理のMac E2Eは、検証専用の値をあらかじめ設定した実ワークフローでも実行できます。このモードでは追加時の入力画面を検証しません。

```bash
bash scripts/shortcuts-e2e/start-mac.sh /tmp/haroin-becs-runtime-e2e --configured
```
