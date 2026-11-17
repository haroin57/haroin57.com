# 本人Macでのコンパイル・署名

本人MacへTailscale SSHで接続し、Cherri 2.4.0とAppleの`shortcuts` CLIを確認しました。6本の配布用ファイルは、本人Mac上でAppleのCLIにより`--mode anyone`で署名済みです。iPhoneへの追加とNFCの実機確認は別途必要です。

## 実施結果

- 既存ショートカットを上書きせず、Macの`/tmp/haroin-becs-public-final-20261117`で作業しました。Macの既存設定やKeychainは変更していません。
- Cherriでは`control.cherri`のコンパイルと署名に成功しました。一方、NFC用の複雑な辞書・変数参照を含むソースは、Cherri 2.4.0内部の辞書変換処理でpanicになりました。6本すべてのCherriコンパイルに成功したとは扱いません。
- XML plistの直接署名ではApple CLIのタイムアウトが発生しました。同じワークフローをバイナリplistへ変換し、Apple CLIで署名する方式では6本すべて成功しました。配布版はこの経路で作成したファイルです。
- Apple CLIはエラー表示後にも終了コード0を返す場合があるため、署名スクリプトは終了コードだけでなく、新しく生成されたファイルの存在・サイズ・`AEA1`ヘッダーも確認します。
- Macから取得したファイルは`public/shortcuts/signed/`に保存しています。Macの拡張属性・AppleDoubleファイルは配布に含めません。
- `artifact-manifest.json`には6本のサイズ、署名済みファイルのSHA-256、元の署名前plistのSHA-256、署名モードを記録しました。署名後のバイト列は変更していません。

## 再署名

リポジトリの`shortcuts/sources/`、`public/shortcuts/*.unsigned.shortcut`、署名用スクリプトを本人Macの新しい作業ディレクトリへ転送し、そこで実行します。資格情報はiPhoneへの追加時の設定画面で入力し、署名用ファイルへ埋め込みません。

```bash
bash scripts/sign-shortcuts.sh public/shortcuts /tmp/haroin-signed-shortcuts
```

Cherri経由のコンパイル確認も行う場合は以下を使用します。

```bash
bash scripts/build-shortcuts-mac.sh /tmp/haroin-becs-shortcuts-release
```

このスクリプトは各Cherriソースのログを`cherri/`へ残し、コンパイル失敗時も検証済みplistからのApple署名を続けます。配布用の`signed/`は6本が揃い、署名形式を確認できた場合だけ成功とします。Cherriの成功分は代替成果物で、配布用6本とは区別します。

Appleの署名では、ファイルが検証のためAppleへ送信されます。[Apple公式CLI手順](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac)に従い、共有用ファイルへ資格情報を含めません。

## 実行E2E

本人MacのApple Shortcutsで6本をインポート・実行しました。NFC用3本では追加時の設定画面から検証用の端末ID・タグID・資格情報を入力し、起床→外出→研究室到着の順に実Workerハンドラーで受理され、revision 3・RESEARCHへ遷移しました。公開統計GETと3つの画面遷移も確認しました。

端末ID空欄・タグID空欄・資格情報空欄・資格情報プレースホルダーの4件では、設定案内を表示し、POSTを送らず状態を維持しました。結果は[shortcuts-e2e-report.json](shortcuts-e2e-report.json)に記録しています。Macのループバックと検証専用SQLiteで実行しており、本番データは変更していません。実行手順は[shortcuts.md](shortcuts.md#mac-e2eと修正版への更新)に記載しています。

公開版はこの検証で使用した生成スクリプトから、資格情報を含まないプレースホルダー版として6本を再生成し、Apple CLIで再署名しました。個人設定済みの検証ファイルは配布しません。

## 準備API失敗時の表示修正

NFC用3本を`/tmp/haroin-becs-prepare-public-20261117`でApple CLIのmode anyoneにより再署名しました。公開ログ・管理画面・集中画面の3本は既存の署名済みファイルを維持しています。

[追加E2E記録](shortcuts-preparation-e2e-report.json)では、正常6本・未設定ガード4件に加え、端末ID不一致・タグ未紐付け・未対応の準備APIパスの3件で、実Workerの元のエラーを表示して申告を送信しないことを確認しました。この実行は設定済みの検証用ワークフローによる応答処理の検証です。追加時の入力画面の検証記録は前回の[実行記録](shortcuts-e2e-report.json)です。iPhoneで報告された準備失敗の具体的な理由は、このMac検証だけでは確定していません。
