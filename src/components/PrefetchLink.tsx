import { Link, type LinkProps } from 'react-router-dom'
import { useCallback, useRef } from 'react'
import { shouldPrefetch } from '../lib/network'
import { lazyLoad } from '../lib/preload'

interface PrefetchLinkProps extends LinkProps {
  enablePrefetch?: boolean
}

/**
 * ルートチャンクのプリフェッチャー
 * - 高優先度ルート: preloadで既にプリロード済みなのでここでは重複しない
 * - 詳細ページ: lazyLoadで明示的にプリロードなし
 */
const routeChunkLoaders: Record<string, () => Promise<unknown>> = {
  '/': lazyLoad(() => import('../App')),
  '/home': lazyLoad(() => import('../routes/Home')),
  '/posts': lazyLoad(() => import('../routes/Posts')),
  '/products': lazyLoad(() => import('../routes/Products')),
  '/photos': lazyLoad(() => import('../routes/Photos')),
  '/bbs': lazyLoad(() => import('../routes/BBSList')),
  // PostDetail/ProductDetailは大きなJSONを含むためプリフェッチしない
}

function normalizePathname(raw: string) {
  return raw.split('#')[0]?.split('?')[0] ?? raw
}

function prefetchRouteChunk(rawPath: string) {
  // 低速回線ではプリフェッチしない
  if (!shouldPrefetch()) return

  const path = normalizePathname(rawPath)

  // 完全一致でロード
  const loader = routeChunkLoaders[path]
  if (loader) {
    void loader()
  }
}

function PrefetchLink({ enablePrefetch = true, to, children, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const prefetched = useRef(false)

  const handlePrefetch = useCallback(() => {
    if (!enablePrefetch || prefetched.current) return

    // 低速回線チェック
    if (!shouldPrefetch()) return

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
