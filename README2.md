# haroin57-web

個人サイト [haroin57.com](https://haroin57.com) のソースコード

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS |
| **Backend** | Cloudflare Workers (TypeScript) |
| **Database** | Cloudflare KV (NoSQL), R2 (画像ストレージ) |
| **Auth** | Firebase Authentication (Google OAuth) |
| **Deploy** | Cloudflare Pages + Workers |

## アーキテクチャ

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   React SPA     │────▶│  Cloudflare Workers (pv-worker.ts)   │
│  (Vite + React) │     │                                      │
└─────────────────┘     │  ┌─────────┐  ┌─────────┐  ┌──────┐  │
                        │  │  PV API │  │ CMS API │  │ BBS  │  │
                        │  └────┬────┘  └────┬────┘  └──┬───┘  │
                        │       │            │          │      │
                        │       ▼            ▼          ▼      │
                        │  ┌─────────────────────────────────┐ │
                        │  │       Cloudflare KV / R2        │ │
                        │  └─────────────────────────────────┘ │
                        └──────────────────────────────────────┘
```

## 主要機能

### 1. パフォーマンス最適化
- **プリロード優先度制御**: `preload()` / `prefetch()` / `lazyLoad()` による3段階の優先度
- **Firebase遅延初期化**: 管理者ページアクセス時のみSDKを読み込み
- **コード分割**: React.lazy + Suspense による動的インポート
- **低速回線対応**: Network Information APIで自動判定、プリフェッチ無効化

### 2. セキュリティ
- **Firebase IDトークン検証**: RS256署名検証、iss/aud/exp検証
- **Google公開鍵の2層キャッシュ**: メモリ + KV分散キャッシュ
- **レート制限**: IP単位で60秒間の重複カウント防止

### 3. CMS機能
- **Markdownエディタ**: ライブプレビュー、画像D&D/ペースト対応
- **Mermaidダイアグラム**: 動的レンダリング（遅延読み込み）
- **ローカル下書き保存**: IndexedDB + ログアウト前の自動保存

## コード例

### プリロード優先度制御 (`src/lib/preload.ts`)

```typescript
// 高優先度: 即座にプリロード
const loadHome = preload(() => import('../routes/Home'))

// 低優先度: アイドル時にプリフェッチ
const loadBBSList = prefetch(() => import('../routes/BBSList'))

// プリロードなし: ユーザーアクション時のみ
const loadPostDetail = lazyLoad(() => import('../routes/PostDetail'))
```

### Firebase IDトークン検証 (`src/pv-worker.ts`)

```typescript
async function verifyFirebaseToken(token: string, env: Env) {
  // 1. JWTデコード
  const [header, payload] = token.split('.').map(base64UrlDecode)

  // 2. 有効期限・発行者チェック
  if (payload.exp < now) return null
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null

  // 3. RS256署名検証
  const publicKey = await getGooglePublicKeys(env)
  const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data)

  return isValid ? payload : null
}
```

### Google公開鍵の2層キャッシュ

```typescript
async function getGooglePublicKeys(env: Env) {
  // 1. メモリキャッシュ
  if (publicKeyCache?.expiresAt > Date.now()) return publicKeyCache.keys

  // 2. KV分散キャッシュ
  const kvCache = await env.HAROIN_PV.get('cache:google:public-keys')
  if (kvCache && JSON.parse(kvCache).expiresAt > Date.now()) {
    // メモリに復元して返却
  }

  // 3. Google APIからフェッチ → 両方のキャッシュを更新
}
```

## ディレクトリ構成

```
src/
├── components/          # UIコンポーネント
│   ├── AnimatedRoutes   # ルーティング + プリロード制御
│   ├── PrefetchLink     # ホバー時プリフェッチ
│   └── admin/           # 管理者用エディタ
├── routes/              # ページコンポーネント
├── contexts/            # React Context (認証)
├── lib/                 # ユーティリティ
│   ├── preload.ts       # プリロード優先度制御
│   ├── network.ts       # 低速回線検出
│   └── firebase.ts      # Firebase遅延初期化
├── pv-worker.ts         # Cloudflare Worker (API)
└── data/                # 静的データ (JSON)
```

## 開発環境

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Workerデプロイ
wrangler deploy --config wrangler.pv.jsonc
```

## ライセンス

Private - All rights reserved
