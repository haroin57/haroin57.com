import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HabitLog, HabitResult, HabitToday } from '../types/habit'
import { habitRequest } from '../lib/habit'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'

// Posts tag controls and BBS form fields, with the existing Habit touch target size.
const buttonClass = 'min-h-12 px-3 py-1 rounded-full border text-xs sm:text-sm transition-colors border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation'
const inputClass = 'w-full min-h-12 px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]'
const headingClass = 'text-base sm:text-xl text-[color:var(--fg-strong,inherit)]'
const sectionClass = 'space-y-4 py-4 border-t border-[color:var(--ui-border)]'

const quickActions = [
  ['toilet_sq_en', 'トイレSQ30＋英語'], ['jump_sq', 'ジャンプSQ20'], ['squat30', 'SQ30'],
  ['pushup_set', '腕立て＋1set'], ['abs_set', '腹筋ローラー＋1set'], ['plank', 'プランク90秒'],
  ['english', '英語＋1'], ['screenshot', 'スクショ資料＋1'], ['work_focus', '仕事25分初動'],
]
const checks = [['circuit_done', 'サーキット筋トレ'], ['shadowing_done', 'シャドーイング'], ['drawing_done', 'クロッキー'], ['work_focus_done', '仕事25分初動']] as const
const emptyClose = { circuit_done: false, shadowing_done: false, drawing_done: false, work_focus_done: false, bike_minutes: 0, memo: '' }
function closeFromLog(log: HabitLog | null) {
  return { circuit_done: !!log?.circuit_done, shadowing_done: !!log?.shadowing_done, drawing_done: !!log?.drawing_done, work_focus_done: !!log?.work_focus_done, bike_minutes: log?.bike_minutes ?? 0, memo: log?.memo ?? '' }
}

