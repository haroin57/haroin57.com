import { useEffect, useRef, memo, useCallback } from 'react'
import { useMermaidBlocks } from '../hooks/useMermaidBlocks'

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
let twitterScriptStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
const twitterReadyCallbacks: Array<() => void> = []

function onTwitterReady(callback: () => void) {
  if (twitterScriptStatus === 'ready') {
    callback()
  } else {
    twitterReadyCallbacks.push(callback)
  }
}

function notifyTwitterReady() {
  twitterScriptStatus = 'ready'
  twitterReadyCallbacks.forEach(cb => cb())
  twitterReadyCallbacks.length = 0
}

// Twitter埋め込みウィジェットをロード
function useTwitterEmbeds(containerRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
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
    const container = containerRef.current
    if (!container) return

    // Twitter埋め込みがあるか確認（まだ変換されていないもの）
    const twitterEmbeds = container.querySelectorAll('blockquote.twitter-tweet')
    if (twitterEmbeds.length === 0) return

    const win = window as TwitterWindow

    // 既にtwttrが準備できている場合
    if (twitterScriptStatus === 'ready' && win.twttr?.widgets?.load) {
      loadWidgets()
      return
    }

    // スクリプトがエラーの場合は再試行
    if (twitterScriptStatus === 'error') {
      twitterScriptStatus = 'idle'
    }

    // スクリプトをロード中または準備完了待ち
    if (twitterScriptStatus === 'loading') {
      onTwitterReady(loadWidgets)
      return
    }

    // スクリプトがまだロードされていない場合
    if (twitterScriptStatus === 'idle') {
      twitterScriptStatus = 'loading'

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
            twitterScriptStatus = 'error'
          }
        }
        waitForReady()
      }

      script.onerror = () => {
        twitterScriptStatus = 'error'
        console.warn('Twitter widget script failed to load')
      }

      document.head.appendChild(script)
      onTwitterReady(loadWidgets)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
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

  // refを親に伝える
  useEffect(() => {
    onProseRef?.(proseRef.current)
  }, [onProseRef])

  useMermaidBlocks(proseRef, [html])
  useTwitterEmbeds(proseRef, [html])

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
