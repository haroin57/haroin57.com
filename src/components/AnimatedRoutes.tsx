import { Routes, Route, useLocation } from 'react-router-dom'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { useRef, lazy, Suspense, useEffect, useLayoutEffect, useMemo, createRef } from 'react'
import App from '../App'

// 遅延読み込み - 初期ロードを高速化
const loadHome = () => import('../routes/Home')
const loadPosts = () => import('../routes/Posts')
const loadPostDetail = () => import('../routes/PostDetail')
const loadProducts = () => import('../routes/Products')
const loadProductDetail = () => import('../routes/ProductDetail')

const Home = lazy(loadHome)
const Posts = lazy(loadPosts)
const PostDetail = lazy(loadPostDetail)
const Products = lazy(loadProducts)
const ProductDetail = lazy(loadProductDetail)

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

  // 即座に主要ルートをプリロード（マウント直後）
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
    const connection = nav.connection
    const isSlow = connection?.saveData || (connection?.effectiveType?.includes('2g') ?? false)
    if (isSlow) return

    // 主要ルートを即座にプリロード（0ms遅延）
    queueMicrotask(() => {
      void loadHome()
      void loadPosts()
      void loadProducts()
    })

    // 詳細ページは50ms後にプリロード
    const secondaryId = window.setTimeout(() => {
      void loadPostDetail()
      void loadProductDetail()
    }, 50)

    return () => {
      window.clearTimeout(secondaryId)
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
            </Routes>
          </Suspense>
        </div>
      </CSSTransition>
    </TransitionGroup>
  )
}

export default AnimatedRoutes