export default function Habit() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  useReveal(pageRef)
  useScrollToTop()
  usePageMeta({ title: 'If-Then Habit | haroin57 web', description: 'If-Then習慣の記録画面。' })
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [today, setToday] = useState<HabitToday | null>(null)
  const [close, setClose] = useState(emptyClose)
  const [todos, setTodos] = useState(['', '', ''])
  const [todosEdited, setTodosEdited] = useState(false)
  const [tweet, setTweet] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const closeTargetDate = useRef<string | null>(null)
  const resyncCloseForDate = useCallback((targetDate: string, log: HabitLog | null) => {
    if (closeTargetDate.current === targetDate) return false
    closeTargetDate.current = targetDate
    setClose(closeFromLog(log))
    setTodos(['', '', ''])
    setTodosEdited(false)
    return true
  }, [])
  useEffect(() => {
    try { setToken(localStorage.getItem('habit_token') || '') } catch { setError('端末のストレージを利用できません。') }
  }, [])
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setToday(null)
    closeTargetDate.current = null
    setError('')
    habitRequest<HabitToday>('today', token, undefined, controller.signal).then(data => {
      setToday(data); resyncCloseForDate(data.target_date, data.log)
    }).catch((err: Error) => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
  }, [token, resyncCloseForDate])

  async function save(path: string, body: unknown) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setTweet('')
    try {
      const result = await habitRequest<HabitResult>(path, token, body)
      setTweet(result.tweet_text)
      const dateChanged = resyncCloseForDate(result.target_date, result.today_summary)
      setToday(previous => previous ? { ...previous, target_date: result.target_date, log: result.today_summary, streak_days: result.streak_days, todos: dateChanged ? [] : previous.todos } : previous)
      // Preserve unsaved evening edits only while the form still targets the same day.
      if (path === 'daily-close') { setClose(closeFromLog(result.today_summary)); setTodosEdited(false) }
      else if (result.today_summary.work_focus_done) setClose(previous => ({ ...previous, work_focus_done: true }))
      try {
        const data = await habitRequest<HabitToday>('today', token)
        setToday(data)
        resyncCloseForDate(data.target_date, data.log)
      } catch { setError('保存済みです。最新のTo-Do取得に失敗しました。画面を再読み込みしてください。') }
    } catch (err) { setError(err instanceof Error ? err.message : '保存に失敗しました。') }
    finally { lock.current = false; setBusy(false) }
  }
  async function complete(id: number) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      await habitRequest('todo/complete', token, { id })
      setToday(previous => previous ? { ...previous, todos: previous.todos.map(todo => todo.id === id ? { ...todo, is_completed: 1 } : todo) } : previous)
    } catch (err) { setError(err instanceof Error ? err.message : '完了の保存に失敗しました。') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div ref={pageRef} className="relative overflow-hidden">
    <main className="relative z-10 min-h-screen flex flex-col page-fade" style={MAIN_TEXT_STYLE}>
      <div className="mx-auto w-full flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
        <div className="mx-auto w-full max-w-5xl space-y-6 text-left">
          <header className="reveal flex items-center justify-between gap-4" style={MAIN_FONT_STYLE}>
            <nav className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
              <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>Home</Link>
              <Link to="/logs" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>公開ログ</Link>
            </nav>
          </header>
          <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">If-Then Habit</h1>
          <div className="font-vdl-logomaru text-xs sm:text-sm text-[color:var(--fg,inherit)] space-y-6">
            <p className="opacity-80">記録日はJST午前4時に切り替わります。実績とメモは公開ログに表示されます。</p>
            {error && <p role="alert" className="text-red-400 py-4">{error}</p>}
            {!token ? <form className={sectionClass} onSubmit={event => {
              event.preventDefault()
              const value = tokenInput.trim()
              if (!value) return
              try { localStorage.setItem('habit_token', value) } catch { setError('トークンを端末に保存できません。今回の画面でのみ使用します。') }
              setToken(value); setTokenInput('')
            }}>
              <label className="block space-y-2"><span>オーナートークン</span><input className={inputClass} type="password" autoComplete="off" required value={tokenInput} onChange={e => setTokenInput(e.target.value)} /></label>
              <button className={buttonClass}>トークンを保存して開く</button>
            </form> : <>
              <button className={buttonClass} disabled={busy} onClick={() => {
                try { localStorage.removeItem('habit_token') } catch { /* session state is still cleared */ }
                setToken(''); setToday(null); setTweet(''); setError(''); setTodos(['', '', '']); setTodosEdited(false)
              }}>トークンを削除・再入力</button>
              {!today ? <p role="status">{error ? 'トークンとAPI設定を確認し、再入力または再読み込みしてください。' : '今日の記録を読み込んでいます。'}</p> : <>
                <section className={sectionClass}>
                  <h2 className={headingClass}>{today.target_date}・連続{today.streak_days}日</h2>
                  <p>SQ {today.log?.squat_count ?? 0}回 / 腕立て {today.log?.pushup_sets ?? 0}set / 腹筋 {today.log?.abs_sets ?? 0}set / バイク {today.log?.bike_minutes ?? 0}分 / 英語 {today.log?.english_count ?? 0}回 / 資料 {today.log?.screenshot_count ?? 0}枚</p>
                  <h3 className={headingClass}>今日の最重要To-Do</h3>
                  {today.todos.length === 0 && <p>今日のTo-Doはありません。</p>}
                  {today.todos.map(todo => <div key={todo.id} className="flex items-center justify-between gap-3">
                    <span className={todo.is_completed ? 'line-through opacity-60' : ''}>{todo.priority}. {todo.title}</span>
                    <button className={buttonClass} disabled={busy || !!todo.is_completed} onClick={() => complete(todo.id)}>{todo.is_completed ? '完了済み' : '完了する'}</button>
                  </div>)}
                </section>
                <section className={sectionClass}><h2 className={headingClass}>クイック記録</h2><div className="grid grid-cols-2 gap-2">
                  {quickActions.map(([action, label]) => <button key={action} className={buttonClass} disabled={busy} onClick={() => save('quick', { action_type: action })}>{label}</button>)}
                </div></section>
                <form className={sectionClass} onSubmit={e => { e.preventDefault(); void save('daily-close', { ...close, ...(todosEdited ? { next_todos: todos } : {}) }) }}>
                  <h2 className={headingClass}>夜の総括</h2>
                  {checks.map(([field, label]) => <label key={field} className="flex min-h-12 items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={close[field]} onChange={e => setClose({ ...close, [field]: e.target.checked })} />{label}</label>)}
                  <label className="block space-y-2"><span>エアロバイク</span><select className={inputClass} value={[0, 24, 48].includes(close.bike_minutes) ? close.bike_minutes : 'custom'} onChange={e => { if (e.target.value !== 'custom') setClose({ ...close, bike_minutes: Number(e.target.value) }) }}>
                    <option value={0}>未実施（0分）</option><option value={24}>1話（24分）</option><option value={48}>2話（48分）</option>{![0, 24, 48].includes(close.bike_minutes) && <option value="custom">カスタム（{close.bike_minutes}分）</option>}
                  </select></label>
                  <label className="block space-y-2"><span>カスタム分数</span><input className={inputClass} type="number" min={0} max={1440} required value={close.bike_minutes} onChange={e => setClose({ ...close, bike_minutes: Number(e.target.value) })} /></label>
                  <label className="block space-y-2"><span>公開メモ（140字以内）</span><textarea className={inputClass} maxLength={140} rows={3} value={close.memo} onChange={e => setClose({ ...close, memo: e.target.value })} /></label>
                  <fieldset className="space-y-3"><legend className={headingClass}>明日の最重要To-Do（最大3件・非公開）</legend>
                    <p className="text-xs sm:text-sm opacity-80">編集した場合に翌日分を置き換えます。空欄にして保存すると削除します。</p>
                    {todos.map((title, i) => <label key={i} className="block"><span>優先順位 {i + 1}</span><input className={inputClass} value={title} maxLength={200} onChange={e => { setTodos(todos.map((value, index) => index === i ? e.target.value : value)); setTodosEdited(true) }} /></label>)}
                  </fieldset>
                  <button className={buttonClass} disabled={busy}>{busy ? '保存しています。' : '記録してX投稿文を作る'}</button>
                </form>
              </>}
            </>}
            {tweet && <section className={sectionClass} aria-live="polite"><h2 className={headingClass}>保存済み・X投稿文</h2><p className="whitespace-pre-wrap">{tweet}</p><a className={`${buttonClass} inline-block`} href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`} target="_blank" rel="noopener noreferrer">Xでポストする</a></section>}
          </div>
        </div>
      </div>
    </main>
  </div>
}
