import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HabitStats } from '../types/habit'
import { habitButton, habitRequest } from '../lib/habit'
import { MAIN_TEXT_STYLE } from '../styles/typography'
import { usePageMeta } from '../hooks/usePageMeta'

const colors = ['#263238', '#165546', '#208367', '#32b38a', '#69e2b0']
export default function Logs() {
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
  return <main className="mx-auto min-h-screen max-w-5xl space-y-7 px-4 py-10 sm:py-20" style={MAIN_TEXT_STYLE}>
    <nav className="flex gap-6"><Link to="/home">Home</Link><Link to="/habit">記録画面</Link></nav>
    <h1 className="text-3xl">If-Then 習慣ログ</h1><p>日々の運動・学習・創作の積み上げです。JST午前4時に記録日が切り替わります。</p>
    {error && <div role="alert"><p>{error}</p><button className={habitButton} onClick={() => { setError(''); setRetry(retry + 1) }}>再取得する</button></div>}
    {!stats && !error && <p role="status">活動ログを読み込んでいます。</p>}
    {stats && <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['連続達成', `${stats.streak_days}日`], ['累計スクワット', `${stats.totals.total_squat.toLocaleString()}回`],
          ['累計バイク', `${stats.totals.total_bike_minutes.toLocaleString()}分`], ['英語レッスン', `${stats.totals.total_english.toLocaleString()}回`], ['クロッキー', `${stats.totals.drawing_days.toLocaleString()}日`],
        ].map(([label, value]) => <div key={label} className="glass-panel space-y-2 p-4"><h2>{label}</h2><p className="text-2xl">{value}</p></div>)}
      </section>
      <section className="glass-panel space-y-3 p-5"><h2 className="text-xl">過去365日の活動</h2>
        <p className="text-sm">色の濃さは、その日に実施した項目数を表します。各マスで日付と達成数を確認できます。</p>
        <div className="overflow-x-auto pb-3" tabIndex={0} aria-label="活動ヒートマップ。横にスクロールできます。">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="list" aria-label="日別の達成項目数">
            {Array.from({ length: padding }, (_, i) => <div key={`pad-${i}`} className="h-3 w-3" aria-hidden="true" />)}
            {stats.days.map(day => <div key={day.date} role="listitem" tabIndex={0} title={`${day.date}：${day.score}項目達成`} aria-label={`${day.date}：${day.score}項目達成`} className="h-3 w-3 rounded-sm focus:outline focus:outline-2 focus:outline-white" style={{ backgroundColor: colors[Math.min(4, day.score)] }} />)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm"><span>少</span>{colors.map(color => <span key={color} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />)}<span>多（4項目以上）</span></div>
      </section>
      <section className="space-y-4"><h2 className="text-xl">直近30日のログ</h2>
        {stats.logs.length === 0 && <p>記録はまだありません。</p>}
        {stats.logs.map(log => <article key={log.target_date} className="glass-panel space-y-3 p-5">
          <h3><time dateTime={log.target_date}>{log.target_date}</time></h3>
          <p>SQ {log.squat_count}回 / 腕立て {log.pushup_sets}set / 腹筋・プランク {log.abs_sets}set / バイク {log.bike_minutes}分 / 英語 {log.english_count}回 / 資料 {log.screenshot_count}枚</p>
          <p>{[['サーキット', log.circuit_done], ['シャドーイング', log.shadowing_done], ['クロッキー', log.drawing_done], ['仕事初動', log.work_focus_done]].filter(([, done]) => done).map(([label]) => `${label}完了`).join(' / ') || '完了チェックはありません。'}</p>
          {log.memo && <p className="whitespace-pre-wrap break-words">{log.memo}</p>}
        </article>)}
      </section>
    </>}
  </main>
}
