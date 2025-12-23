import { useEffect, useRef, memo } from 'react'
import { useMermaidBlocks } from '../hooks/useMermaidBlocks'

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
