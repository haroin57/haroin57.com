import { Link, type LinkProps } from 'react-router-dom'
import { useCallback, useRef } from 'react'

interface PrefetchLinkProps extends LinkProps {
  enablePrefetch?: boolean
}

function PrefetchLink({ enablePrefetch = true, to, children, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const prefetched = useRef(false)

  const handlePrefetch = useCallback(() => {
    if (!enablePrefetch || prefetched.current) return
    prefetched.current = true

    const path = typeof to === 'string' ? to : to.pathname
    if (!path) return

    // プリフェッチ用のlinkタグを追加
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = path
    link.as = 'document'
    document.head.appendChild(link)
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
