import { useCallback, useEffect, useRef } from 'react'
import { useRouteTransition } from './components/RouteTransitionContext'

const SCROLL_THRESHOLD = 280

function App() {
  const { isTransitioning, transitionTo } = useRouteTransition()
  const leavingRef = useRef(false)
  const accumulatorRef = useRef(0)
  const touchLastYRef = useRef<number | null>(null)
  const isTransitioningRef = useRef(isTransitioning)

  useEffect(() => {
    isTransitioningRef.current = isTransitioning
  }, [isTransitioning])

  const navigateToHome = useCallback(() => {
    if (leavingRef.current) return
    if (isTransitioningRef.current) return
    const started = transitionTo('/home')
    if (!started) return
    leavingRef.current = true
    document.body.style.setProperty('--home-progress', '1')
  }, [transitionTo])

  useEffect(() => {
    document.body.classList.add('home-page')
    document.body.style.setProperty('--home-progress', '0')

    const setProgress = (progress: number) => {
      const next = Math.max(0, Math.min(1, progress))
      document.body.style.setProperty('--home-progress', String(next))
    }

    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaY
      if (!Number.isFinite(dy) || dy === 0) return
      e.preventDefault()
      if (leavingRef.current) return

      accumulatorRef.current = Math.max(0, Math.min(SCROLL_THRESHOLD, accumulatorRef.current + dy))
      const progress = accumulatorRef.current / SCROLL_THRESHOLD
      setProgress(progress)
      if (progress >= 1) navigateToHome()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (leavingRef.current) return
        navigateToHome()
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (leavingRef.current) return
      if (e.touches.length !== 1) return
      touchLastYRef.current = e.touches[0]?.clientY ?? null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (touchLastYRef.current === null) return
      if (e.touches.length !== 1) return

      const y = e.touches[0]?.clientY
      if (typeof y !== 'number') return
      e.preventDefault()
      if (leavingRef.current) return

      const dy = touchLastYRef.current - y
      touchLastYRef.current = y
      accumulatorRef.current = Math.max(0, Math.min(SCROLL_THRESHOLD, accumulatorRef.current + dy))
      const progress = accumulatorRef.current / SCROLL_THRESHOLD
      setProgress(progress)
      if (progress >= 1) navigateToHome()
    }

    const resetTouch = () => {
      if (leavingRef.current) return
      touchLastYRef.current = null
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', resetTouch, { passive: true })
    window.addEventListener('touchcancel', resetTouch, { passive: true })

    return () => {
      document.body.classList.remove('home-page')
      document.body.style.removeProperty('--home-progress')
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', resetTouch)
      window.removeEventListener('touchcancel', resetTouch)
    }
  }, [navigateToHome])

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center">
        <picture>
          <source media="(prefers-color-scheme: light)" srcSet="/background.png" />
           <img
             src="/profile.png"
             alt=""
             className="select-none"
             style={{
               width: '100vw',
               height: '100vh',
               objectFit: 'cover',
               opacity: 'var(--overlay)',
               filter: 'blur(var(--bg-blur, 0px))',
               transform: 'scale(var(--bg-scale, 1))',
               transformOrigin: 'center',
             }}
           />
         </picture>
       </div>

      <main
        className="relative z-10 mx-auto h-[100svh] max-w-4xl px-4 page-fade sm:px-6"
        style={{ fontFamily: `"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif`, color: 'var(--fg)' }}
        >
          <section className="home-hero relative flex min-h-[100svh] flex-col items-center justify-center text-center">
            <div className="space-y-6">
              <h1 className="text-4xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong)] sm:text-5xl md:text-6xl">
                haroin57 web
              </h1>
            <p className="mx-auto max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg md:text-xl">
              I&apos;m haroin, an engineering student belonging to Shinshu University, interested in distributed systems, web
              development, and desktop music.
            </p>
          </div>
          <button
            type="button"
            onClick={navigateToHome}
            className="group absolute bottom-10 left-1/2 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-neutral-950 font-medium text-neutral-200 transition-all duration-300 hover:w-32"
          >
            <div className="inline-flex whitespace-nowrap opacity-0 transition-all duration-200 group-hover:-translate-x-3 group-hover:opacity-100">
              Explore
            </div>
            <div className="absolute right-3.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 rotate-90"
              >
                <path
                  d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>
        </section>
      </main>
    </div>
  )
}

export default App
