---
title: "README"
summary: "haroin57-webの技術構成、コンポーネント設計、ルーティングについて詳しく解説"
date: "2025-12-21T10:00:00+09:00"
tags:
  - React
  - TypeScript
  - Architecture
  - Cloudflare
---

このサイト（haroin57.com）の技術構成について解説する。Vite + React + TypeScript + Tailwind CSSで構築され、Cloudflare Pagesでホスティングされている。

## 目次

<br/>

## プロジェクト構成

```
src/
├── main.tsx                    # アプリケーションエントリーポイント
├── App.tsx                     # ランディングページ（トップページ）
├── index.css                   # グローバルスタイル
├── contexts/
│   └── AdminAuthContext.tsx    # Firebase認証コンテキスト
├── components/
│   ├── AnimatedRoutes.tsx      # ルーティング・ページ遷移アニメーション
│   ├── GlobalBackground.tsx    # 背景画像管理
│   ├── ScrollTopHomeSwitch.tsx # スクロール/スワイプによるページ切り替え
│   ├── AccessCounter.tsx       # PVカウンター
│   ├── PrefetchLink.tsx        # プリフェッチ対応リンク
│   ├── Lightbox.tsx            # 画像モーダル
│   ├── MermaidRenderer.tsx     # Mermaidダイアグラム描画
│   ├── BackButton.tsx          # 戻るボタン
│   └── admin/
│       └── MarkdownEditor.tsx  # Markdownエディタ（画像アップロード対応）
├── routes/
│   ├── Home.tsx                # ホームページ（コンテンツ一覧）
│   ├── Posts.tsx               # 記事一覧ページ
│   ├── PostDetail.tsx          # 記事詳細ページ
│   ├── Products.tsx            # プロダクト一覧ページ
│   ├── ProductDetail.tsx       # プロダクト詳細ページ
│   ├── Photos.tsx              # 写真ギャラリーページ
│   ├── BBSList.tsx             # BBS スレッド一覧ページ
│   ├── BBSThread.tsx           # BBS スレッド詳細ページ
│   └── admin/
│       ├── PostEditor.tsx      # 記事編集ページ
│       └── ProductEditor.tsx   # プロダクト編集ページ
├── lib/
│   ├── firebase.ts             # Firebase初期化
│   └── draftStorage.ts         # 下書き保存ユーティリティ
└── data/
    ├── posts.json              # 記事データ（ビルド時生成）
    ├── products.json           # プロダクトデータ
    ├── product-posts.json      # プロダクト詳細記事
    └── photos.ts               # 写真データ定義
```

<br/>

## エントリーポイント

### main.tsx

アプリケーションのエントリーポイント。

```typescript
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AdminAuthProvider>
      <GlobalBackground />
      <ScrollTopHomeSwitch />
      <AnimatedRoutes />
    </AdminAuthProvider>
  </BrowserRouter>
)
```

**依存関係:**
- `react-dom/client`: `createRoot`
- `react-router-dom`: `BrowserRouter`
- `./components/AnimatedRoutes`
- `./components/GlobalBackground`
- `./components/ScrollTopHomeSwitch`
- `./contexts/AdminAuthContext`

### App.tsx

ランディングページ（ルートパス `/`）のコンポーネント。

| 関数名 | 説明 |
|--------|------|
| `App()` | ランディングページをレンダリング。ヒーローセクションと「進む」ボタンを表示 |
| `handleNavigate()` | `/home` へナビゲート |

**機能:**
- reveal要素のアニメーション表示（`queueMicrotask`で即座にクラス追加）
- ページ読み込み時にスクロール位置をトップにリセット
- ホバーアニメーション付きの進むボタン

<br/>

## 認証コンテキスト

### AdminAuthContext.tsx

Firebase認証とセッション管理を提供するReactコンテキスト。

**定数:**

| 定数名 | 値 | 説明 |
|--------|-----|------|
| `SESSION_TIMEOUT_MS` | `60 * 60 * 1000` | セッションタイムアウト（1時間） |
| `ADMIN_EMAILS` | 環境変数から取得 | 管理者メールアドレスリスト |

