import { Routes, Route, useLocation } from 'react-router-dom'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { useRef, lazy, Suspense, useEffect, useLayoutEffect, createRef } from 'react'
import App from '../App'
import { shouldPrefetch } from '../lib/network'
import { preload, prefetch, lazyLoad } from '../lib/preload'

/**
 * ルートローダー定義
 *
 * 優先度:
 * - preload: 高優先度（クリティカルなルート、即座にロード開始）
 * - prefetch: 低優先度（アイドル時にロード、低速回線では無効）
 * - lazyLoad: プリロードなし（ユーザーアクション時のみ）
 */

// 高優先度: メインナビゲーションのルート（即座にプリロード）
const loadHome = preload(() => import('../routes/Home'))
const loadPosts = preload(() => import('../routes/Posts'))
const loadProducts = preload(() => import('../routes/Products'))
const loadPhotos = preload(() => import('../routes/Photos'))

// 低優先度: サブページ（アイドル時にプリフェッチ）
const loadBBSList = prefetch(() => import('../routes/BBSList'))
const loadBBSThread = prefetch(() => import('../routes/BBSThread'))

// 遅延ロード: 大きなJSONを含む詳細ページ（プリロードなし）
const loadPostDetail = lazyLoad(() => import('../routes/PostDetail'))
const loadProductDetail = lazyLoad(() => import('../routes/ProductDetail'))

// 遅延ロード: 管理者ルート（管理者のみ使用）
const loadPostEditor = lazyLoad(() => import('../routes/admin/PostEditor'))
const loadProductEditor = lazyLoad(() => import('../routes/admin/ProductEditor'))

const Home = lazy(loadHome)
const Posts = lazy(loadPosts)
const PostDetail = lazy(loadPostDetail)
const Products = lazy(loadProducts)
const ProductDetail = lazy(loadProductDetail)
const Photos = lazy(loadPhotos)
const BBSList = lazy(loadBBSList)
const BBSThread = lazy(loadBBSThread)
const PostEditor = lazy(loadPostEditor)
const ProductEditor = lazy(loadProductEditor)

// 遷移時に関連ルートをプリロード（詳細ページは除外 - 大きなJSONを含むため）
const routeLoaders: Record<string, Array<() => Promise<unknown>>> = {
  '/': [loadHome, loadPosts, loadProducts, loadPhotos],
  '/home': [loadPosts, loadProducts, loadPhotos],
  '/posts': [loadHome],
  '/products': [loadHome],
  '/photos': [loadHome],
  '/bbs': [loadHome, loadBBSThread],
}

// nodeRefキャッシュ（コンポーネント外で保持 - 再レンダリングで失われない）
const nodeRefCache = new Map<string, React.RefObject<HTMLDivElement | null>>()

function getNodeRef(pathname: string): React.RefObject<HTMLDivElement | null> {
  if (!nodeRefCache.has(pathname)) {
    nodeRefCache.set(pathname, createRef<HTMLDivElement>())
  }
  return nodeRefCache.get(pathname)!
}

// キャッシュサイズ制限
function cleanupNodeRefCache(currentPath: string) {
  if (nodeRefCache.size > 15) {
    const keys = Array.from(nodeRefCache.keys())
    for (const key of keys) {
      if (key !== currentPath && nodeRefCache.size > 8) {
        nodeRefCache.delete(key)
      }
    }
  }
}

const TRANSITION_DURATION = 400
const ROUTE_TRANSITIONING_DURATION = 500

function AnimatedRoutes() {
  const location = useLocation()
  const hasMountedRef = useRef(false)

  // nodeRefを同期的に取得（ボトルネック解消：useMemoを使わず直接取得）
  const nodeRef = getNodeRef(location.pathname)

  // キャッシュクリーンアップ（非同期で実行）
  useEffect(() => {
    cleanupNodeRefCache(location.pathname)
  }, [location.pathname])

  // preload/prefetch関数が自動的にプリロードを開始するため、
  // 初回マウント時の明示的なプリロードは不要
  // （preload: 即座に、prefetch: アイドル時に、lazyLoad: なし）

  // 遷移時に関連ルートをプリロード（低速回線では無効）
  useEffect(() => {
    if (!shouldPrefetch()) return

    const basePath = '/' + (location.pathname.split('/')[1] || '')
    const loaders = routeLoaders[basePath]
    if (loaders) {
      // 関連ルートを順番にプリロード（競合を避けるため）
      loaders.reduce(
        (promise, loader) => promise.then(() => loader()),
        Promise.resolve() as Promise<unknown>
      )
    }
  }, [location.pathname])

  // 遷移中にroute-transitioningクラスを付与（400ms）
  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    const root = document.documentElement
    root.classList.add('route-transitioning')

    const timer = window.setTimeout(() => {
      root.classList.remove('route-transitioning')
    }, ROUTE_TRANSITIONING_DURATION)

    return () => {
      window.clearTimeout(timer)
      root.classList.remove('route-transitioning')
    }
  }, [location.pathname])

  return (
    <TransitionGroup component={null}>
      <CSSTransition
        key={location.pathname}
        nodeRef={nodeRef}
        classNames="page-transition"
        timeout={TRANSITION_DURATION}
        unmountOnExit
      >
        <div ref={nodeRef} style={{ position: 'relative', width: '100%' }}>
          <Suspense fallback={null}>
            <Routes location={location}>
              <Route path="/" element={<App />} />
              <Route path="/home" element={<Home />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/posts/:slug" element={<PostDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/photos" element={<Photos />} />
              <Route path="/bbs" element={<BBSList />} />
              <Route path="/bbs/:threadId" element={<BBSThread />} />
              {/* 管理者ルート */}
              <Route path="/admin/posts/new" element={<PostEditor />} />
              <Route path="/admin/posts/:slug/edit" element={<PostEditor />} />
              <Route path="/admin/products/new" element={<ProductEditor />} />
              <Route path="/admin/products/:slug/edit" element={<ProductEditor />} />
            </Routes>
          </Suspense>
        </div>
      </CSSTransition>
    </TransitionGroup>
  )
}

export default AnimatedRoutes
