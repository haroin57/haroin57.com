import { useEffect, type RefObject } from 'react'
import { extractCodeText, writeToClipboard } from '../utils/clipboard'

/**
 * コードブロックのコピーボタン機能を提供するフック
 * @param ref コードブロックを含む要素のref
 * @param dependency 依存値（htmlなど）変更時に再設定
 */
export function useCodeBlockCopy(
  ref: RefObject<HTMLElement | null>,
  dependency?: unknown
): void {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const timeouts = new Map<HTMLButtonElement, number>()

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest?.('button.mdn-code-copy') as HTMLButtonElement | null
      if (!button) return

      const figure = button.closest('figure[data-rehype-pretty-code-figure]') as HTMLElement | null
      const code = figure?.querySelector('pre > code') as HTMLElement | null
      if (!code) return

      const codeText = extractCodeText(code).trimEnd()
      if (!codeText) return

      const ok = await writeToClipboard(codeText)
      if (!ok) return

      const prev = timeouts.get(button)
      if (prev) window.clearTimeout(prev)
      button.classList.add('is-copied')
      button.textContent = 'Copied'

      const timer = window.setTimeout(() => {
        button.classList.remove('is-copied')
        button.textContent = 'Copy'
        timeouts.delete(button)
      }, 1200)

      timeouts.set(button, timer)
    }

    root.addEventListener('click', onClick)
    return () => {
      root.removeEventListener('click', onClick)
      for (const timer of timeouts.values()) {
        window.clearTimeout(timer)
      }
      timeouts.clear()
    }
  }, [ref, dependency])
}