**型定義:**

```typescript
type BeforeLogoutCallback = () => void | Promise<void>

type AdminAuthContextType = {
  isAdmin: boolean           // 管理者かどうか
  user: User | null          // Firebaseユーザー
  idToken: string | null     // Firebase IDトークン
  isLoading: boolean         // 認証状態読み込み中
  sessionExpiresAt: number | null  // セッション期限
  loginWithGoogle: () => Promise<boolean>  // Googleログイン
  logout: () => Promise<void>              // ログアウト
  registerBeforeLogout: (callback: BeforeLogoutCallback) => () => void
}
```

**関数:**

| 関数名 | 説明 |
|--------|------|
| `AdminAuthProvider({ children })` | 認証コンテキストプロバイダー |
| `useAdminAuth()` | 認証コンテキストを取得するフック |
| `loginWithGoogle()` | Googleポップアップでログイン。管理者でなければ即サインアウト |
| `logout(skipCallbacks?)` | ログアウト処理。登録済みコールバックを先に実行 |
| `startSessionTimeout()` | 1時間のセッションタイムアウトを設定 |
| `registerBeforeLogout(callback)` | ログアウト前に実行するコールバックを登録 |

**機能:**
- Firebase認証状態の監視（`onAuthStateChanged`）
- IDトークンの自動更新（50分ごと）
- 1時間のセッションタイムアウト
- ページリロード時のセッション維持
- ログアウト前コールバックシステム（下書き自動保存用）

<br/>

## コンポーネント

### AnimatedRoutes.tsx

ルーティングとページ遷移アニメーションを管理。

| 定数名 | 値 | 説明 |
|--------|-----|------|
| `TRANSITION_DURATION` | `400` | CSSTransitionのタイムアウト（ms） |
| `ROUTE_TRANSITIONING_DURATION` | `500` | 遷移中クラス付与時間（ms） |

**遅延読み込みルート:**

```typescript
const loadHome = () => import('../routes/Home')
const loadPosts = () => import('../routes/Posts')
const loadPostDetail = () => import('../routes/PostDetail')
const loadProducts = () => import('../routes/Products')
const loadProductDetail = () => import('../routes/ProductDetail')
const loadPhotos = () => import('../routes/Photos')
const loadBBSList = () => import('../routes/BBSList')
const loadBBSThread = () => import('../routes/BBSThread')
const loadPostEditor = () => import('../routes/admin/PostEditor')
const loadProductEditor = () => import('../routes/admin/ProductEditor')
```

**機能:**
- React.lazyによる全ルートの遅延読み込み
- `requestIdleCallback`を使用した全ルートの事前プリロード
- nodeRefキャッシュによるCSSTransitionの最適化
- 遷移中に`route-transitioning`クラスを付与

### GlobalBackground.tsx

レスポンシブ背景画像を管理。

```typescript
const BACKGROUND_SRC = '/background-1920.webp'
const BACKGROUND_SRCSET = [
  '/background-1280.webp 1280w',
  '/background-1920.webp 1920w',
  '/background-2560.webp 2560w',
  '/background-3840.webp 3840w',
].join(', ')
```

**機能:**
- srcsetによるレスポンシブ画像読み込み
- パスに応じた透明度変更（`/`では1、それ以外では0.45）
- CSS変数による動的ブラー・スケール適用

### ScrollTopHomeSwitch.tsx

スクロール/スワイプジェスチャーで`/`と`/home`間を切り替え。

| 定数名 | 値 | 説明 |
|--------|-----|------|
| `TOP_PATH` | `'/'` | トップページパス |
| `HOME_PATH` | `'/home'` | ホームページパス |

**機能:**
- ホイールスクロールで累積値120px以上で遷移
- タッチスワイプで72px以上で遷移
- 900msのクールダウン
- 入力要素やカスタム属性付き要素は無視

### AccessCounter.tsx

PV（ページビュー）カウンターを表示。

| 定数名 | 値 | 説明 |
|--------|-----|------|
| `API_ENDPOINT` | `'/api/pv'` | PVカウントAPI |
| `CACHE_KEY` | `'haroin-pv-last'` | localStorageキャッシュキー |

