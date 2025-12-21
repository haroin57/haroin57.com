---
title: "README2"
summary: "useState, useEffect, useMemo, useCallbackなど、React Hooksを初学者向けに詳しく解説"
date: "2025-12-21T11:00:00+09:00"
tags:
  - React
  - TypeScript
  - Hooks
  - Tutorial
---

React Hooksは関数コンポーネントで状態管理や副作用処理を可能にする機能。このサイトで使用しているHooksを詳しく解説する。

## 目次

<br/>

## useState - 状態管理フック

コンポーネント内で変更可能な「状態」を保持。値が変わると自動で再レンダリングされる。

### 基本的な使い方

```typescript
const [count, setCount] = useState(0)

// 値を直接設定
setCount(5)

// 前の値を使って更新
setCount((prev) => prev + 1)
```

### 構文の読み方

- `const [state, setState]` → 分割代入。配列の1番目が現在値、2番目が更新関数
- `useState(initialValue)` → 初期値を引数に渡す
- `setState(newValue)` → 新しい値を設定すると再レンダリングが発生

### 本プロジェクトでの使用例

```typescript
// Posts.tsx - 投稿一覧の管理
const [posts, setPosts] = useState<PostMeta[]>(initialPosts)

// 楽観的更新の例（APIレスポンス前にUIを更新）
const newPosts = posts.filter((p) => p.slug !== slug)
setPosts(newPosts)
```

```typescript
// AdminAuthContext.tsx - 認証状態の管理
const [isAdmin, setIsAdmin] = useState(false)
const [user, setUser] = useState<User | null>(null)
const [idToken, setIdToken] = useState<string | null>(null)
```

---

<br/>

## useEffect - 副作用フック

コンポーネントのレンダリング後に実行される処理を定義。

### 基本パターン

```typescript
// パターン1: 毎回実行
useEffect(() => {
  console.log('レンダリングのたびに実行')
})

// パターン2: マウント時のみ
useEffect(() => {
  console.log('初回マウント時のみ実行')
}, [])

// パターン3: 依存値が変わった時
useEffect(() => {
  console.log('countが変わるたびに実行')
}, [count])

// パターン4: クリーンアップ付き
useEffect(() => {
  const timer = setInterval(() => console.log('tick'), 1000)

  return () => {
    clearInterval(timer)  // コンポーネントがアンマウントされる時に実行
  }
}, [])
```

### 依存配列とは

`useEffect`の第2引数は「この値が変わったら再実行して」というリスト。

```typescript
// depsの違いによる動作
useEffect(fn)        // 毎回実行
useEffect(fn, [])    // マウント時のみ
useEffect(fn, [a])   // aが変わった時
useEffect(fn, [a,b]) // aまたはbが変わった時
```

### 本プロジェクトでの使用例

```typescript
// Home.tsx - CMSから記事を取得
useEffect(() => {
  const fetchLatestPosts = async () => {
    const res = await fetch(`${CMS_ENDPOINT}/posts`)
    if (res.ok) {
      const data = await res.json()
      setLatestPosts(data.posts)
    }
  }
  fetchLatestPosts()
}, [])  // マウント時のみ実行
```

```typescript
// AdminAuthContext.tsx - 認証状態の監視
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const token = await firebaseUser.getIdToken()
      setIdToken(token)
      setUser(firebaseUser)
    } else {
      setUser(null)
      setIdToken(null)
    }
  })

  return () => unsubscribe()  // クリーンアップ: 監視解除
}, [])
```

---

<br/>

## useCallback - 関数メモ化フック

関数の参照を安定させる。子コンポーネントへの不要な再レンダリングを防ぐ。

### なぜ必要なのか

```typescript
// 毎回新しい関数が作られる
function Parent() {
  const handleClick = () => console.log('clicked')  // 毎回新しい参照

  return <Child onClick={handleClick} />  // Childは毎回再レンダリング
}

// useCallbackで参照を安定させる
function Parent() {
  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])  // 同じ関数を再利用

  return <Child onClick={handleClick} />  // Childの再レンダリングを防げる
}
```

### 本プロジェクトでの使用例

```typescript
// Home.tsx - ナビゲーション関数
const handleBack = useCallback(() => {
  navigate('/')
}, [navigate])
```

