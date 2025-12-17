import { BrowserRouter, useLocation } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import AnimatedRoutes from './components/AnimatedRoutes'
import './index.css'

function GlobalBackground() {
  const location = useLocation()
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    // トップページ（/）は明るく、それ以外は透かし
    const isTopPage = location.pathname === '/'
    setOpacity(isTopPage ? 1 : 0.45)
  }, [location.pathname])

  return (
    <div className="global-bg-container">
      <img
        src="/background.webp"
        alt=""
        className="global-bg select-none"
        fetchPriority="high"
        decoding="async"
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

function Root() {
  return (
    <>
      <GlobalBackground />
      <AnimatedRoutes />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Root />
  </BrowserRouter>
)
