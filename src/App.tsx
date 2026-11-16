import { useRef } from 'react'
import { usePageMeta } from './hooks/usePageMeta'
import { useReveal } from './hooks/useReveal'
import { useScrollToTop } from './hooks/useScrollToTop'
import RoundNavigationButton from './components/RoundNavigationButton'
import { MAIN_TEXT_STYLE } from './styles/typography'

function App() {
  const pageRef = useRef<HTMLDivElement | null>(null)

  // ランディングページはデフォルトのメタタグを使用
  usePageMeta()

  useScrollToTop()

  // 即座にreveal要素を表示（遅延なし）
  useReveal(pageRef)

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto h-[100svh] max-w-none px-4 sm:px-6 page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <section className="home-hero relative flex min-h-[100svh] flex-col items-center justify-center text-center">
          <div className="space-y-6">
            <h1 className="reveal text-4xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong)] sm:text-5xl md:text-6xl">
              haroin57 web
            </h1>
            <p className="reveal mx-auto max-w-none text-base leading-relaxed opacity-90 sm:text-lg md:text-xl">
              I&apos;m haroin, an engineering student belonging to Shinshu University, interested in distributed systems, web
              development, and desktop music.
            </p>
          </div>
          <RoundNavigationButton to="/home" label="ホームへ移動" direction="down" className="absolute bottom-10" />
        </section>
      </main>
    </div>
  )
}

export default App
