import { Routes, Route, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import App from '../App'
import { lazyWithPreload } from '../lib/lazyWithPreload'

const Home = lazyWithPreload(() => import('../routes/Home'))
const Posts = lazyWithPreload(() => import('../routes/Posts'))
const PostDetail = lazyWithPreload(() => import('../routes/PostDetail'))
const Products = lazyWithPreload(() => import('../routes/Products'))
const ProductDetail = lazyWithPreload(() => import('../routes/ProductDetail'))
const Photos = lazyWithPreload(() => import('../routes/Photos'))
const About = lazyWithPreload(() => import('../routes/About'))
const BBSList = lazyWithPreload(() => import('../routes/BBSList'))
const BBSThread = lazyWithPreload(() => import('../routes/BBSThread'))
const PostEditor = lazyWithPreload(() => import('../routes/admin/PostEditor'))
const ProductEditor = lazyWithPreload(() => import('../routes/admin/ProductEditor'))

export async function preloadRoutesForPath(pathname: string): Promise<void> {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  const second = segments[1]

  if (first === 'posts' && second) {
    await PostDetail.preload()
    return
  }

  if (first === 'products' && second) {
    await ProductDetail.preload()
    return
  }

  if (first === 'bbs' && second) {
    await BBSThread.preload()
    return
  }

  if (first === 'admin') {
    if (second === 'posts') {
      await PostEditor.preload()
      return
    }
    if (second === 'products') {
      await ProductEditor.preload()
      return
    }
    return
  }

  if (first === 'home') {
    await Home.preload()
    return
  }
  if (first === 'posts') {
    await Posts.preload()
    return
  }
  if (first === 'products') {
    await Products.preload()
    return
  }
  if (first === 'photos') {
    await Photos.preload()
    return
  }
  if (first === 'bbs') {
    await BBSList.preload()
    return
  }
  if (first === 'about') {
    await About.preload()
  }
}

function AnimatedRoutes() {
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
