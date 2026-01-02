import { Routes, Route, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import App from '../App'
import {
  Home,
  Posts,
  PostDetail,
  Products,
  ProductDetail,
  Photos,
  About,
  BBSList,
  BBSThread,
  PostEditor,
  ProductEditor,
} from '../lib/preloadRoutes'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <div className="relative w-full">
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
          <Route path="/admin/posts/new" element={<PostEditor />} />
          <Route path="/admin/posts/:slug/edit" element={<PostEditor />} />
          <Route path="/admin/products/new" element={<ProductEditor />} />
          <Route path="/admin/products/:slug/edit" element={<ProductEditor />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default AnimatedRoutes
