import { useEffect, useState, type DependencyList, type RefObject } from 'react'
import { renderMermaidBlocks } from '../utils/mermaid'

export function useMermaidBlocks<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: DependencyList = []
) {
  // hydrationが完了したかを追跡
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    // hydrationが完了していない場合は何もしない
    if (!hydrated) return

    const root = ref.current
    console.log('[useMermaidBlocks] Effect triggered, root:', root ? 'exists' : 'null', 'hydrated:', hydrated)
    if (!root) return

    // DOMが更新された後にMermaidをレンダリング
    // requestIdleCallbackでブラウザがアイドル状態になってからレンダリング
    const render = () => {
      console.log('[useMermaidBlocks] Calling renderMermaidBlocks')
      console.log('[useMermaidBlocks] root.innerHTML length:', root.innerHTML.length)
      console.log('[useMermaidBlocks] mermaid-block count:', root.querySelectorAll('.mermaid-block').length)
      void renderMermaidBlocks(root)
    }

    // requestIdleCallbackが利用可能ならそれを使用、なければsetTimeout
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(render, { timeout: 500 })
      return () => window.cancelIdleCallback(idleId)
    } else {
      const timerId = setTimeout(render, 150)
      return () => clearTimeout(timerId)
    }
  }, [ref, hydrated, ...deps])
}
