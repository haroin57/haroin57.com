# AGENTS.md — haroin57.com（Agent向けガイド）

このリポジトリでコーディングエージェント（Codex / Claude Code など）が迷わず作業するための手順とルールです。

## TL;DR（まずこれ）
- 依存導入: `npm ci`（初回/クリーン推奨）
- 開発: `npm run dev`
- ビルド: `npm run build`（TypeScript + Vite + 生成スクリプト）
- 変更後は **`npm run build` が通ること** を最低条件にする（未使用importで落ちやすい）

---

## 1. リポジトリ概要
- フロントエンド: React + TypeScript + Vite
- コンテンツ: `content/` 配下の Markdown を元に、`scripts/` の生成処理で `src/data/*.json` を生成して画面に表示する構成。
- 主なディレクトリ:
  - `src/` … アプリ本体
  - `content/` … 記事/プロダクト等の元データ（Markdown）
  - `scripts/` … Markdown → JSON 生成スクリプト
  - `public/` … 静的アセット

---

## 2. よく使うコマンド
### セットアップ
```bash
npm ci
```
（`package-lock.json` があるので `npm ci` を優先。更新が必要な場合だけ `npm install`）

### 開発サーバ
```bash
npm run dev
```

### ビルド（重要）
```bash
npm run build
```

> 注意: TypeScript 設定により、未使用の import/変数でビルドが落ちます（例: `TS6133: 'Link' is declared but its value is never read.`）。  
> 直し方は基本「未使用の import を消す」。意図的に残す必要があるなら、実際に使う実装を入れる。

---

## 3. コンテンツ編集フロー（Markdown → JSON 生成）
このリポジトリは、`content/` を更新したら **生成スクリプトで `src/data/*.json` を更新**する前提です。

### 生成物（例）
- `src/data/posts.json`
- `src/data/product-posts.json`

### 生成コマンド（build の中で呼ばれている想定）
`npm run build` を走らせれば基本OKです。  
もし生成だけ回したい場合は、`scripts/` の該当スクリプトを node で実行します（リポジトリの build に合わせて実行）。

例:
```bash
node --experimental-strip-types scripts/gen-posts.ts
node --experimental-strip-types scripts/gen-product-posts.ts
```

### ルール
- `src/data/*.json` は **手書きで編集しない**（必ず `content/` と `scripts/` を直す）
- PR/コミットには、必要なら **生成後の JSON 変更も含める**（差分がないなら含めない）

---

## 4. コード変更の作法（このリポジトリでブレないために）
### TypeScript / React
- コンポーネントは関数コンポーネントを基本
- ルーティング/ページ相当は `src/routes/` に寄せる
- 未使用の `import` / 変数 / 引数は残さない（ビルドやLintで落ちやすい）

### 変更は小さく、レビューしやすく
- 1コミット（or 1PR）で目的が1つになるように分割
- `package-lock.json` は **依存追加/更新が必要な時だけ** 触る

---

## 5. エージェント運用（並列作業する場合）
同一プロジェクトに対して並列でエージェントを走らせるときは、衝突を避けるため **worktree 分割**を推奨。

### 推奨ルール
- 1エージェント = 1 worktree = 1 ブランチ
- 同じファイルを複数エージェントが同時に触らないように、担当範囲を分ける  
  - 例: Agent A は `content/` と生成、Agent B は `src/routes/` のUI、など

### 成果物の出し方
- 「何を」「なぜ」「どう変えたか」を短くまとめる
- 最低限 `npm run build` が通る状態で提出する

---

## 6. コミット前チェックリスト
- [ ] `npm run build` が通る
- [ ] 未使用 import/変数が残っていない
- [ ] 生成物（`src/data/*.json`）を手で編集していない
- [ ] 変更範囲が過剰に広がっていない（関係ない整形・リネームを混ぜていない）

---

## 7. エージェントへのお願い（重要）
- 推測で大規模リファクタはしない（まず既存の流れを尊重）
- 依存追加は最小限（必要性を明記）
- 生成フローを壊さない（content/scripts/src の関係を維持）
