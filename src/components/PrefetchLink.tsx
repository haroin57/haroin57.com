import { Link, type LinkProps } from 'react-router-dom'
import { useCallback, useRef } from 'react'

interface PrefetchLinkProps extends LinkProps {
  enablePrefetch?: boolean
}

const routeChunkPrefetchers: Array<[match: (path: string) => boolean, load: () => Promise<unknown>]> = [
  [(path) => path === '/', () => import(/* webpackChunkName: "app" */ '../App')],
  [(path) => path === '/home', () => import(/* webpackChunkName: "home" */ '../routes/Home')],
  [(path) => path === '/posts', () => import(/* webpackChunkName: "posts" */ '../routes/Posts')],
  [(path) => path.startsWith('/posts/'), () => import(/* webpackChunkName: "post-detail" */ '../routes/PostDetail')],
  [(path) => path === '/products', () => import(/* webpackChunkName: "products" */ '../routes/Products')],
  [(path) => path.startsWith('/products/'), () => import(/* webpackChunkName: "product-detail" */ '../routes/ProductDetail')],
  [(path) => path === '/photos', () => import(/* webpackChunkName: "photos" */ '../routes/Photos')],
]

function normalizePathname(raw: string) {
  return raw.split('#')[0]?.split('?')[0] ?? raw
}

function prefetchRouteChunk(rawPath: string) {
  const path = normalizePathname(rawPath)
  for (const [match, load] of routeChunkPrefetchers) {
    if (!match(path)) continue
    void load()
    break
  }
}

function PrefetchLink({ enablePrefetch = true, to, children, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const prefetched = useRef(false)

  const handlePrefetch = useCallback(() => {
    if (!enablePrefetch || prefetched.current) return
    prefetched.current = true

    const rawPath = typeof to === 'string' ? to : to.pathname
    if (!rawPath) return
    prefetchRouteChunk(rawPath)
  }, [enablePrefetch, to])

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      handlePrefetch()
      onMouseEnter?.(e)
    },
    [handlePrefetch, onMouseEnter]
  )

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLAnchorElement>) => {
      handlePrefetch()
      onFocus?.(e)
    },
    [handlePrefetch, onFocus]
  )

  return (
    <Link to={to} onMouseEnter={handleMouseEnter} onFocus={handleFocus} {...props}>
      {children}
    </Link>
  )
}

export default PrefetchLink
