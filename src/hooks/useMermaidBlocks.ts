import { useEffect, useSyncExternalStore, type RefObject } from 'react'
import { renderMermaidBlocks } from '../utils/mermaid'

const emptySubscribe = () => () => {}
const getHydratedSnapshot = () => true
const getServerSnapshot = () => false

export function useMermaidBlocks<T extends HTMLElement>(
  ref: RefObject<T | null>,
  html: string
) {
  const hydrated = useSyncExternalStore(emptySubscribe, getHydratedSnapshot, getServerSnapshot)

  useEffect(() => {
    if (!hydrated) return

    const root = ref.current
    if (!root) return

    const render = () => {
      void renderMermaidBlocks(root)
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(render, { timeout: 500 })
      return () => window.cancelIdleCallback(idleId)
    } else {
      const timerId = setTimeout(render, 150)
      return () => clearTimeout(timerId)
    }
  }, [ref, hydrated, html])
}
