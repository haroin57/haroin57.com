import { useEffect, useState } from 'react'
import PrefetchLink from './PrefetchLink'
import { fetchHabitStats } from '../lib/habit'
import type { HabitLog, HabitStats } from '../types/habit'

const colors = ['#263238', '#165546', '#208367', '#32b38a', '#69e2b0']

export function HabitStatsOverview({ stats }: { stats: HabitStats }) {
  const padding = stats.days[0] ? new Date(`${stats.days[0].date}T00:00:00Z`).getUTCDay() : 0
  const totals = [
    ['連続達成', `${stats.streak_days}日`],
    ['累計スクワット', `${stats.totals.total_squat.toLocaleString()}回`],
    ['累計バイク', `${stats.totals.total_bike_minutes.toLocaleString()}分`],
    ['英語レッスン', `${stats.totals.total_english.toLocaleString()}回`],
    ['クロッキー', `${stats.totals.drawing_days.toLocaleString()}日`],
  ]
  return <>
    <section className="content-section" aria-label="累計実績">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {totals.map(([label, value]) => <div key={label} className="space-y-2"><h3 className="text-xs sm:text-sm opacity-75">{label}</h3><p className="section-heading">{value}</p></div>)}
      </div>
    </section>
    <section className="content-section">
      <h3 className="section-heading">過去365日の活動</h3>
      <p>色の濃さは、その日に実施した項目数を表します。各マスで日付と達成数を確認できます。</p>
      <div className="overflow-x-auto pb-3" tabIndex={0} aria-label="活動ヒートマップ。横にスクロールできます。">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="list" aria-label="日別の達成項目数">
          {Array.from({ length: padding }, (_, i) => <div key={`pad-${i}`} className="h-3 w-3" aria-hidden="true" />)}
          {stats.days.map(day => <div key={day.date} role="listitem" tabIndex={0} title={`${day.date}：${day.score}項目達成`} aria-label={`${day.date}：${day.score}項目達成`} className="h-3 w-3 rounded-sm focus:outline focus:outline-2 focus:outline-white" style={{ backgroundColor: colors[Math.min(4, Math.max(0, day.score))] }} />)}
        </div>
      </div>
      <div className="flex items-center gap-2"><span>少</span>{colors.map(color => <span key={color} aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />)}<span>多（4項目以上）</span></div>
    </section>
  </>
}

export function HabitLogList({ logs, compact = false }: { logs: HabitLog[]; compact?: boolean }) {
  const visible = compact ? logs.slice(0, 3) : logs
  return <section className="content-section">
    <h3 className="section-heading">{compact ? '最近の活動' : '直近30日のログ'}</h3>
    {visible.length === 0 && <p>記録はまだありません。</p>}
    <ul className="posts-divider">
      {visible.map(log => <li key={log.target_date} className="space-y-2 py-4 group"><article className="space-y-2">
        <h4 className="opacity-75"><time dateTime={log.target_date}>{log.target_date}</time></h4>
        <p>SQ {log.squat_count}回 / 腕立て {log.pushup_sets}set / 腹筋・プランク {log.abs_sets}set / バイク {log.bike_minutes}分 / 英語 {log.english_count}回 / 資料 {log.screenshot_count}枚</p>
        <p>{[['サーキット', log.circuit_done], ['シャドーイング', log.shadowing_done], ['クロッキー', log.drawing_done], ['仕事初動', log.work_focus_done]].filter(([, done]) => done).map(([label]) => `${label}完了`).join(' / ') || '完了チェックはありません。'}</p>
        {!compact && log.memo && <p className="whitespace-pre-wrap break-words">{log.memo}</p>}
      </article></li>)}
    </ul>
  </section>
}

export default function HabitActivity({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<HabitStats | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    fetchHabitStats(controller.signal).then(result => {
      if (active) { setStats(result); setError('') }
    }).catch(() => {
      if (active) setError('公開ログを取得できません。接続を確認して再取得してください。')
    }).finally(() => window.clearTimeout(timeout))
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [retry])
  return <section aria-label="Habit 公開ログ" className="space-y-4 text-left font-vdl-logomaru text-xs sm:text-sm text-[color:var(--fg,inherit)]">
    <header className="space-y-2">
      <h2 className="section-heading">{compact ? <PrefetchLink to="/habit" className="underline-thin hover:text-accent">Habit</PrefetchLink> : '日々の活動'}</h2>
      <p className="opacity-80">日々の運動・学習・創作の積み上げです。JST午前4時に記録日が切り替わります。</p>
    </header>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><button type="button" className="habit-control" onClick={() => { setError(''); setRetry(value => value + 1) }}>再取得する</button></div>}
    {!stats && !error && <p role="status">活動ログを読み込んでいます。</p>}
    {stats && <><HabitStatsOverview stats={stats} /><HabitLogList logs={stats.logs} compact={compact} /></>}
    {compact && <PrefetchLink to="/habit" className="inline-block underline-thin hover:text-accent">公開ログをすべて見る</PrefetchLink>}
  </section>
}
