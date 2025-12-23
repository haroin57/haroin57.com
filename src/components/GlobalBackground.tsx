import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import P5HypercubeBackground from './P5HypercubeBackground'

const BACKGROUND_SRC = '/background-strip.webp'

// 横スクロール背景（PC/スマホ共通）
function ScrollingBackground({ baseOpacity }: { baseOpacity: number }) {
  const [imageWidth, setImageWidth] = useState<number | null>(null)

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // 画像の実際の表示幅を取得
    if (img.offsetWidth > 0) {
      setImageWidth(img.offsetWidth)
    }
  }, [])

  return (
    <div
      className="scrolling-bg"
      style={{
        opacity: `calc(${baseOpacity} * var(--bg-opacity, 1))`,
        filter: 'blur(var(--bg-blur, 0px))',
        transform: 'scale(var(--bg-scale, 1))',
      }}
    >
      <div
        className="scrolling-bg-track"
        style={imageWidth ? { '--scroll-width': `${imageWidth}px` } as React.CSSProperties : undefined}
      >
        {/* 1枚のストリップ画像を2セット並べて無限ループ */}
        {[0, 1].map((index) => (
          <img
            key={index}
            src={BACKGROUND_SRC}
            alt=""
            className="scrolling-bg-image select-none"
            fetchPriority={index === 0 ? 'high' : 'low'}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={index === 0 ? handleImageLoad : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export default function GlobalBackground() {
  const location = useLocation()
  const baseOpacity = location.pathname === '/' ? 1 : 0.45

  return (
    <div className="global-bg-container">
      <ScrollingBackground baseOpacity={baseOpacity} />
      {/* p5アニメーション（z-index: 1、CSSで設定） */}
      <P5HypercubeBackground />
    </div>
  )
}