**機能:**
- 初回レンダリング時にAPIへPOSTリクエスト
- localStorageにカウントをキャッシュ
- オフライン時はキャッシュ値を表示

### PrefetchLink.tsx

ホバー/フォーカス時にルートチャンクをプリフェッチするリンクコンポーネント。

```typescript
interface PrefetchLinkProps extends LinkProps {
  enablePrefetch?: boolean  // プリフェッチを有効にするか（デフォルト: true）
}
```

**機能:**
- ホバー・フォーカスでルートチャンクを動的インポート
- 一度プリフェッチしたらスキップ

### Lightbox.tsx

画像モーダル（ライトボックス）コンポーネント。

```typescript
type LightboxProps = {
  isOpen: boolean           // モーダル表示状態
  onClose: () => void       // 閉じるコールバック
  imageSrc: string          // 画像URL
  imageAlt: string          // 画像alt
  children?: React.ReactNode  // 追加コンテンツ
}
```

**機能:**
- Escapeキーで閉じる
- 背景クリックで閉じる
- 閉じるボタン
- 画像下に追加情報を表示可能

### MermaidRenderer.tsx

Mermaidダイアグラムをレンダリング。

| コンポーネント名 | Props | 説明 |
|-----------------|-------|------|
| `MermaidRenderer` | `{ chart, className }` | Mermaidコードをレンダリング |
| `MermaidBlock` | `{ code }` | Markdownから抽出されたMermaidブロック用ラッパー |

**機能:**
- mermaidライブラリを使用した非同期レンダリング
- ダークテーマ設定
- エラー時はエラーメッセージと元コードを表示

<br/>

## ページコンポーネント

### Home.tsx

ホームページ（コンテンツ一覧）。

```typescript
type Interest = { title: string; text: string }
type PostMeta = { slug?: string; title?: string; createdAt?: string }
```

**機能:**
- Interests（興味分野）の折りたたみ表示
- 最新記事5件の表示
- Products, Photos, BBSへのリンク
- フッター（AccessCounter、SNSリンク）

### Posts.tsx

記事一覧ページ。

**機能:**
- CMS APIから記事一覧を取得（フォールバック: 静的JSON）
- タグによるフィルタリング
- 管理者UI（新規作成、編集、ログアウト）

### PostDetail.tsx

記事詳細ページ。

**機能:**
- Mermaidダイアグラムのレンダリング
- コードブロックのコピーボタン
- スクロールに応じた背景ブラー効果
- Good（いいね）機能
- X（Twitter）シェアボタン
- OGP/Twitterカードのメタタグ設定

### BBSList.tsx / BBSThread.tsx

BBS（掲示板）機能。

**BBSList機能:**
- スレッド一覧表示
- スレッド作成フォーム
- 管理者ログイン/ログアウト
- 管理者によるスレッド削除

**BBSThread機能:**
- 投稿一覧表示
- アンカーリンク（>>数字）のクリックでスムーズスクロール
- 投稿フォーム
- 管理者による投稿削除

<br/>

## 管理者機能

### PostEditor.tsx

記事編集ページ。

```typescript
type PostData = {
  slug: string
  title: string
  summary: string
  markdown: string
  html: string
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

**機能:**
- 新規作成/編集の両対応
- 下書きの自動保存・復元
- ログアウト前に下書き自動保存
- Markdownエディタ
- フォーム検証

### MarkdownEditor.tsx

管理者用Markdownエディタ。

**機能:**
- `@uiw/react-md-editor`ベースのエディタ
- ライブプレビュー
- Frontmatterのパースと表示
- Mermaidダイアグラムのプレビュー
- KaTeX数式のプレビュー
- 画像のドラッグ&ドロップ/ペーストアップロード

<br/>

## ライブラリ・ユーティリティ

### firebase.ts

Firebase初期化。

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
```

### draftStorage.ts

下書き保存ユーティリティ。localStorageを使用。

```typescript
export type PostDraft = {
  slug: string
  title: string
  summary: string
  tags: string
  markdown: string
  savedAt: number
}
```

