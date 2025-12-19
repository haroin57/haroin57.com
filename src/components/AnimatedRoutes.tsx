import { Routes, Route, useLocation } from 'react-router-dom'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { useRef, lazy, Suspense, useEffect, useLayoutEffect, useMemo, createRef } from 'react'
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

const Home = lazy(loadHome)
const Posts = lazy(loadPosts)
const PostDetail = lazy(loadPostDetail)
const Products = lazy(loadProducts)
const ProductDetail = lazy(loadProductDetail)
const Photos = lazy(loadPhotos)
const BBSList = lazy(loadBBSList)
const BBSThread = lazy(loadBBSThread)

const TRANSITION_DURATION = 400
const ROUTE_TRANSITIONING_DURATION = 500

function AnimatedRoutes() {
  const location = useLocation()
  const hasMountedRef = useRef(false)

  // 遷移ごとにnodeRefを分離（refキャッシュ）
  const nodeRefCache = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map())
  const nodeRef = useMemo(() => {
    const key = location.pathname
    if (!nodeRefCache.current.has(key)) {
      nodeRefCache.current.set(key, createRef<HTMLDivElement>())
    }
    return nodeRefCache.current.get(key)!
  }, [location.pathname])

  // キャッシュのクリーンアップ（古いエントリを削除）
  useEffect(() => {
    const cache = nodeRefCache.current
    if (cache.size > 10) {
      const keys = Array.from(cache.keys())
      const currentKey = location.pathname
      for (const key of keys) {
        if (key !== currentKey && cache.size > 5) {
          cache.delete(key)
        }
      }
    }
  }, [location.pathname])

  // 即座に全ルートを並列プリロード（マウント直後）
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
    const connection = nav.connection
    const isSlow = connection?.saveData || (connection?.effectiveType?.includes('2g') ?? false)
    if (isSlow) return

    // 全ルートを並列でプリロード（Promise.allで同時フェッチ）
    // requestIdleCallbackでメインスレッドをブロックしない
    const preloadAll = () => {
      void Promise.all([
        loadHome(),
        loadPosts(),
        loadProducts(),
        loadPostDetail(),
        loadProductDetail(),
        loadPhotos(),
        loadBBSList(),
        loadBBSThread(),
      ])
    }

    const hasIdleCallback = typeof window.requestIdleCallback === 'function'
    const idleId = hasIdleCallback
      ? window.requestIdleCallback(preloadAll, { timeout: 100 })
      : setTimeout(preloadAll, 0)

    return () => {
      if (hasIdleCallback) {
        window.cancelIdleCallback(idleId as number)
      } else {
        clearTimeout(idleId)
      }
    }
  }, [])

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
            </Routes>
          </Suspense>
        </div>
      </CSSTransition>
    </TransitionGroup>
  )
}

export default AnimatedRoutes