```typescript
// Posts.tsx - タグクリック処理
const handleTagClick = useCallback((tag: string) => {
  startTransition(() => {
    setSearchParams(tag ? { tag } : {})
  })
}, [setSearchParams])
```

---

<br/>

## useMemo - 値メモ化フック

計算結果をキャッシュして、不要な再計算を防ぐ。

### 基本的な使い方

```typescript
// 重い計算結果をキャッシュ
const expensiveResult = useMemo(() => {
  return items.filter(item => item.active)
              .map(item => ({ ...item, processed: true }))
              .sort((a, b) => a.name.localeCompare(b.name))
}, [items])  // itemsが変わった時だけ再計算
```

### useCallbackとuseMemoの違い

| フック | メモ化対象 | 使い分け |
|--------|-----------|----------|
| `useCallback` | 関数 | イベントハンドラ、子に渡す関数 |
| `useMemo` | 計算結果 | フィルタリング、ソート、変換処理 |

### 本プロジェクトでの使用例

```typescript
// Posts.tsx - タグ別フィルタリング
const filteredPosts = useMemo(() => {
  if (!tagFilter) return posts
  return posts.filter((p) => p.tags?.includes(tagFilter))
}, [posts, tagFilter])

// タグ一覧の抽出と重複排除
const allTags = useMemo(() => {
  const tagSet = new Set<string>()
  posts.forEach((p) => p.tags?.forEach((t) => tagSet.add(t)))
  return [...tagSet].sort()
}, [posts])
```

---

<br/>

## useRef - 参照フック

再レンダリングを引き起こさずに値を保持。DOM要素への参照にも使用。

### 主な用途

1. **DOM要素への参照**

```typescript
const inputRef = useRef<HTMLInputElement>(null)

// フォーカスを当てる
inputRef.current?.focus()

return <input ref={inputRef} />
```

2. **レンダリング間で値を保持（再レンダリングを起こさない）**

```typescript
const countRef = useRef(0)

// 値を更新しても再レンダリングされない
countRef.current += 1
```

3. **タイマーIDの保持**

```typescript
const timerRef = useRef<number | null>(null)

timerRef.current = window.setTimeout(() => {
  // 処理
}, 1000)

// クリーンアップ
window.clearTimeout(timerRef.current!)
```

### useStateとuseRefの使い分け

| 特性 | useState | useRef |
|------|----------|--------|
| 値変更時の再レンダリング | する | しない |
| 用途 | UIに表示する値 | DOM参照、タイマーID、内部フラグ |
| 値の読み取り | 直接 | `.current`プロパティ経由 |

### 本プロジェクトでの使用例

```typescript
// AccessCounter.tsx - API呼び出しの重複防止
const didSend = useRef(false)

useEffect(() => {
  if (didSend.current) return  // 既に送信済みならスキップ
  didSend.current = true
  // APIコール...
}, [])
```

```typescript
// ScrollTopHomeSwitch.tsx - 累積値の保持
const wheelAccumRef = useRef(0)
const wheelLastAtRef = useRef(0)

// イベントハンドラ内で更新（再レンダリングなし）
wheelAccumRef.current += deltaY
wheelLastAtRef.current = now
```

---

<br/>

## useContext - コンテキスト消費フック

Contextから現在の値を取得。Providerで包まれた子孫コンポーネントで使用。

### なぜ必要なのか

通常、データを子コンポーネントに渡すにはpropsを使う。しかし、深くネストしたコンポーネントにデータを渡すには、途中のすべてのコンポーネントを経由する必要がある（「props drilling」問題）。

```typescript
// props drilling: 中間コンポーネントがthemeを使わないのに渡している
function App() {
  const theme = 'dark'
  return <Header theme={theme} />
}
function Header({ theme }) {
  return <Nav theme={theme} />
}
function Nav({ theme }) {
  return <Button theme={theme} />
}
function Button({ theme }) {
  return <button className={theme}>Click</button>
}
```

Contextを使うと、途中を飛ばして直接データを受け取れる。

```typescript
// Context: どの階層からでも直接アクセス
const ThemeContext = createContext('light')

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Header />
    </ThemeContext.Provider>
  )
}
function Header() { return <Nav /> }
function Nav() { return <Button /> }
function Button() {
  const theme = useContext(ThemeContext)  // 直接取得！
  return <button className={theme}>Click</button>
}
```

