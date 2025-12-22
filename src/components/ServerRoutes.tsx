import { Routes, Route, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import App from '../App'
import Home from '../routes/Home'
import Posts from '../routes/Posts'
import PostDetail from '../routes/PostDetail'
import Products from '../routes/Products'
import ProductDetail from '../routes/ProductDetail'
import Photos from '../routes/Photos'
import BBSList from '../routes/BBSList'
import BBSThread from '../routes/BBSThread'

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
          <Route path="/bbs" element={<BBSList />} />
          <Route path="/bbs/:threadId" element={<BBSThread />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default ServerRoutes
