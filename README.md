# haroin57-web

信州大学 工学部在学中のharoinの個人ポートフォリオ・ブログサイト

## 概要

haroin57-webは、React 19とCloudflare Workersを基盤とした、モダンなフルスタックウェブアプリケーションです。個人ブログ、プロダクトショーケース、掲示板システム（BBS）、管理者向けCMSを統合した多機能プラットフォームです。

## 主な機能

### 公開機能
- **ブログシステム**: Markdownベースの記事管理、タグフィルタリング、目次自動生成
- **プロダクトショーケース**: 作品・プロジェクトの展示ギャラリー
- **BBS（掲示板）**: 匿名投稿可能なスレッド型コミュニケーションシステム
- **フォトギャラリー**: ビジュアルコンテンツの展示
- **インタラクティブ背景**: p5.jsによる4次元ハイパーキューブアニメーション
- **タイムライン**: 全コンテンツの更新履歴を統合表示
- **アクセスカウンター**: ページビュー追跡システム

### 管理者機能
- **Firebase認証**: Googleアカウントによる管理者ログイン
- **記事エディター**: ライブプレビュー付きMarkdownエディター
- **プロダクト管理**: 作品情報の作成・編集
- **ドラフト機能**: 下書き保存システム
- **画像アップロード**: Cloudflare R2への画像アップロード

## 技術スタック

### フロントエンド
- **React 19.2.3** + React Router 7.9.6
- **TypeScript 5.9** (strict mode)
- **Vite** (ビルドツール)
- **Tailwind CSS 3.4** (スタイリング)
- **p5.js 2.1.2** (インタラクティブ背景)

### バックエンド/インフラ
- **Cloudflare Workers** (サーバーレスコンピューティング)
- **D1 Database** (SQLiteデータベース)
- **R2 Bucket** (画像ストレージ)
- **KV Namespace** (キーバリューストア)
- **Firebase** (認証)

### Markdown処理
- **remark/rehype** エコシステム
- **KaTeX** (数式レンダリング)
- **Mermaid** (ダイアグラム生成)
- **rehype-highlight** (シンタックスハイライト)

## セットアップ

### 必要要件
- Node.js 18以上
- npm または pnpm
- Cloudflareアカウント（本番環境用）
- Firebaseプロジェクト（管理者認証用）

### インストール

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 環境変数

```env
# Firebase設定
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Cloudflare設定
CF_ACCOUNT_ID=your-account-id
CF_API_TOKEN=your-api-token

# 管理者設定
ADMIN_SECRET=your-admin-secret
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

## 開発

```bash
# 開発サーバー起動
npm run dev

# 記事JSONの生成
npm run posts:gen

# プロダクトJSONの生成
npm run products:gen

# ビルド
npm run build

# プレビュー
npm run preview

# ESLint実行
npm run lint
```

## ビルドプロセス

```bash
npm run build
```

このコマンドは以下を実行します：
1. TypeScript型チェック
2. 記事データの生成
3. プロダクトデータの生成
4. Viteによるビルド
5. SSRビルド
6. 静的HTMLの事前レンダリング

## デプロイ

### Cloudflare Workersへのデプロイ

```bash
# 記事をD1データベースへデプロイ
npm run posts:deploy

# Workerをデプロイ
npx wrangler deploy
```

### 必要なCloudflareリソース

1. **D1 Database** (2つ)
   - `POSTS_DB`: 記事とプロダクト用
   - `BBS_DB`: 掲示板用

2. **KV Namespace**
   - `HAROIN_PV`: PVカウントとレート制限用

3. **R2 Bucket**
   - `CMS_IMAGES`: 画像ストレージ用

## プロジェクト構造

```
src/
├── main.tsx                    # クライアントエントリー
├── entry-server.tsx            # サーバーエントリー（SSG/SSR）
├── App.tsx                     # ランディングページ
├── contexts/                   # Reactコンテキスト
│   └── AdminAuthContext.tsx    # Firebase認証
├── components/                 # 共通コンポーネント
│   ├── AnimatedRoutes.tsx      # ルーティング管理
│   ├── GlobalBackground.tsx    # 背景管理
│   ├── P5HypercubeBackground.tsx # 4Dアニメーション
│   └── ...
├── routes/                     # ページコンポーネント
│   ├── Home.tsx               # ホーム
│   ├── Posts.tsx              # ブログ一覧
│   ├── PostDetail.tsx         # ブログ詳細
│   ├── Products.tsx           # プロダクト一覧
│   ├── ProductDetail.tsx      # プロダクト詳細
│   ├── BBSList.tsx            # BBS一覧
│   ├── BBSThread.tsx          # BBSスレッド
│   └── admin/                 # 管理者ページ
│       ├── PostEditor.tsx     # 記事編集
│       └── ProductEditor.tsx  # プロダクト編集
├── hooks/                     # カスタムフック
├── utils/                     # ユーティリティ
├── lib/                       # ライブラリ設定
└── data/                      # 静的データ
```

## APIエンドポイント

### 公開API
- `GET /api/pv/:path` - PVカウント取得
- `POST /api/pv/:path` - PVカウント増加
- `GET /api/bbs/threads` - BBSスレッド一覧
- `GET /api/bbs/thread/:threadId` - スレッド詳細
- `POST /api/bbs/thread` - スレッド作成
- `POST /api/bbs/post` - 投稿作成

### 管理者API (要認証)
- `GET /api/cms/posts` - 記事一覧
- `POST /api/cms/post` - 記事作成
- `PUT /api/cms/post/:slug` - 記事更新
- `PATCH /api/cms/post/:slug/publish` - 記事公開/非公開
- `DELETE /api/cms/post/:slug` - 記事削除
- `POST /api/cms/image` - 画像アップロード

## パフォーマンス最適化

- **コード分割**: React.lazyによるルートベース分割
- **プリフェッチ**: hover/focus時の先読み（PrefetchLink）
- **React Compiler**: 自動メモ化による最適化
- **SSG**: 静的HTMLの事前生成
- **画像最適化**: WebP変換とレスポンシブ画像生成

## セキュリティ

- **Firebase認証**: 管理者機能の保護
- **レート制限**: KVによるAPIレート制限
- **CORS設定**: 適切なCORS設定
- **環境変数**: センシティブ情報の環境変数管理

## ライセンス

個人プロジェクトのため、ライセンス未設定。

## 作者

haroin - 信州大学 工学部

## リンク

- [本番サイト](https://haroin57.com)
- [GitHub](https://github.com/haroin)

---

## 詳細ドキュメント

プロジェクトの詳細な技術仕様については、[技術リファレンス](./docs/TECHNICAL_REFERENCE.md)を参照してください。