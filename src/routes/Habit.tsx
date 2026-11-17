import { useRef } from 'react'
import { Link } from 'react-router-dom'
import HabitActivity from '../components/HabitActivity'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'

export default function Habit() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  useReveal(pageRef)
  useScrollToTop()
  usePageMeta({ title: '習慣ログ | haroin57 web', description: 'If-Then習慣の活動履歴と累計実績。' })
  return <div ref={pageRef} className="relative overflow-hidden">
    <main className="relative z-10 min-h-screen flex flex-col page-fade" style={MAIN_TEXT_STYLE}>
      <div className="mx-auto w-full flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
        <div className="mx-auto w-full max-w-5xl space-y-6 text-left">
          <header className="reveal flex items-center justify-between gap-4" style={MAIN_FONT_STYLE}>
            <nav className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
              <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>Home</Link>
            </nav>
          </header>
          <HabitActivity />
        </div>
      </div>
    </main>
  </div>
}