| 関数名 | 説明 |
|--------|------|
| `getDraftKey(type, slug)` | 下書きキーを生成 |
| `saveDraft<T>(type, slug, data)` | 下書きを保存 |
| `loadDraft<T>(type, slug)` | 下書きを読み込み |
| `deleteDraft(type, slug)` | 下書きを削除 |
| `getAllDrafts()` | 全下書きを取得 |
| `hasDraft(type, slug)` | 下書きが存在するか |
| `formatDraftDate(savedAt)` | 保存日時をフォーマット |

<br/>

## データファイル

### photos.ts

写真データ定義。

```typescript
export type PhotoRatio = 'portrait' | 'landscape' | 'square'

export type Photo = {
  src: string      // 画像ファイルパス
  title: string    // 写真タイトル
  location: string // 撮影場所
  date: string     // 撮影日（YYYY-MM-DD形式）
  camera: string   // カメラ種類
  lens: string     // レンズ情報
  exposure: string // 露出情報
  note: string     // 写真の説明文
  ratio: PhotoRatio // アスペクト比
  tone: string     // アクセントカラー（HEX形式）
}
```

<br/>

## 依存関係一覧

### React関連

- `react` - UIライブラリ
- `react-dom` - DOM操作
- `react-router-dom` - ルーティング
- `react-transition-group` - ページ遷移アニメーション

### Firebase

- `firebase/app` - Firebase初期化
- `firebase/auth` - 認証

### Markdown/コンテンツ

- `@uiw/react-md-editor` - Markdownエディタ
- `unified`, `remark-*`, `rehype-*` - Markdownパイプライン
- `mermaid` - ダイアグラム描画
- `rehype-katex`, `remark-math` - 数式レンダリング

### スタイリング

- `tailwindcss` - CSSフレームワーク

---

<br/>

## ローカル記事のデプロイ

ローカル環境で作成したMarkdownファイルをCloudflare KVのCMSにデプロイするための機能について解説する。

### 概要

Web上のエディタだけでなく、VSCodeなどのローカルエディタで記事を書き、それをコマンド一つでCMSにデプロイできる。これにより：

- 使い慣れたエディタで執筆可能
- Gitでの記事バージョン管理
- 複数記事の一括デプロイ
- CI/CDパイプラインとの連携

### Markdownファイルの形式

記事は`content/posts/`ディレクトリにMarkdownファイルとして配置する。

#### ディレクトリ構造

```
content/
└── posts/
    ├── my-first-article.md
    ├── react-tutorial.md
    └── typescript-tips.md
```

ファイル名（拡張子を除く）が記事のslug（URL識別子）になる。

#### frontmatter（メタデータ）

各Markdownファイルの先頭にYAML形式でメタデータを記述：

```yaml
---
title: "記事タイトル"
summary: "記事の概要（一覧ページで表示される説明文）"
date: "2025-01-15"
tags:
  - React
  - TypeScript
  - Tutorial
status: published  # オプション: published または draft
---

本文をここに書きます...
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `title` | ◯ | 記事のタイトル |
| `summary` | △ | 記事の概要（省略可） |
| `date` | △ | 作成日（YYYY-MM-DD形式） |
| `tags` | △ | タグの配列 |
| `status` | △ | `published`（公開）または `draft`（下書き） |

### デプロイスクリプトの使い方

#### Firebase IDトークンの取得

デプロイには管理者認証が必要。ブラウザの開発者ツールで以下を実行してトークンを取得：

```javascript
// Firebaseにログイン済みの状態で実行
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
console.log(token);
```

#### 基本的な使い方

```bash
# 環境変数にトークンを設定
export FIREBASE_ID_TOKEN="取得したトークン"

# content/posts/ 配下のすべての記事をデプロイ
npx tsx scripts/deploy-posts.ts

# 特定のファイルのみデプロイ
npx tsx scripts/deploy-posts.ts --file content/posts/my-article.md

# 下書きとしてデプロイ
npx tsx scripts/deploy-posts.ts --draft

