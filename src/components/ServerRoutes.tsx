import { Routes, Route, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import App from '../App'

// SSR用も遅延ロードに統一（クライアントと同じチャンク分割を実現）
const Home = lazy(() => import('../routes/Home'))
const Posts = lazy(() => import('../routes/Posts'))
const PostDetail = lazy(() => import('../routes/PostDetail'))
const Products = lazy(() => import('../routes/Products'))
const ProductDetail = lazy(() => import('../routes/ProductDetail'))
const Photos = lazy(() => import('../routes/Photos'))
const About = lazy(() => import('../routes/About'))
const BBSList = lazy(() => import('../routes/BBSList'))
const BBSThread = lazy(() => import('../routes/BBSThread'))

function ServerRoutes() {
  const location = useLocation()

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Suspense fallback={null}>
        <Routes location={location}>
          <Route path="/" element={<App />} />
          <Route path="/home" element={<Home />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:slug" element={<PostDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/about" element={<About />} />
          <Route path="/bbs" element={<BBSList />} />
          <Route path="/bbs/:threadId" element={<BBSThread />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default ServerRoutes
