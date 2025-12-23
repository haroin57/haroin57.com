import { useEffect, type DependencyList, type RefObject } from 'react'
import { renderMermaidBlocks } from '../utils/mermaid'

export function useMermaidBlocks<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: DependencyList = []
) {
  useEffect(() => {
    const root = ref.current
    console.log('[useMermaidBlocks] Effect triggered, root:', root ? 'exists' : 'null')
    if (!root) return

    // DOMが更新された後にMermaidをレンダリング
    // setTimeoutで少し待ってからレンダリング（dangerouslySetInnerHTMLの反映を待つ）
    const timerId = setTimeout(() => {
      console.log('[useMermaidBlocks] Calling renderMermaidBlocks after timeout')
      console.log('[useMermaidBlocks] root.innerHTML length:', root.innerHTML.length)
      console.log('[useMermaidBlocks] mermaid-block count:', root.querySelectorAll('.mermaid-block').length)
      void renderMermaidBlocks(root)
    }, 100)

    return () => clearTimeout(timerId)
  }, [ref, ...deps])
}
