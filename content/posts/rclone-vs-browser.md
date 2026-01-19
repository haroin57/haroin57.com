---
title: "rcloneがブラウザ版Google Driveより圧倒的に優れている理由"
summary: "クラウドストレージへのファイル転送にrcloneを使うべき理由を解説。並列転送、レジューム機能、自動化など、ブラウザ版では実現できない機能を紹介する"
date: "2026-01-17"
tags:
  - rclone
  - Google Drive
  - バックアップ
  - CLI
---

## 目次

- [目次](#目次)
- [はじめに](#はじめに)
- [rcloneとは](#rcloneとは)
- [ブラウザ版との比較](#ブラウザ版との比較)
- [rcloneの強み](#rcloneの強み)
  - [並列転送](#並列転送)
  - [レジューム機能](#レジューム機能)
  - [大容量ファイル対応](#大容量ファイル対応)
  - [自動化・スケジュール実行](#自動化スケジュール実行)
  - [帯域制限](#帯域制限)
  - [複数クラウド対応](#複数クラウド対応)
- [インストールと初期設定](#インストールと初期設定)
- [実践的な使い方](#実践的な使い方)
  - [基本的なコピー](#基本的なコピー)
  - [高速転送設定](#高速転送設定)
  - [同期（ミラーリング）](#同期ミラーリング)
- [パフォーマンス比較](#パフォーマンス比較)
- [注意点](#注意点)
- [まとめ](#まとめ)

<br/>

## はじめに

PCのストレージがいっぱいになってきたので、Google Driveに退避しようと思った。ブラウザからドラッグ&ドロップでアップロードを始めたが、35GBのフォルダを転送しようとしたら途中で止まる、遅い、再開できないの三重苦で、効率的な方法を探していたところrcloneにたどり着いた。

Google Driveにファイルをアップロードするとき、ブラウザからドラッグ&ドロップしている人は多いと思う。少量のファイルなら問題ないが、フォルダ丸ごとバックアップしたいとか、数十GBのデータを転送したいとなると、ブラウザ版では力不足だ。

本記事では、クラウドストレージ操作のCLIツール **rclone** を紹介する。一度使うと、もうブラウザには戻れなくなる。

<br/>

## rcloneとは

**rclone** は、クラウドストレージを操作するためのオープンソースのCLIツールだ。「クラウド版rsync」とも呼ばれている。

対応しているクラウドストレージは40種類以上。

| サービス | 対応状況 |
|---------|---------|
| Google Drive | ○ |
| Amazon S3 | ○ |
| Dropbox | ○ |
| OneDrive | ○ |
| Box | ○ |
| SFTP | ○ |
| その他多数 | ○ |

Go言語で書かれており、Windows、macOS、Linuxで動作する。

<br/>

## ブラウザ版との比較

rcloneとブラウザ版Google Driveの機能を比較してみる。

| 項目 | rclone | ブラウザ版 |
|------|--------|-----------|
| **並列アップロード** | 16個以上同時可能 | 基本1個ずつ |
| **大容量ファイル** | 制限なし | 5GB以上で不安定 |
| **フォルダ丸ごと転送** | 一発でできる | 途中で止まることも |
| **レジューム** | 自動で続きから | 最初からやり直し |
| **スケジュール実行** | タスクスケジューラで自動化可能 | 手動のみ |
| **差分同期** | 変更ファイルだけ転送 | 全部やり直し |
| **帯域制限** | `--bwlimit`で調整可能 | できない |
| **暗号化** | 対応（crypt） | なし |
| **CLI/自動化** | スクリプトで完全自動化 | できない |

特に差が出るのは「並列転送」と「レジューム機能」だ。35GBのフォルダをアップロードする作業で、ブラウザなら半日かかるところが、rcloneなら1時間程度で終わる。

<br/>

## rcloneの強み

### 並列転送

rcloneは複数のファイルを同時にアップロードできる。デフォルトは4並列だが、設定で増やせる。

```bash
# 16並列でアップロード
rclone copy ./local gdrive:backup --transfers 16
```

小さいファイルが大量にあるフォルダでは、この並列転送が効いてくる。ブラウザ版だと1ファイルずつ順番に処理されるため、オーバーヘッドが積み重なって遅くなる。

### レジューム機能

転送が途中で止まっても、同じコマンドを再実行すれば続きから再開される。

```bash
# 途中で止まっても、同じコマンドで続きから
rclone copy ./local gdrive:backup
```

rcloneは転送先に既に存在するファイルを自動でスキップする。ファイルサイズとタイムスタンプを比較して、変更がなければ転送しない。

ブラウザ版だと、接続が切れたら最初からやり直しになることが多い。特に大きなフォルダを転送しているときにこれが起きると、かなりのストレスだ。

### 大容量ファイル対応

ブラウザ版は5GB以上のファイルをアップロードしようとすると、タイムアウトしたり、進捗が止まったりすることがある。

rcloneは大容量ファイルを自動的にチャンク分割してアップロードするため、この問題が起きない。

```bash
# チャンクサイズを256MBに設定
rclone copy ./large-file.iso gdrive:backup --drive-chunk-size 256M
```

### 自動化・スケジュール実行

CLIツールなので、Windowsのタスクスケジューラと組み合わせて自動バックアップが実現できる。これが個人的には一番の魅力だと思っている。

#### バックアップ用バッチファイルの作成

まず、バックアップ用のバッチファイルを作成する。

```batch
@echo off
:: backup-to-drive.bat
:: ログフォルダがなければ作成
if not exist "C:\logs" mkdir "C:\logs"

:: 日付付きログファイル名
set LOGFILE=C:\logs\rclone_%date:~0,4%%date:~5,2%%date:~8,2%.log

:: rcloneでバックアップ実行
rclone sync "C:\Users\harut\Documents" gdrive:Documents_Backup ^
  --transfers 8 ^
  --checkers 16 ^
  --log-file="%LOGFILE%" ^
  --log-level INFO
```

このバッチファイルを `C:\scripts\backup-to-drive.bat` などに保存する。

#### タスクスケジューラへの登録

1. `Win + R` で「taskschd.msc」を入力してタスクスケジューラを開く
2. 右側の「タスクの作成」をクリック
3. 「全般」タブ：
   - 名前：「rclone Daily Backup」など
   - 「ユーザーがログオンしているかどうかにかかわらず実行する」を選択
   - 「最上位の特権で実行する」にチェック
4. 「トリガー」タブ：
   - 「新規」→ 毎日、深夜3:00などに設定
5. 「操作」タブ：
   - 「新規」→ プログラム/スクリプトに `C:\scripts\backup-to-drive.bat` を指定
6. 「条件」タブ：
   - 「コンピューターをAC電源で使用している場合のみタスクを開始する」のチェックを外す（ノートPCの場合）
7. 「OK」で保存（パスワード入力を求められる）

#### PowerShellでの登録（コマンドで済ませたい人向け）

GUIが面倒な場合はPowerShellでも登録できる。

```powershell
# タスク作成（毎日AM3:00に実行）
$action = New-ScheduledTaskAction -Execute "C:\scripts\backup-to-drive.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "rclone Daily Backup" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
```

これで毎日自動的にバックアップが走る。ログファイルを確認すれば、正常に実行されたかどうかもわかる。

ブラウザ版では、こうした自動化は不可能だ。

### 帯域制限

アップロード中に他の作業をしたい場合、帯域を制限できる。

```bash
# 10MB/sに制限
rclone copy ./local gdrive:backup --bwlimit 10M
```

回線を専有せずにバックグラウンドで転送を続けられる。

### 複数クラウド対応

rcloneは40種類以上のクラウドストレージに対応している。設定を追加すれば、Google DriveからDropboxへの直接コピーなども可能だ。

```bash
# Google DriveからS3へ直接コピー
rclone copy gdrive:backup s3:my-bucket/backup
```

ローカルを経由せずにクラウド間で直接転送できるのは、rcloneならではの機能だ。

<br/>

## インストールと初期設定

Windowsの場合、wingetでインストールできる。

```powershell
winget install Rclone.Rclone
```

インストール後、Google Driveの設定を行う。

```bash
rclone config
```

対話形式で設定を進める。

1. `n` を入力（新規リモート作成）
2. 名前を入力（例: `gdrive`）
3. Storage typeで `drive` を選択
4. client_id と client_secret は空でEnter
5. scopeは `1`（フルアクセス）を選択
6. 残りはデフォルトでEnter
7. ブラウザが開くのでGoogleアカウントでログイン
8. 認証完了したら `q` で終了

設定が完了すると、以下のコマンドでGoogle Driveの内容を確認できる。

```bash
rclone ls gdrive:
```

<br/>

## 実践的な使い方

### 基本的なコピー

ローカルフォルダをGoogle Driveにコピーする。

```bash
rclone copy C:\Users\harut\Downloads gdrive:Downloads_Backup --progress
```

`--progress` オプションをつけると、転送状況がリアルタイムで表示される。

### 高速転送設定

大量のファイルを高速に転送したい場合は、以下のオプションを使う。

```bash
rclone copy C:\Users\harut\Downloads gdrive:Downloads_Backup \
  --progress \
  --transfers 16 \
  --checkers 32 \
  --buffer-size 128M \
  --drive-chunk-size 256M \
  --fast-list
```

| オプション | 説明 |
|-----------|------|
| `--transfers 16` | 同時転送ファイル数 |
| `--checkers 32` | 同時チェック数 |
| `--buffer-size 128M` | メモリバッファサイズ |
| `--drive-chunk-size 256M` | Google Drive用チャンクサイズ |
| `--fast-list` | リスト取得の高速化 |

これで転送速度が大幅に向上する。ただし、並列数を増やしすぎるとGoogleのAPI制限に引っかかる可能性があるので、エラーが出たら調整する。

### 同期（ミラーリング）

`sync` コマンドを使うと、ローカルとリモートを完全に同期できる。

```bash
rclone sync C:\Users\harut\Documents gdrive:Documents_Backup
```

**注意**: `sync` はリモート側にしかないファイルを削除する。誤って重要なファイルを消さないよう、最初は `--dry-run` で確認することをおすすめする。

```bash
# 実際には実行せず、何が行われるかを表示
rclone sync C:\Users\harut\Documents gdrive:Documents_Backup --dry-run
```

<br/>

## パフォーマンス比較

実際に35GBのフォルダ（約11,000ファイル）をアップロードした際の比較。

| 方法 | 所要時間 | 備考 |
|------|---------|------|
| ブラウザ版 | 約5時間 | 途中で2回止まった |
| rclone（デフォルト） | 約2時間 | 安定して完了 |
| rclone（高速設定） | 約45分 | transfers 16, checkers 32 |

rcloneの高速設定を使うと、ブラウザ版の約6倍速くなった。特に小さいファイルが大量にある場合、並列処理の効果が顕著に現れる。

<br/>

## 注意点

rcloneを使う上での注意点をいくつか挙げておく。

- **API制限**: Google DriveのAPIにはレート制限がある。並列数を増やしすぎると `403` エラーが出ることがある。その場合は `--transfers` を減らす

- **認証トークンの管理**: rcloneの設定ファイル（`~/.config/rclone/rclone.conf`）には認証情報が含まれる。取り扱いには注意が必要

- **syncコマンドの危険性**: `sync` はリモート側のファイルを削除する可能性がある。`copy` の方が安全

- **共有ドライブ**: Google Workspaceの共有ドライブを使う場合は、追加の設定が必要

<br/>

## まとめ

rcloneは、クラウドストレージを扱う上で最強のツールだと思う。

| 機能 | 評価 |
|------|------|
| 並列転送 | ★★★★★ |
| レジューム | ★★★★★ |
| 自動化 | ★★★★★ |
| 複数クラウド対応 | ★★★★★ |
| 学習コスト | ★★★☆☆ |

ブラウザ版で十分な人もいるだろうが、以下に当てはまる人はrcloneを試す価値がある。

- 大量のファイルをバックアップしたい
- 定期的な自動バックアップを設定したい
- 転送が途中で止まるのがストレス
- 複数のクラウドサービスを使っている

一度CLIに慣れてしまうと、ブラウザでポチポチやるのが面倒に感じるようになる。興味があればぜひ試してみてほしい。
