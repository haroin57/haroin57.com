import { useLocation } from 'react-router-dom'
import P5HypercubeBackground from './P5HypercubeBackground'

const BACKGROUNDS = ['/background.webp', '/background2.webp']

// 横スクロール背景（PC/スマホ共通）
function ScrollingBackground({ baseOpacity }: { baseOpacity: number }) {
  return (
    <div
      className="scrolling-bg"
      style={{
        opacity: `calc(${baseOpacity} * var(--bg-opacity, 1))`,
        filter: 'blur(var(--bg-blur, 0px))',
        transform: 'scale(var(--bg-scale, 1))',
      }}
    >
      {/* 2つの画像を2セット並べて無限ループ */}
      {[...BACKGROUNDS, ...BACKGROUNDS].map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          className="scrolling-bg-image select-none"
          fetchPriority={index < 2 ? 'high' : 'low'}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
        />
      ))}
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
