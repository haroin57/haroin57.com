import { useCallback, useRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { preloadRoutesForPath } from '../lib/preloadRoutes'

type PrefetchMode = 'hover' | 'visible' | 'none'

type PrefetchLinkProps = LinkProps & {
  prefetch?: PrefetchMode
}

// 低速回線かどうかを判定（3G以下またはsaveData有効）
const isSlowConnection = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  if (!conn) return false
  if (conn.saveData) return true
  const type = conn.effectiveType
  return type === 'slow-2g' || type === '2g' || type === '3g'
}

function PrefetchLink({ prefetch, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const prefetchedRef = useRef(false)
  const mode: PrefetchMode = prefetch ?? 'hover'

  const doPrefetch = useCallback(() => {
    if (prefetchedRef.current || mode === 'none') return
    // 低速回線ではプリフェッチをスキップ
    if (isSlowConnection()) return
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
