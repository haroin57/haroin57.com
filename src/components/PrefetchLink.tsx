import { useCallback, useRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { preloadRoutesForPath } from '../lib/preloadRoutes'

type PrefetchMode = 'hover' | 'visible' | 'none'

type PrefetchLinkProps = LinkProps & {
  prefetch?: PrefetchMode
}

function PrefetchLink({ prefetch, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const prefetchedRef = useRef(false)
  const mode: PrefetchMode = prefetch ?? 'hover'

  const doPrefetch = useCallback(() => {
    if (prefetchedRef.current || mode === 'none') return
    prefetchedRef.current = true

    const to = typeof props.to === 'string' ? props.to : props.to.pathname ?? ''
    void preloadRoutesForPath(to)
  }, [props.to, mode])

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (mode === 'hover') {
        doPrefetch()
      }
      onMouseEnter?.(e)
    },
    [mode, doPrefetch, onMouseEnter]
  )

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLAnchorElement>) => {
      if (mode === 'hover') {
        doPrefetch()
      }
      onFocus?.(e)
    },
    [mode, doPrefetch, onFocus]
  )

  return <Link {...props} onMouseEnter={handleMouseEnter} onFocus={handleFocus} />
}

export default PrefetchLink
