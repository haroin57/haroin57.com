import { useEffect, type DependencyList, type RefObject } from 'react'
import { renderMermaidBlocks } from '../utils/mermaid'

export function useMermaidBlocks<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: DependencyList = []
) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    void renderMermaidBlocks(root)
  }, [ref, ...deps])
}
