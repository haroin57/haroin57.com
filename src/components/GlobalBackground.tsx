import { useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import P5HypercubeBackground from './P5HypercubeBackground'

const BACKGROUNDS = ['/background.webp', '/background2.webp']
const SWITCH_INTERVAL_MS = 15000 // 15秒ごとに切り替え（横型用）
const FADE_DURATION_MS = 2000 // フェード時間

// 縦型かどうかを判定するフック
function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerHeight > window.innerWidth
  })

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
    }

    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  return isPortrait
}

// 縦型用: 横スクロール背景
function PortraitBackground({ baseOpacity }: { baseOpacity: number }) {
  return (
    <div
      className="portrait-bg-scroll"
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
          className="portrait-bg-image select-none"
          fetchPriority={index < 2 ? 'high' : 'low'}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
        />
      ))}
    </div>
  )
}

// 横型用: クロスフェード背景
function LandscapeBackground({ baseOpacity }: { baseOpacity: number }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)

      timeoutRef.current = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % BACKGROUNDS.length)
        setIsTransitioning(false)
      }, FADE_DURATION_MS)
    }, SWITCH_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const commonStyle = {
    position: 'absolute' as const,
    inset: 0,
    width: '100vw',
    height: '100vh',
    objectFit: 'cover' as const,
    filter: 'blur(var(--bg-blur, 0px))',
    transform: 'scale(var(--bg-scale, 1))',
    transformOrigin: 'center' as const,
    transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
  }

  const nextIndex = (activeIndex + 1) % BACKGROUNDS.length

  return (
    <>
      {BACKGROUNDS.map((src, index) => {
        const isCurrent = index === activeIndex
        const isNext = index === nextIndex

        let opacity: string | number = 0
        if (isCurrent && !isTransitioning) {
          opacity = `calc(${baseOpacity} * var(--bg-opacity, 1))`
        } else if (isCurrent && isTransitioning) {
          opacity = 0
        } else if (isNext && isTransitioning) {
          opacity = `calc(${baseOpacity} * var(--bg-opacity, 1))`
        } else if (isNext && !isTransitioning) {
          opacity = 0
        }

        return (
          <img
            key={src}
            src={src}
            alt=""
            className="global-bg select-none"
            fetchPriority="low"
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            style={{
              ...commonStyle,
              opacity,
              zIndex: 0,
            }}
          />
        )
      })}
    </>
  )
}

export default function GlobalBackground() {
  const location = useLocation()
  const baseOpacity = location.pathname === '/' ? 1 : 0.45
  const isPortrait = useIsPortrait()

  return (
    <div className="global-bg-container">
      {isPortrait ? (
        <PortraitBackground baseOpacity={baseOpacity} />
      ) : (
        <LandscapeBackground baseOpacity={baseOpacity} />
      )}
      {/* p5アニメーション（z-index: 1、CSSで設定） */}
      <P5HypercubeBackground />
    </div>
  )
}
