import { lazyWithPreload } from './lazyWithPreload'

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

export {
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
}
