import { Routes, Route, useLocation } from 'react-router-dom'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { useRef, lazy, Suspense } from 'react'
import App from '../App'

// 遅延読み込み - 初期ロードを高速化
const Home = lazy(() => import('../routes/Home'))
const Posts = lazy(() => import('../routes/Posts'))
const PostDetail = lazy(() => import('../routes/PostDetail'))
const Products = lazy(() => import('../routes/Products'))

function AnimatedRoutes() {
  const location = useLocation()
  const nodeRef = useRef<HTMLDivElement>(null)

  return (
    <TransitionGroup component={null}>
      <CSSTransition
        key={location.pathname}
        nodeRef={nodeRef}
        classNames="page-transition"
        timeout={400}
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
            </Routes>
          </Suspense>
        </div>
      </CSSTransition>
    </TransitionGroup>
  )
}

export default AnimatedRoutes
