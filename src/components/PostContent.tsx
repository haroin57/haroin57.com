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

    // ウィジェットをロードする関数
    const loadWidgets = () => {
      if (win.twttr?.widgets?.load) {
        win.twttr.widgets.load(container)
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
      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.setAttribute('charset', 'utf-8')
      script.onload = () => {
        // スクリプトロード後、twttr.ready を使うか直接ロード
        if (win.twttr?.ready) {
          win.twttr.ready(loadWidgets)
        } else {
          // フォールバック: 少し待ってからロード
          setTimeout(loadWidgets, 100)
        }
      }
      document.body.appendChild(script)
    } else {
      // スクリプトは存在するがまだロード中の場合
      const checkAndLoad = () => {
        if (win.twttr?.widgets?.load) {
          loadWidgets()
        } else {
          setTimeout(checkAndLoad, 100)
        }
      }
      checkAndLoad()
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
