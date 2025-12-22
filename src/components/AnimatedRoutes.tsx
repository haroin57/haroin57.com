import { Routes, Route, useLocation } from 'react-router-dom'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { useRef, lazy, Suspense, useEffect, useLayoutEffect, createRef } from 'react'
import App from '../App'

// 遅延読み込み - 初期ロードを高速化
// webpackPreloadでブラウザに早期フェッチを指示、webpackChunkNameでキャッシュ効率向上
const loadHome = () => import(/* webpackPreload: true, webpackChunkName: "home" */ '../routes/Home')
const loadPosts = () => import(/* webpackPreload: true, webpackChunkName: "posts" */ '../routes/Posts')
const loadPostDetail = () => import(/* webpackPrefetch: true, webpackChunkName: "post-detail" */ '../routes/PostDetail')
const loadProducts = () => import(/* webpackPreload: true, webpackChunkName: "products" */ '../routes/Products')
const loadProductDetail = () => import(/* webpackPrefetch: true, webpackChunkName: "product-detail" */ '../routes/ProductDetail')
const loadPhotos = () => import(/* webpackPreload: true, webpackChunkName: "photos" */ '../routes/Photos')
const loadBBSList = () => import(/* webpackPreload: true, webpackChunkName: "bbs-list" */ '../routes/BBSList')
const loadBBSThread = () => import(/* webpackPrefetch: true, webpackChunkName: "bbs-thread" */ '../routes/BBSThread')
const loadPostEditor = () => import(/* webpackPrefetch: true, webpackChunkName: "post-editor" */ '../routes/admin/PostEditor')
const loadProductEditor = () => import(/* webpackPrefetch: true, webpackChunkName: "product-editor" */ '../routes/admin/ProductEditor')

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

// すべてのローダーをマップ化（関連ルートのプリロード用）
const routeLoaders: Record<string, Array<() => Promise<unknown>>> = {
  '/': [loadHome, loadPosts, loadProducts, loadPhotos],
  '/home': [loadPosts, loadProducts, loadPhotos],
  '/posts': [loadPostDetail, loadHome],
  '/products': [loadProductDetail, loadHome],
  '/photos': [loadHome],
  '/bbs': [loadBBSThread, loadHome],
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

// プリロード済みフラグ
let hasPreloadedAll = false

function AnimatedRoutes() {
  const location = useLocation()
  const hasMountedRef = useRef(false)

  // nodeRefを同期的に取得（ボトルネック解消：useMemoを使わず直接取得）
  const nodeRef = getNodeRef(location.pathname)

  // キャッシュクリーンアップ（非同期で実行）
  useEffect(() => {
    cleanupNodeRefCache(location.pathname)
  }, [location.pathname])

  // 初回マウント時に全ルートを即座にプリロード
  useEffect(() => {
    if (hasPreloadedAll) return
    hasPreloadedAll = true

    const nav = navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
    const connection = nav.connection
    const isSlow = connection?.saveData || (connection?.effectiveType?.includes('2g') ?? false)
    if (isSlow) return

    // 即座にプリロード開始（requestIdleCallbackを待たない）
    void Promise.all([
      loadHome(),
      loadPosts(),
      loadProducts(),
      loadPhotos(),
      loadBBSList(),
    ])

    // 詳細ページは少し遅延させてプリロード（管理者ルートは除外）
    setTimeout(() => {
      void Promise.all([
        loadPostDetail(),
        loadProductDetail(),
        loadBBSThread(),
      ])
    }, 50)
  }, [])

  // 遷移時に関連ルートを優先プリロード
  useEffect(() => {
    const basePath = '/' + (location.pathname.split('/')[1] || '')
    const loaders = routeLoaders[basePath]
    if (loaders) {
      // 関連ルートを即座にプリロード
      void Promise.all(loaders.map(loader => loader()))
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
