import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

function App() {
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement | null>(null)

  const handleNavigate = useCallback(() => {
    navigate('/home')
  }, [navigate])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // 即座にreveal要素を表示（遅延なし）
  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    // マイクロタスクで即座に表示
    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto h-[100svh] max-w-4xl px-4 sm:px-6 page-fade"
        style={{ fontFamily: `"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif`, color: 'var(--fg)' }}
        >
          <section className="home-hero relative flex min-h-[100svh] flex-col items-center justify-center text-center">
            <div className="space-y-6">
              <h1 className="reveal text-4xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong)] sm:text-5xl md:text-6xl">
                haroin57 web
              </h1>
            <p className="reveal mx-auto max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg md:text-xl">
              I&apos;m haroin, an engineering student belonging to Shinshu University, interested in distributed systems, web
              development, and desktop music.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNavigate}
            className="group absolute bottom-10 left-1/2 z-30 -translate-x-1/2 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-neutral-950 font-medium text-neutral-200 active:scale-95 transition-transform"
          >
            <div className="transition-transform duration-300 group-hover:translate-y-[300%]">
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
            <div className="absolute -translate-y-[300%] transition-transform duration-300 group-hover:translate-y-0">
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
