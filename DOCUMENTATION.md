# haroin57-web 技術ドキュメント

## 概要

haroin57.comのソースコード。React + TypeScript + Vite + Tailwind CSSで構築された個人サイト。
SSR（サーバーサイドレンダリング）とhydrationをサポートし、Cloudflare Pagesにデプロイ。

## アーキテクチャ

```
src/
├── App.tsx              # ランディングページ
├── main.tsx             # クライアントエントリ（hydration対応）
├── entry-server.tsx     # SSRエントリ
├── index.css            # グローバルスタイル
├── components/          # 再利用可能なコンポーネント
├── routes/              # ページコンポーネント
├── hooks/               # カスタムフック
├── utils/               # ユーティリティ関数
├── contexts/            # Reactコンテキスト
├── data/                # 静的JSONデータ
├── lib/                 # API設定など
└── styles/              # スタイル定義
```

## 主要コンポーネント

### PostContent

記事のHTMLコンテンツを表示するメモ化されたコンポーネント。

```tsx
import PostContent from '../components/PostContent'

// 使用例
<PostContent html={post.html} onProseRef={handleProseRef} />
```

**設計上の重要ポイント:**
- `React.memo`でラップし、親の再レンダリングを防止
- `dangerouslySetInnerHTML`で挿入されたMermaidブロックが消えるのを防ぐ
- `useMermaidBlocks`フックを内部で呼び出し、Mermaidダイアグラムを自動レンダリング

### GlobalBackground

p5.jsを使用したアニメーション背景。4次元超立方体（ハイパーキューブ）のワイヤーフレームを3D空間に投影。

## Mermaidダイアグラム

### アーキテクチャ

```
MarkdownビルドHTML生成 → HTMLにdata-mermaid属性を埋め込み
                           ↓
                    PostContentコンポーネント
                           ↓
                    useMermaidBlocksフック
                           ↓
                    renderMermaidBlocks関数
                           ↓
                    SVGとしてDOMに挿入
```

### ファイル構成

| ファイル | 役割 |
|---------|------|
| `src/components/PostContent.tsx` | HTMLコンテンツを表示、Mermaidを自動レンダリング |
| `src/hooks/useMermaidBlocks.ts` | Mermaidレンダリングを実行するフック |
| `src/utils/mermaid.ts` | Mermaidライブラリのロードとレンダリング |
| `scripts/deploy-posts.ts` | Markdownからdata-mermaid属性を持つHTMLを生成 |

### useMermaidBlocks フック

```tsx
import { useMermaidBlocks } from '../hooks/useMermaidBlocks'

const proseRef = useRef<HTMLDivElement>(null)
useMermaidBlocks(proseRef, [html])
```

**動作:**
1. hydrationの完了を待機（SSR対応）
2. `requestIdleCallback`でブラウザがアイドル状態になってからレンダリング
3. `.mermaid-block`クラスと`data-mermaid`属性を持つ要素を検出
4. Mermaid APIでSVGに変換してDOMに挿入

### HTMLの生成（ビルド時）

Markdownの`mermaid`コードブロックは、ビルド時に以下のHTMLに変換:

```html
<div class="mermaid-block" data-mermaid="flowchart TB
    A --> B
"></div>
```

### テーマ設定

`src/utils/mermaid.ts`の`mermaidConfig.themeVariables`でダークテーマ用のスタイルを定義。
透過背景と白系のテキスト・ラインカラーを使用。

## SSRとHydration

### エントリポイント

- **クライアント**: `src/main.tsx`
- **サーバー**: `src/entry-server.tsx`

### Hydrationの仕組み

```tsx
// main.tsx
const shouldHydrate =
  rootElement.hasChildNodes() &&
  typeof prerenderedPath === 'string' &&
  normalizePath(prerenderedPath) === normalizePath(window.location.pathname)

if (shouldHydrate) {
  hydrateRoot(rootElement, app)
} else {
  createRoot(rootElement).render(app)
}
```

### SSR環境での注意点

- Mermaidはクライアントサイドでのみレンダリング（`useMermaidBlocks`がhydration後に実行）
- `dangerouslySetInnerHTML`を使用するコンポーネントは`memo`化してhydration後の再レンダリングを防止

## フォント

### Adobe Fonts（Typekit）

`index.html`でTypekitスクリプトを読み込み:

```html
<script>
  var config = { kitId: 'acd4duu', ... }
  // Typekit読み込みコード
</script>
```

### 使用フォント

| クラス名 | フォント |
|---------|---------|
| `.font-ab-countryroad` | AB-countryroad（タイトル用） |
| `.font-a-otf-gothic` | A-OTF ゴシックMB101 Pr6N（本文用） |
| `.font-vdl-logomaru` | VDL ロゴ丸（日本語UI用） |
| `.font-morisawa-dragothic` | ドラゴシック（リンク用） |

