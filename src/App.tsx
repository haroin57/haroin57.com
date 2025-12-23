import { useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from './hooks/usePageMeta'
import { useReveal } from './hooks/useReveal'
import { useScrollToTop } from './hooks/useScrollToTop'
import ArrowRightIcon from './components/icons/ArrowRightIcon'
import { MAIN_TEXT_STYLE } from './styles/typography'


function App() {
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement | null>(null)

  // ランディングページはデフォルトのメタタグを使用
  usePageMeta()

  useScrollToTop()

  useEffect(() => {
    document.body.classList.add('top-page')
    return () => {
      document.body.classList.remove('top-page')
    }
  }, [])

  const handleNavigate = useCallback(() => {
    navigate('/home')
  }, [navigate])

  // 即座にreveal要素を表示（遅延なし）
  useReveal(pageRef)

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto h-[100svh] max-w-4xl px-4 sm:px-6 page-fade"
        style={MAIN_TEXT_STYLE}
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
              <ArrowRightIcon className="h-5 w-5 rotate-90" />
            </div>
            <div className="absolute -translate-y-[300%] transition-transform duration-300 group-hover:translate-y-0">
              <ArrowRightIcon className="h-5 w-5 rotate-90" />
            </div>
          </button>
        </section>
      </main>
    </div>
  )
}

export default App