# ドライラン（実際にはデプロイせず確認のみ）
npx tsx scripts/deploy-posts.ts --dry-run
```

#### コマンドラインオプション

| オプション | 説明 | 例 |
|-----------|------|-----|
| `--file <path>` | 指定したファイルのみをデプロイ | `--file content/posts/article.md` |
| `--draft` | 下書きとしてデプロイ（frontmatterのstatusを上書き） | `--draft` |
| `--dry-run` | 実際にはデプロイせず、処理内容を表示 | `--dry-run` |
| `--endpoint <url>` | CMS APIのエンドポイント | `--endpoint http://localhost:8787/api/cms` |
| `--token <token>` | Firebase IDトークン（環境変数の代わりに指定） | `--token eyJhbGci...` |

#### 環境変数

| 変数名 | 説明 |
|--------|------|
| `FIREBASE_ID_TOKEN` | Firebase IDトークン（認証用） |
| `CMS_ENDPOINT` | CMS APIのエンドポイント（デフォルト: https://haroin57.com/api/cms） |

### 使用例

#### 新しい記事を書いて公開する

```bash
# 1. 記事ファイルを作成
cat > content/posts/new-article.md << 'EOF'
---
title: "新しい記事"
summary: "この記事では..."
date: "2025-01-15"
tags:
  - Tech
---

## はじめに

記事の本文をここに書きます。
EOF

# 2. デプロイ
export FIREBASE_ID_TOKEN="your-token"
npx tsx scripts/deploy-posts.ts --file content/posts/new-article.md
```

#### 下書きとして保存し、後で公開する

```bash
# 下書きとしてデプロイ
npx tsx scripts/deploy-posts.ts --file content/posts/draft-article.md --draft

# 後で公開する場合は、frontmatterのstatusをpublishedに変更して再デプロイ
# または、Webの管理画面からステータスを変更
```

#### すべての記事を一括更新

```bash
# 既存の記事も含めてすべてデプロイ
npx tsx scripts/deploy-posts.ts

# まずドライランで確認
npx tsx scripts/deploy-posts.ts --dry-run
```

### Markdownの記法

デプロイスクリプトは、Webエディタと同じMarkdown変換処理を使用している。

#### サポートされる構文

- **GitHub Flavored Markdown (GFM)**: テーブル、取り消し線、タスクリストなど
- **目次の自動生成**: `## 目次` という見出しの後に自動的に目次が挿入される
- **コードハイライト**: シンタックスハイライト付きコードブロック
- **数式 (KaTeX)**: `$inline$` や `$$display$$` 形式の数式
- **Mermaidダイアグラム**: `mermaid` コードブロック
- **アドモニション**: `[!NOTE]`、`[!WARNING]`、`[!CALLOUT]`

#### アドモニションの例

```markdown
> [!NOTE]
> これはメモです。重要な情報を強調したいときに使用します。

> [!WARNING]
> これは警告です。注意が必要な内容を示します。

> [!CALLOUT] タイトル
> これはコールアウトです。特に目立たせたい内容に使用します。
```

### トラブルシューティング

#### 認証エラー

```
Error: unauthorized
```

**原因**: トークンが無効または期限切れ

**対処法**:
1. 新しいトークンを取得する
2. トークンが正しく設定されているか確認
3. 管理者メールリストに登録されているか確認

#### frontmatterのパースエラー

**原因**: YAMLの形式が正しくない

**対処法**:
- インデントが正しいか確認（スペース2つ）
- 特殊文字を含むタイトルは引用符で囲む
- 日付は `"YYYY-MM-DD"` 形式で記述

### CI/CDとの連携

GitHub Actionsでの自動デプロイ例：

```yaml
name: Deploy Posts

on:
  push:
    paths:
      - 'content/posts/**'
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Deploy posts
        env:
          FIREBASE_ID_TOKEN: ${{ secrets.FIREBASE_ID_TOKEN }}
        run: npx tsx scripts/deploy-posts.ts
```

**注意**: CI/CDでのトークン管理には注意が必要。長期間有効なサービスアカウントトークンの使用を検討すること。
