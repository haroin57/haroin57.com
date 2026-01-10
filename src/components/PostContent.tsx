import { useEffect, useRef, memo, useCallback } from 'react'
import { useMermaidBlocks } from '../hooks/useMermaidBlocks'

// KaTeX CSSを遅延ロード（数式を含むページでのみ読み込み）
let katexCssLoaded = false
function loadKatexCss() {
  if (katexCssLoaded || typeof document === 'undefined') return
  katexCssLoaded = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

// Twitter埋め込みウィジェットの型定義
type TwitterWindow = Window & {
  twttr?: {
    widgets?: {
      load?: (el?: HTMLElement) => void
    }
    ready?: (callback: () => void) => void
  }
}

// グローバルでスクリプトのロード状態を管理
// HMR時にリセットされないようwindowオブジェクトに格納
type TwitterState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  callbacks: Array<() => void>
}
const TWITTER_STATE_KEY = '__twitterWidgetState' as const
type WindowWithTwitterState = Window & { [TWITTER_STATE_KEY]?: TwitterState }

function getTwitterState(): TwitterState {
  const win = window as WindowWithTwitterState
  if (!win[TWITTER_STATE_KEY]) {
    win[TWITTER_STATE_KEY] = { status: 'idle', callbacks: [] }
  }
  return win[TWITTER_STATE_KEY]
}

function onTwitterReady(callback: () => void) {
  const state = getTwitterState()
  if (state.status === 'ready') {
    callback()
  } else {
    state.callbacks.push(callback)
  }
}

function notifyTwitterReady() {
  const state = getTwitterState()
  state.status = 'ready'
  state.callbacks.forEach(cb => cb())
  state.callbacks.length = 0
}

// Twitter埋め込みウィジェットをロード
function useTwitterEmbeds(containerRef: React.RefObject<HTMLDivElement | null>, html: string) {
  // HTMLにTwitter埋め込みが含まれていない場合は早期リターン
  const hasTwitterEmbed = html.includes('twitter-tweet')

  const loadWidgets = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const win = window as TwitterWindow
    const load = win.twttr?.widgets?.load
    if (load) {
      // 複数フレーム待ってからロード（モバイルSafari対応）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          load(container)
        })
      })
    }
  }, [containerRef])

  useEffect(() => {
    // Twitter埋め込みがない場合はスキップ
    if (!hasTwitterEmbed) return

    const container = containerRef.current
    if (!container) return

    // DOM内に実際にTwitter埋め込みがあるか確認（まだ変換されていないもの）
    const twitterEmbeds = container.querySelectorAll('blockquote.twitter-tweet')
    if (twitterEmbeds.length === 0) return

    const win = window as TwitterWindow
    const state = getTwitterState()

    // 既にtwttrが準備できている場合
    if (state.status === 'ready' && win.twttr?.widgets?.load) {
      loadWidgets()
      return
    }

    // スクリプトがエラーの場合は再試行
    if (state.status === 'error') {
      state.status = 'idle'
    }

    // スクリプトをロード中または準備完了待ち
    if (state.status === 'loading') {
      onTwitterReady(loadWidgets)
      return
    }

    // スクリプトがまだロードされていない場合
    if (state.status === 'idle') {
      state.status = 'loading'

      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.setAttribute('charset', 'utf-8')

      script.onload = () => {
        // twttr.readyを待つか、ポーリングで待機
        const waitForReady = (retries = 0) => {
          if (win.twttr?.ready) {
            win.twttr.ready(() => {
              notifyTwitterReady()
              loadWidgets()
            })
          } else if (win.twttr?.widgets?.load) {
            notifyTwitterReady()
            loadWidgets()
          } else if (retries < 50) {
            // 最大5秒待機
            setTimeout(() => waitForReady(retries + 1), 100)
          } else {
            state.status = 'error'
          }
        }
        waitForReady()
      }

      script.onerror = () => {
        state.status = 'error'
        console.warn('Twitter widget script failed to load')
      }

      document.head.appendChild(script)
      onTwitterReady(loadWidgets)
    }
    
  }, [containerRef, hasTwitterEmbed, loadWidgets])
}

// HTMLコンテンツをメモ化したコンポーネント
// 親コンポーネントの再レンダリングでMermaidのSVGが消えるのを防ぐ
const PostContent = memo(function PostContent({
  html,
  onProseRef,
}: {
  html: string
  onProseRef?: (el: HTMLDivElement | null) => void
}) {
  const proseRef = useRef<HTMLDivElement | null>(null)

  // KaTeX数式が含まれている場合のみCSSをロード
  const hasKatex = html.includes('katex') || html.includes('math-display')
  useEffect(() => {
    if (hasKatex) {
      loadKatexCss()
    }
  }, [hasKatex])

  // refを親に伝える
  useEffect(() => {
    onProseRef?.(proseRef.current)
  }, [onProseRef])

  useMermaidBlocks(proseRef, html)
  useTwitterEmbeds(proseRef, html)

  return (
    <div
      ref={proseRef}
      className="prose prose-invert font-medium font-a-otf-gothic text-sm sm:text-[17px] w-full"
      style={{ color: 'var(--fg-strong)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

export default PostContent
