import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HabitStats } from '../types/habit'
import { habitRequest } from '../lib/habit'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'

// Match the Posts controls and the section styling used on Habit.
const buttonClass = 'habit-control'
const headingClass = 'section-heading'
const sectionClass = 'content-section'

const colors = ['#263238', '#165546', '#208367', '#32b38a', '#69e2b0']
export default function Logs() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  useReveal(pageRef)
  useScrollToTop()
  usePageMeta({ title: '習慣ログ | haroin57 web', description: 'If-Then習慣の活動履歴と累計実績。' })
  const [stats, setStats] = useState<HabitStats | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    habitRequest<HabitStats>('stats', undefined, undefined, controller.signal).then(setStats).catch((err: Error) => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [retry])
  // Align the first day to Sunday, with each column representing one week.
  const padding = stats?.days[0] ? new Date(`${stats.days[0].date}T00:00:00Z`).getUTCDay() : 0
  return <div ref={pageRef} className="relative overflow-hidden">
    <main className="relative z-10 min-h-screen flex flex-col page-fade" style={MAIN_TEXT_STYLE}>
      <div className="mx-auto w-full flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
        <div className="mx-auto w-full max-w-5xl space-y-6 text-left">
          <header className="reveal flex items-center justify-between gap-4" style={MAIN_FONT_STYLE}>
            <nav className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
              <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>Home</Link>
              <Link to="/habit" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>記録画面</Link>
            </nav>
          </header>
          <div className="font-vdl-logomaru text-xs sm:text-sm text-[color:var(--fg,inherit)] space-y-6">
            <p className="opacity-80">日々の運動・学習・創作の積み上げです。JST午前4時に記録日が切り替わります。</p>
            {error && <div role="alert" className="space-y-2 py-4"><p className="text-red-400">{error}</p><button className={buttonClass} onClick={() => { setError(''); setRetry(retry + 1) }}>再取得する</button></div>}
            {!stats && !error && <p role="status">活動ログを読み込んでいます。</p>}
            {stats && <>
              <section className={sectionClass} aria-label="累計実績"><div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  ['連続達成', `${stats.streak_days}日`], ['累計スクワット', `${stats.totals.total_squat.toLocaleString()}回`],
                  ['累計バイク', `${stats.totals.total_bike_minutes.toLocaleString()}分`], ['英語レッスン', `${stats.totals.total_english.toLocaleString()}回`], ['クロッキー', `${stats.totals.drawing_days.toLocaleString()}日`],
                ].map(([label, value]) => <div key={label} className="space-y-2"><h2 className="text-xs sm:text-sm opacity-75">{label}</h2><p className={headingClass}>{value}</p></div>)}
              </div></section>
              <section className={sectionClass}><h2 className={headingClass}>過去365日の活動</h2>
                <p className="text-xs sm:text-sm opacity-80">色の濃さは、その日に実施した項目数を表します。各マスで日付と達成数を確認できます。</p>
                <div className="overflow-x-auto pb-3" tabIndex={0} aria-label="活動ヒートマップ。横にスクロールできます。">
                  <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="list" aria-label="日別の達成項目数">
                    {Array.from({ length: padding }, (_, i) => <div key={`pad-${i}`} className="h-3 w-3" aria-hidden="true" />)}
                    {stats.days.map(day => <div key={day.date} role="listitem" tabIndex={0} title={`${day.date}：${day.score}項目達成`} aria-label={`${day.date}：${day.score}項目達成`} className="h-3 w-3 rounded-sm focus:outline focus:outline-2 focus:outline-white" style={{ backgroundColor: colors[Math.min(4, day.score)] }} />)}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm"><span>少</span>{colors.map(color => <span key={color} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />)}<span>多（4項目以上）</span></div>
              </section>
              <section className={sectionClass}><h2 className={headingClass}>直近30日のログ</h2>
                {stats.logs.length === 0 && <p>記録はまだありません。</p>}
                <ul className="posts-divider">
                  {stats.logs.map(log => <li key={log.target_date} className="space-y-2 py-4 group"><article className="space-y-2">
                    <h3 className="text-xs sm:text-sm opacity-75"><time dateTime={log.target_date}>{log.target_date}</time></h3>
                    <p>SQ {log.squat_count}回 / 腕立て {log.pushup_sets}set / 腹筋・プランク {log.abs_sets}set / バイク {log.bike_minutes}分 / 英語 {log.english_count}回 / 資料 {log.screenshot_count}枚</p>
                    <p>{[['サーキット', log.circuit_done], ['シャドーイング', log.shadowing_done], ['クロッキー', log.drawing_done], ['仕事初動', log.work_focus_done]].filter(([, done]) => done).map(([label]) => `${label}完了`).join(' / ') || '完了チェックはありません。'}</p>
                    {log.memo && <p className="whitespace-pre-wrap break-words">{log.memo}</p>}
                  </article></li>)}
                </ul>
              </section>
            </>}
          </div>
        </div>
      </div>
    </main>
  </div>
}
