import { useEffect, useRef, memo } from 'react'
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

// Twitter埋め込みウィジェットをロード
function useTwitterEmbeds(containerRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Twitter埋め込みがあるか確認
    const twitterEmbeds = container.querySelectorAll('.twitter-tweet')
    if (twitterEmbeds.length === 0) return

    const win = window as TwitterWindow
    let retryCount = 0
    const maxRetries = 20  // 最大2秒間リトライ

    // ウィジェットをロードする関数
    const loadWidgets = () => {
      const load = win.twttr?.widgets?.load
      if (load) {
        // モバイルSafari対応: requestAnimationFrameで次のフレームまで待つ
        requestAnimationFrame(() => {
          load(container)
        })
      }
    }

    // twttrオブジェクトが準備できるまで待機
    const waitForTwttr = () => {
      if (win.twttr?.widgets?.load) {
        loadWidgets()
      } else if (retryCount < maxRetries) {
        retryCount++
        setTimeout(waitForTwttr, 100)
      }
    }

    // window.twttr が既に存在する場合はウィジェットをロード
    if (win.twttr?.widgets?.load) {
      loadWidgets()
      return
    }

    // スクリプトがまだない場合は追加
    const existingScript = document.querySelector('script[src*="platform.twitter.com/widgets.js"]')
    if (!existingScript) {
      // twttr初期化用のグローバル設定（モバイルSafari対応）
      ;(window as TwitterWindow & { __twttr_widget_ready?: boolean }).__twttr_widget_ready = false

      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.setAttribute('charset', 'utf-8')

      // onloadとonerrorの両方をハンドリング
      script.onload = () => {
        // スクリプトロード後、twttr.ready を使うか直接ロード
        if (win.twttr?.ready) {
          win.twttr.ready(() => {
            ;(window as TwitterWindow & { __twttr_widget_ready?: boolean }).__twttr_widget_ready = true
            loadWidgets()
          })
        } else {
          // フォールバック: ポーリングでtwttrを待つ
          waitForTwttr()
        }
      }

      script.onerror = () => {
        console.warn('Twitter widget script failed to load')
      }

      // head に追加（モバイルSafariではbodyよりheadの方が安定）
      document.head.appendChild(script)
    } else {
      // スクリプトは存在するがまだロード中の場合
      waitForTwttr()
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