**フォントの追加:**
Adobe Fontsのkitに新しいフォントを追加し、CSSクラスを定義。

## ビルドとデプロイ

### ビルドコマンド

```bash
npm run build
```

ビルドプロセス:
1. TypeScriptコンパイル
2. 記事データ生成（`deploy-posts.ts`）
3. プロダクトデータ生成（`gen-product-posts.ts`）
4. Viteビルド（クライアント）
5. Viteビルド（SSR）
6. プリレンダリング
7. CMSへのデプロイ

### デプロイ

```bash
npx wrangler pages deploy dist
```

---

## 初学者向けガイド

### Reactの基本概念

#### コンポーネント

UIの再利用可能な部品。関数として定義し、JSXを返す。

```tsx
function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>
}
```

#### フック（Hooks）

関数コンポーネントで状態管理や副作用を扱う仕組み。

```tsx
// useState: 状態を管理
const [count, setCount] = useState(0)

// useEffect: 副作用（API呼び出し、DOM操作など）
useEffect(() => {
  document.title = `Count: ${count}`
}, [count])

// useRef: DOMへの参照や値の保持
const inputRef = useRef<HTMLInputElement>(null)

// useCallback: 関数をメモ化
const handleClick = useCallback(() => {
  console.log('clicked')
}, [])

// useMemo: 計算結果をメモ化
const expensiveValue = useMemo(() => computeExpensiveValue(a, b), [a, b])
```

#### memo

コンポーネントをメモ化し、propsが変わらない限り再レンダリングを防止。

```tsx
const MyComponent = memo(function MyComponent({ value }) {
  return <div>{value}</div>
})
```

### TypeScriptの基本

#### 型定義

```tsx
// 変数の型
const name: string = 'haroin'
const age: number = 20

// 関数の型
function greet(name: string): string {
  return `Hello, ${name}`
}

// オブジェクトの型（type）
type User = {
  name: string
  age: number
  email?: string  // ?はオプショナル
}

// インターフェース（拡張可能）
interface Post {
  title: string
  content: string
}

// ジェネリクス
function identity<T>(arg: T): T {
  return arg
}
```

### CSSの基礎

#### Tailwind CSS

ユーティリティファーストのCSSフレームワーク。クラス名でスタイルを適用。

```html
<!-- 従来のCSS -->
<div class="container">...</div>

<!-- Tailwind CSS -->
<div class="mx-auto max-w-4xl px-4 py-6">...</div>
```

よく使うクラス:
- `flex`, `grid`: レイアウト
- `p-4`, `m-2`: パディング、マージン
- `text-lg`, `font-bold`: テキストスタイル
- `bg-blue-500`, `text-white`: 色
- `sm:`, `md:`, `lg:`: レスポンシブ

#### CSS変数（カスタムプロパティ）

```css
:root {
  --fg: #e2e8f0;
  --bg: #1a1a1a;
}

.text {
  color: var(--fg);
  background: var(--bg);
}
```

### dangerouslySetInnerHTML

HTMLの文字列をReactコンポーネントに挿入する方法。XSS攻撃のリスクがあるため注意が必要。

```tsx
// 信頼できるソースのHTMLのみ使用すること
<div dangerouslySetInnerHTML={{ __html: trustedHtml }} />
```

**注意点:**
- ユーザー入力をそのまま使用しない
- サニタイズされたHTMLのみ使用
- Reactの仮想DOMと実DOMの同期に注意（hydration問題の原因になりうる）

### SSRとHydration

#### SSR（サーバーサイドレンダリング）

サーバーでHTMLを生成し、クライアントに送信。初期表示が速く、SEOに有利。

#### Hydration

サーバーで生成されたHTMLにReactの機能（イベントハンドラなど）を付与するプロセス。

```
サーバー: HTMLを生成して送信
    ↓
ブラウザ: HTMLを表示（まだインタラクティブでない）
    ↓
JavaScript: hydrationを実行
    ↓
ブラウザ: フルインタラクティブに
```

**hydration時の注意:**
- サーバーとクライアントで同じHTMLが生成される必要がある
- `dangerouslySetInnerHTML`で挿入したコンテンツはhydration後に上書きされる可能性がある
- クライアントのみで実行したい処理は`useEffect`内で行う

### 非同期処理

#### async/await

```tsx
async function fetchData() {
  try {
    const response = await fetch('/api/data')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error:', error)
  }
}
```

#### useEffectでのデータ取得

```tsx
useEffect(() => {
  let mounted = true

  const fetchData = async () => {
    const res = await fetch('/api/posts')
    const data = await res.json()
    if (mounted) {
      setData(data)
    }
  }

  fetchData()

  return () => {
    mounted = false  // クリーンアップ
  }
}, [])
```
