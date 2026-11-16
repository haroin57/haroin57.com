import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { BecsButton as Button, BecsInput as Input, BecsSection as Section } from '../components/BecsControls'
import { becsRequest, BecsError } from '../becs/client'
import BecsRegistry from '../components/BecsRegistry'
import { purposes } from '../becs/model'
import type { Control as ControlState, Purpose, Result } from '../becs/model'
import { usePageMeta } from '../hooks/usePageMeta'

import { checkpointLabels as labels } from '../becs/labels'

type Pending = { path: string; method: string; body: Record<string, unknown> }
export default function Control() {
  const { tagId } = useParams()
  const location = useLocation()
  usePageMeta({ title: '生活チェックポイント | haroin57 web', description: '本人用のNFCチェックポイント管理画面です。' })
  const [data, setData] = useState<ControlState | null>(null)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [reason, setReason] = useState('手動チェックポイント')
  const [top3, setTop3] = useState(['', '', ''])
  const [review, setReview] = useState('')
  const [draft, setDraft] = useState('')
  const [credential, setCredential] = useState('')
  const [audit, setAudit] = useState<{ type: string; source: string; received_at: string; payload: string }[]>([])
  const lock = useRef(false)
  const loaded = useRef(false)
  const timerSession = useRef<string | undefined>(undefined)
  const interruptionNeeded = useRef(false)
  const refresh = useCallback(async () => {
    try {
      const result = await becsRequest<ControlState>('/state'); setData(result)
      if (!loaded.current) { setTop3(result.tomorrowTop3); setReview(result.review); loaded.current = true }
    } catch (err) { if (err instanceof BecsError && err.status === 401) setData(null); throw err }
  }, [])
  useEffect(() => {
    try { const saved = sessionStorage.getItem('becs_pending'); if (saved) setPending(JSON.parse(saved) as Pending) } catch { setError('未確認操作の保存領域を利用できません。') }
    void refresh().catch(err => setError(err instanceof Error ? err.message : '状態を取得できません。'))
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.appendChild(meta)
    const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = '/becs.webmanifest'; document.head.appendChild(manifest)
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/becs-sw.js').catch(() => {})
    return () => { meta.remove(); manifest.remove() }
  }, [refresh])
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await becsRequest<{ csrf: string }>('/auth/session', 'POST', { secret }); sessionStorage.setItem('becs_csrf', result.csrf); setSecret(''); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : '認証できません。') } finally { setBusy(false) }
  }
  const send = useCallback(async (operation: Pending) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      // Persist before sending. A transport failure must retain the same operation ID.
      sessionStorage.setItem('becs_pending', JSON.stringify(operation)); setPending(operation)
      const result = await becsRequest<Result & { token?: string; device?: { device_id: string } }>(operation.path, operation.method, operation.body)
      sessionStorage.removeItem('becs_pending'); setPending(null); setNotice(result.message ?? '処理を受理しました。')
      if (result.token) setCredential(`端末ID: ${result.device?.device_id ?? operation.path.split('/')[2]}\n端末資格情報（この表示のみ）: ${result.token}`)
      if (result.tweet_draft) setDraft(result.tweet_draft)
      await refresh()
    } catch (err) {
      if (err instanceof BecsError && err.status < 500) { sessionStorage.removeItem('becs_pending'); setPending(null) }
      setError(err instanceof BecsError ? err.message : '通信失敗です。受理の有無は未確認です。同じ操作IDで再確認してください。')
    } finally { lock.current = false; setBusy(false) }
  }, [refresh])
  function act(path: string, body: Record<string, unknown> = {}, method = 'POST') {
    if (pending || busy) return
    const checkedBody = interruptionNeeded.current && path === `/sessions/${timerSession.current}/complete` ? { ...body, interrupted: true } : body
    void send({ path, method, body: { ...checkedBody, request_id: crypto.randomUUID() } })
  }
  const active = data?.sessions.find(item => item.status === 'ACTIVE')
  const activeId = active?.id
  const activeKind = active?.kind
  useEffect(() => {
    if (!activeId || activeKind !== 'FOCUS' || pending) return
    if (timerSession.current !== activeId) { timerSession.current = activeId; interruptionNeeded.current = false }
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || lock.current) return
      void send({ path: `/sessions/${activeId}/${interruptionNeeded.current ? 'complete' : 'heartbeat'}`, method: 'POST', body: { request_id: crypto.randomUUID(), ...(interruptionNeeded.current ? { interrupted: true } : {}) } })
    }, 10000)
    const visibility = () => {
      if (document.visibilityState !== 'hidden') return
      interruptionNeeded.current = true
      if (!lock.current) void send({ path: `/sessions/${activeId}/complete`, method: 'POST', body: { request_id: crypto.randomUUID(), interrupted: true } })
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [activeId, activeKind, pending, send])
  const disabled = busy || pending !== null
  const recommended: Record<string, Purpose> = { SLEEPING: 'NFC_WAKE', MORNING: 'NFC_DEPARTURE', TRANSIT: 'NFC_LAB_ARRIVAL', RESEARCH: 'NFC_FOCUS_START', EVENING_STRENGTH: data && data.state.progress.strengthSetsCompleted >= 3 ? 'NFC_BIKE_START' : 'NFC_STRENGTH_SET', EVENING_WRAPUP: data && !data.state.progress.bathCompleted ? 'NFC_BATH_DONE' : 'NFC_CROQUIS_DONE', COMPLETED: 'NFC_SLEEP' }
  const tag = data?.tags.find(item => item.tag_id === tagId)
  return <PageLayout><div className="space-y-6 font-vdl-logomaru">
    <header className="space-y-3"><h1 className="text-2xl">生活チェックポイント</h1><nav className="flex flex-wrap gap-4"><Link to="/control">状態</Link><Link to="/control/tags">タグ・端末</Link><Link to="/focus">集中</Link><Link to="/habit">公開ログ</Link></nav>
      <p className="text-sm">NFCは本人による申告です。位置や運動の証明ではありません。初期設定は観測モードです。</p></header>
    {error && <p role="alert" className="whitespace-pre-wrap">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {pending && <Section title="未確認の操作"><p>通信の結果を確認できません。同じ操作IDで照会・再試行します。古いタッチは拒否されます。</p><Button disabled={busy} onClick={() => void send(pending)}>同じ操作を再確認する</Button></Section>}
    {!data ? <form onSubmit={login} className="space-y-4"><Input label="本人用の管理者シークレット" type="password" autoComplete="current-password" value={secret} onChange={e => setSecret(e.target.value)} required /><Button type="submit" disabled={busy}>本人認証</Button><p className="text-sm">認証情報をタグURLへ含めないでください。Webセッションの有効期間は1時間です。</p></form> : <>
      <Button disabled={busy} onClick={() => void becsRequest('/auth/session', 'DELETE', {}).then(() => { sessionStorage.removeItem('becs_csrf'); setData(null); setCredential(''); setAudit([]); setDraft(''); setReview(''); setTop3(['', '', '']); loaded.current = false }).catch(err => setError(String(err)))}>ログアウト</Button>
      <Section title="解除・休養"><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => {
        // Emergency actions are never blocked by an unrelated unconfirmed checkpoint.
        void send({ path: '/overrides', method: 'POST', body: { request_id: crypto.randomUUID(), mode: 'EMERGENCY' } })
      }}>緊急解除（条件なし・60分）</Button><Button disabled={disabled} onClick={() => act('/routine/confirm', { rest_day: true, reason: '体調・休養の申告' })}>休養日にする</Button></div><p className="text-sm">端末反映はACKで確認します。通信断時はPCで「becs-agent.py unlock」を実行します。電気安全とOS保護は解除対象外です。</p>
      <Input label="一時解除・手動訂正の理由" value={reason} onChange={e => setReason(e.target.value)} /><Button disabled={disabled} onClick={() => act('/overrides', { mode: 'TEMPORARY', minutes: 30, reason })}>30分の一時解除</Button>
      {data.overrides.filter(item => !item.ended_at && item.expires_at > new Date().toISOString()).map(item => <p key={item.id}>{item.mode} / {item.expires_at} <Button disabled={disabled} onClick={() => act(`/overrides/${item.id}`, {}, 'DELETE')}>解除を終了</Button></p>)}</Section>
      {tagId && <Section title="NDEFタグの確認"><p>{tag ? `${tag.label} / ${tag.placement} / ${labels[tag.purpose]} / ${tag.status}` : '登録タグが見つかりません。'}</p><p>このURLの表示だけでは操作を確定しません。</p><Button disabled={disabled || !tag || tag.status !== 'ACTIVE'} onClick={() => {
        if (tag?.purpose === 'NFC_DAILY_CLOSE') { setNotice('下部の日次レビューを確認してください。'); return }
        void send({ path: '/nfc/scans', method: 'POST', body: { scan_id: crypto.randomUUID(), tag_id: tagId, device_id: 'web-owner', source: 'NDEF_WEB', occurred_at: new Date().toISOString() } })
      }}>内容を確認して申告する</Button></Section>}
      <Section title="現在の確定状態"><dl className="grid grid-cols-2 gap-2"><dt>次の推奨チェックポイント</dt><dd>{recommended[data.state.routinePhase] ? labels[recommended[data.state.routinePhase]] : 'セッションを確認'}</dd><dt>生活フェーズ</dt><dd>{data.state.routinePhase}</dd><dt>集中</dt><dd>{data.state.focusPhase}</dd><dt>場所の根拠</dt><dd>{data.state.locationEvidence}</dd><dt>revision</dt><dd>{data.state.revision}</dd><dt>生活日付</dt><dd>{data.state.planDate}（JST）</dd><dt>最後のチェックポイント</dt><dd className="break-all">{data.tags.find(item => item.tag_id === data.state.lastCheckpointTagId)?.label ?? '未申告'}</dd></dl>
        {data.state.wakeAt && data.state.routinePhase === 'MORNING' && <p>45分の出発目標: {new Date(Date.parse(data.state.wakeAt) + 2700000).toLocaleString('ja-JP')}</p>}
        <p>集中{data.state.progress.focusSessionsCompleted}回 / 筋トレ{data.state.progress.strengthSetsCompleted}/3セット / バイク実測{Math.floor(data.state.progress.bikeActiveSeconds / 60)}分</p>
        {data.state.rewardExpiresAt && <p>娯楽解放権の期限: {data.state.rewardExpiresAt}。10分の健康休憩とは別です。</p>}
        {data.state.progress.researchActiveSecondsSinceBreak >= 5400 && <p role="status">研究の累積が90分に達しました。10分の休憩を推奨します。</p>}
        <Button disabled={busy} onClick={() => void refresh().catch(err => setError(String(err)))}>状態を再取得</Button>
      </Section>
      {active && <Section title="実行中のセッション"><p>{active.kind} / 計測{Math.floor(active.active_seconds)}秒 / 開始日{active.plan_date}</p><p>集中は表示中に10秒ごとに計測します。30秒を超える中断は達成に含めません。</p><div className="flex flex-wrap gap-3"><Button disabled={disabled} onClick={() => act(`/sessions/${active.id}/complete`)}>計測済みの完了を確認</Button><Button disabled={disabled} onClick={() => act(`/sessions/${active.id}/complete`, { interrupted: true })}>安全に中断</Button></div></Section>}
      {location.pathname === '/control/tags' ? <BecsRegistry data={data} disabled={disabled} act={act} /> : <>
      <Section title="手動チェックポイント"><p className="text-sm">タグが使えない場合の自己申告です。NFCとは区別して監査します。</p><div className="flex flex-wrap gap-3">{purposes.filter(item => item !== 'NFC_DAILY_CLOSE').map(item => <Button key={item} disabled={disabled} onClick={() => act('/routine/confirm', { purpose: item, reason })}>{labels[item]}</Button>)}<Button disabled={disabled} onClick={() => act('/sessions', { kind: 'BREAK' })}>10分休憩</Button></div>
      <details><summary>タッチ忘れ・誤操作の訂正</summary><div className="flex flex-wrap gap-2 pt-3">{['SLEEPING', 'MORNING', 'TRANSIT', 'RESEARCH', 'EVENING_STRENGTH', 'EVENING_WRAPUP'].map(phase => <Button key={phase} disabled={disabled} onClick={() => act('/routine/confirm', { correct_phase: phase, reason })}>{phase}へ訂正</Button>)}</div><p>計測や達成は付与しません。実行中のセッションは中断します。</p></details></Section>
      <Section title="当日のTo-Do">{data.todayTasks.length ? data.todayTasks.map(task => <p key={task.id}>{task.title} / {task.completed_at ? '完了' : '未完了'} <Button disabled={disabled || !!task.completed_at} onClick={() => act(`/tasks/${task.id}/complete`)}>完了を申告</Button></p>) : <p>当日のタスクはありません。翌日の3枠は日次クローズ時に設定します。</p>}</Section>
      <Section title="日次レビューと翌日のTo-Do"><Input label="当日レビュー（非公開）" value={review} onChange={e => setReview(e.target.value)} maxLength={1000} />{top3.map((value, index) => <Input key={index} label={`翌日の優先To-Do ${index + 1}（非公開）`} value={value} maxLength={200} onChange={e => setTop3(previous => previous.map((item, i) => i === index ? e.target.value : item))} />)}<Button disabled={disabled} onClick={() => act('/daily-close', { review, tomorrow_top3: top3 })}>内容を確認して日次クローズ</Button>{draft && <div className="space-y-2"><p>{draft}</p><a target="_blank" rel="noopener noreferrer" className="underline" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(draft)}`}>文案を確認してXの投稿画面を開く</a></div>}</Section>
      </>}
      <Section title="端末への適用状況"><p>受理と端末反映は別です。未接続の機器へ適用済みとは表示しません。</p>{data.commands.slice(-10).reverse().map(command => <article key={command.command_id} className="border-t border-white/20 py-3"><p>{data.devices.find(item => item.device_id === command.device_id)?.label} / revision {command.policy_revision} / {command.policy.expires_at < new Date().toISOString() ? 'EXPIRED' : command.status}</p><p>{command.policy.reason} 有効期限: {command.policy.expires_at}</p><p>{command.detail}</p></article>)}</Section>
      <Section title="監査履歴とプライバシー"><Button disabled={busy} onClick={() => void becsRequest<{ recent_events: typeof audit }>('/report/daily').then(result => setAudit(result.recent_events)).catch(err => setError(String(err)))}>最近の受理・拒否・手動訂正を取得</Button>{audit.map((event, index) => <p className="break-words text-sm" key={index}>{event.received_at} / {event.type} / {event.source} / {event.payload}</p>)}<details><summary>非公開履歴を削除する</summary><p>BECSの行動履歴・日次レビュー・To-Do・投稿文案を削除して状態を初期化します。タグ台帳と端末登録、既存の公開Habitログは維持します。</p><Button disabled={disabled} onClick={() => { setAudit([]); setDraft(''); setReview(''); setTop3(['', '', '']); act('/privacy/history', { confirm: 'DELETE_PRIVATE_HISTORY' }, 'DELETE') }}>削除を確認して実行</Button></details></Section>
      {credential && <Section title="端末資格情報"><pre className="whitespace-pre-wrap break-all">{credential}</pre><Button onClick={() => setCredential('')}>表示を閉じる</Button></Section>}
    </>}
  </div></PageLayout>
}
