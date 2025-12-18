import { useLocation } from 'react-router-dom'

const BACKGROUND_SRC = '/background-1920.webp'
const BACKGROUND_SRCSET = [
  '/background-1280.webp 1280w',
  '/background-1920.webp 1920w',
  '/background-2560.webp 2560w',
  '/background-3840.webp 3840w',
].join(', ')
const BACKGROUND_SIZES = '100vw'

export default function GlobalBackground() {
  const location = useLocation()
  const opacity = location.pathname === '/' ? 1 : 0.45

  return (
    <div className="global-bg-container">
      <img
        src={BACKGROUND_SRC}
        srcSet={BACKGROUND_SRCSET}
        sizes={BACKGROUND_SIZES}
        alt=""
        className="global-bg select-none"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        width={6000}
        height={4000}
        style={{
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          opacity,
          filter: 'blur(var(--bg-blur, 0px))',
          transform: 'scale(var(--bg-scale, 1))',
          transformOrigin: 'center',
        }}
      />
    </div>
  )
}