### 本プロジェクトでの使用例

```typescript
// AdminAuthContext.tsx - カスタムフックでラップ
export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return context
}
```

```typescript
// 各コンポーネントでの使用
const { isAdmin, idToken, loginWithGoogle, logout } = useAdminAuth()

if (!isAdmin) {
  return <div>管理者ログインが必要です</div>
}
```

---

<br/>

## lazy と Suspense - 遅延読み込み

### lazy - コード分割

コンポーネントを動的にインポートし、コード分割を実現。初期バンドルサイズを削減。

```typescript
// 通常のimport: 最初に全部読み込む
import Home from './routes/Home'
import AdminPanel from './routes/AdminPanel'  // 管理者しか使わないのに全員が読み込む

// lazy: 必要になったら読み込む
const Home = lazy(() => import('./routes/Home'))
const AdminPanel = lazy(() => import('./routes/AdminPanel'))  // 管理者がアクセスした時だけ読み込む
```

### Suspense - ローディング表示

遅延読み込みコンポーネントのローディング中にフォールバックUIを表示。

```typescript
<Suspense fallback={<div>読み込み中...</div>}>
  <LazyComponent />  {/* 読み込み完了まで fallback が表示される */}
</Suspense>
```

### 本プロジェクトでの使用例

```typescript
// AnimatedRoutes.tsx - 全ルートの遅延読み込み
const loadHome = () => import(/* webpackPreload: true */ '../routes/Home')
const loadPosts = () => import(/* webpackPreload: true */ '../routes/Posts')

const Home = lazy(loadHome)
const Posts = lazy(loadPosts)

// ルートをSuspenseで囲む
<Suspense fallback={null}>
  <Routes location={location}>
    <Route path="/" element={<App />} />
    <Route path="/home" element={<Home />} />
    <Route path="/posts" element={<Posts />} />
  </Routes>
</Suspense>
```

---

<br/>

## useLayoutEffect - 同期的副作用フック

DOMの変更後、ブラウザの描画前に同期的に実行。

### useEffectとの違い

```
レンダリング完了 → useLayoutEffect実行 → 画面に描画 → useEffect実行
                  ↑ ここで実行           ↑ ユーザーに見える
```

### 使い分け

- **useEffect（99%のケース）**: API呼び出し、イベント登録、ログ出力など
- **useLayoutEffect（レアケース）**: DOM測定、ちらつき防止、レイアウト調整

### 本プロジェクトでの使用例

```typescript
// AnimatedRoutes.tsx - ルート遷移中のクラス付与
useLayoutEffect(() => {
  if (!hasMountedRef.current) {
    hasMountedRef.current = true
    return  // 初回マウント時はスキップ
  }

  const root = document.documentElement
  root.classList.add('route-transitioning')  // 遷移中クラスを即座に付与

  const timer = window.setTimeout(() => {
    root.classList.remove('route-transitioning')
  }, ROUTE_TRANSITIONING_DURATION)

  return () => {
    window.clearTimeout(timer)
    root.classList.remove('route-transitioning')
  }
}, [location.pathname])
```

---

<br/>

## startTransition - 低優先度更新

状態更新を低優先度としてマークし、ユーザー入力等を優先。React 18の機能。

### なぜ必要なのか

```typescript
// 重い処理がユーザー入力をブロック
function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const handleChange = (e) => {
    setQuery(e.target.value)        // 入力を即座に反映したい
    setResults(searchItems(query))  // 重い処理...入力が遅延する
  }
}

// startTransitionで解決
function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const handleChange = (e) => {
    setQuery(e.target.value)  // 高優先度: 即座に反映

    startTransition(() => {
      // 低優先度: ユーザー入力を邪魔しない
      setResults(searchItems(e.target.value))
    })
  }
}
```

### 本プロジェクトでの使用例

```typescript
// Posts.tsx - タグフィルタリングの低優先度更新
const handleTagClick = useCallback((tag: string) => {
  startTransition(() => {
    setSearchParams(tag ? { tag } : {})
  })
}, [setSearchParams])
```
