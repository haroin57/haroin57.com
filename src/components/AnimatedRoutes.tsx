import { Routes, Route, useLocation } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import App from '../App'
import { shouldPrefetch } from '../lib/network'
import { preload, prefetch, lazyLoad } from '../lib/preload'
import { lazyWithPreload } from '../lib/lazyWithPreload'

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
const loadAbout = preload(() => import('../routes/About'))

// 低優先度: サブページ（アイドル時にプリフェッチ）
const loadBBSList = prefetch(() => import('../routes/BBSList'))
const loadBBSThread = prefetch(() => import('../routes/BBSThread'))

// 遅延ロード: 大きなJSONを含む詳細ページ（プリロードなし）
const loadPostDetail = lazyLoad(() => import('../routes/PostDetail'))
const loadProductDetail = lazyLoad(() => import('../routes/ProductDetail'))

// 遅延ロード: 管理者ルート（管理者のみ使用）
const loadPostEditor = lazyLoad(() => import('../routes/admin/PostEditor'))
const loadProductEditor = lazyLoad(() => import('../routes/admin/ProductEditor'))

const Home = lazyWithPreload(loadHome)
const Posts = lazyWithPreload(loadPosts)
const PostDetail = lazyWithPreload(loadPostDetail)
const Products = lazyWithPreload(loadProducts)
const ProductDetail = lazyWithPreload(loadProductDetail)
const Photos = lazyWithPreload(loadPhotos)
const About = lazyWithPreload(loadAbout)
const BBSList = lazyWithPreload(loadBBSList)
const BBSThread = lazyWithPreload(loadBBSThread)
const PostEditor = lazyWithPreload(loadPostEditor)
const ProductEditor = lazyWithPreload(loadProductEditor)

// 遷移時に関連ルートをプリロード（詳細ページは除外 - 大きなJSONを含むため）
const routeLoaders: Record<string, Array<() => Promise<unknown>>> = {
  '/': [loadHome, loadPosts, loadProducts, loadPhotos, loadAbout],
  '/home': [loadPosts, loadProducts, loadPhotos, loadAbout],
  '/posts': [loadHome],
  '/products': [loadHome],
  '/photos': [loadHome],
  '/about': [loadHome],
  '/bbs': [loadHome, loadBBSThread],
}

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
          {/* 管理者ルート */}
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
