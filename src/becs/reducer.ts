import { emptyProgress, localDate } from './model.ts'
import type { Control, Purpose, Result, Session, Source } from './model.ts'

export function reject(control: Control, reason: string, message: string, missing?: string[]): Result {
  return { outcome: 'REJECTED', state_changed: false, state_revision: control.state.revision, reason, message, ...(missing ? { missing } : {}) }
}
export function accept(control: Control, now: string, message: string): Result {
  control.state.revision++
  control.state.updatedAt = now
  return { outcome: 'ACCEPTED', state_changed: true, state_revision: control.state.revision, message }
}
export function settleExpiries(control: Control, now: string): void {
  const active = control.overrides.filter(item => !item.ended_at && Date.parse(item.expires_at) > Date.parse(now))
  control.state.overrideMode = active.some(item => item.mode === 'EMERGENCY') ? 'EMERGENCY' : active.length ? 'TEMPORARY' : 'NONE'
}
export function startSession(control: Control, kind: Session['kind'], now: string): Session {
  const session: Session = { id: crypto.randomUUID(), kind, plan_date: control.state.planDate, started_at: now, active_seconds: 0, status: 'ACTIVE', ...(kind === 'FOCUS' ? { last_heartbeat_at: now } : {}) }
  control.sessions.push(session)
  return session
}
export function closeMissing(control: Control): string[] {
  const p = control.state.progress
  return [!control.state.restDay && p.strengthSetsCompleted < 3 ? '筋トレ3セット' : '', !control.state.restDay && p.bikeActiveSeconds < 24 * 60 ? 'バイク実測24分' : '', !p.bathCompleted ? '入浴' : '', !control.state.restDay && !p.croquisCompleted ? 'クロッキー' : '', !p.tomorrowTop3Defined ? '翌日の優先To-Do3枠' : '', !p.dailyReviewCompleted ? '当日レビュー' : ''].filter(Boolean)
}
export function checkpoint(control: Control, purpose: Purpose, source: Source, now: string, tagId?: string): Result {
  const s = control.state
  const phase = s.routinePhase
  let session: Session | undefined
  if (purpose === 'NFC_DAILY_CLOSE') return reject(control, 'CONFIRM_REQUIRED', '日次レビュー画面で内容を確認して確定してください。', closeMissing(control))
  switch (purpose) {
    case 'NFC_WAKE':
      if (phase !== 'SLEEPING') return reject(control, 'INVALID_TRANSITION', '起床は就寝フェーズから申告します。')
      if (s.planDate !== localDate(now)) {
        control.todayTasks = control.tomorrowTop3.filter(item => item.trim()).map(title => ({ id: crypto.randomUUID(), title })); s.planDate = localDate(now); s.progress = emptyProgress(); s.restDay = false; control.review = ''; control.tomorrowTop3 = ['', '', '']; delete s.rewardExpiresAt
      }
      s.location = 'HOME'; s.routinePhase = 'MORNING'; s.wakeAt = now; break
    case 'NFC_DEPARTURE':
      if (phase !== 'MORNING' || !s.wakeAt) return reject(control, 'INVALID_TRANSITION', '起床後に外出を申告します。')
      s.progress.morningDepartureWithin45m = Date.parse(now) - Date.parse(s.wakeAt) <= 45 * 60_000
      s.location = 'TRANSIT'; s.routinePhase = 'TRANSIT'; break
    case 'NFC_LAB_ARRIVAL':
      if (phase !== 'TRANSIT') return reject(control, 'INVALID_TRANSITION', '外出後に研究室到着を申告します。')
      s.location = 'LAB'; s.routinePhase = 'RESEARCH'; break
    case 'NFC_FOCUS_START':
      if (phase !== 'RESEARCH' || s.focusPhase !== 'IDLE' || control.sessions.some(item => item.status === 'ACTIVE')) return reject(control, 'SESSION_ACTIVE', '研究フェーズで、実行中のセッションがない場合に開始できます。')
      session = startSession(control, 'FOCUS', now); s.focusPhase = 'FOCUS_25'; break
    case 'NFC_HOME_RETURN':
      if (phase !== 'TRANSIT' && phase !== 'RESEARCH') return reject(control, 'INVALID_TRANSITION', '外出・研究フェーズから帰宅を申告します。')
      for (const active of control.sessions.filter(item => item.status === 'ACTIVE')) { active.status = 'INTERRUPTED'; active.ended_at = now }
      s.focusPhase = 'IDLE'; s.location = 'HOME'; s.routinePhase = 'EVENING_STRENGTH'; delete s.rewardExpiresAt; break
    case 'NFC_STRENGTH_SET':
      if (phase !== 'EVENING_STRENGTH' || s.progress.strengthSetsCompleted >= 3) return reject(control, 'INVALID_TRANSITION', '筋トレフェーズで3セットまで申告できます。')
      s.progress.strengthSetsCompleted++; break
    case 'NFC_BIKE_START':
      if (phase !== 'EVENING_STRENGTH' || (!s.restDay && s.progress.strengthSetsCompleted < 3)) return reject(control, 'STRENGTH_REQUIRED', '3セット、または本人による休養申告が必要です。')
      session = startSession(control, 'BIKE', now); s.routinePhase = 'EVENING_BIKE'; break
    case 'NFC_BATH_DONE':
    case 'NFC_CROQUIS_DONE': {
      if (phase !== 'EVENING_WRAPUP') return reject(control, 'INVALID_TRANSITION', '夜の振り返りフェーズで申告します。')
      const key = purpose === 'NFC_BATH_DONE' ? 'bathCompleted' : 'croquisCompleted'
      if (s.progress[key]) return reject(control, 'ALREADY_RECORDED', '既に申告済みです。')
      s.progress[key] = true; break
    }
    case 'NFC_SLEEP':
      if (phase !== 'COMPLETED') return reject(control, 'INVALID_TRANSITION', '日次クローズ後に就寝へ切り替えます。')
      s.routinePhase = 'SLEEPING'; s.focusPhase = 'IDLE'; delete s.rewardExpiresAt; break
  }
  s.locationEvidence = source === 'MANUAL' ? 'MANUAL' : 'NFC_SELF_DECLARED'
  if (tagId) s.lastCheckpointTagId = tagId
  return { ...accept(control, now, 'チェックポイントを受理しました。行動完了は本人申告です。'), checkpoint: purpose, ...(session ? { session_id: session.id } : {}) }
}
export function heartbeat(control: Control, session: Session, now: string): Result {
  if (session.status !== 'ACTIVE' || session.kind !== 'FOCUS') return reject(control, 'SESSION_INACTIVE', '実行中の集中セッションではありません。')
  const gap = (Date.parse(now) - Date.parse(session.last_heartbeat_at ?? session.started_at)) / 1000
  // Missing heartbeats never count as active work. No wall-clock-only reward.
  if (gap < 0 || gap > 30) { session.status = 'INTERRUPTED'; session.ended_at = now; control.state.focusPhase = 'IDLE'; return accept(control, now, '計測が途切れたため中断しました。解放権は付与しません。') }
  session.active_seconds += gap; session.last_heartbeat_at = now
  return accept(control, now, '集中タイマーを計測しました。')
}
export function completeSession(control: Control, session: Session, now: string, interrupted: boolean): Result {
  if (session.status !== 'ACTIVE') return reject(control, 'SESSION_INACTIVE', '既に終了したセッションです。')
  if (!interrupted && session.kind === 'FOCUS' && (session.active_seconds < 1500 || Date.parse(now) - Date.parse(session.last_heartbeat_at ?? session.started_at) > 30_000)) return reject(control, 'MEASUREMENT_REQUIRED', '中断のない25分のタイマー計測が必要です。')
  if (!interrupted && session.kind === 'BREAK' && Date.parse(now) - Date.parse(session.started_at) < 600_000) return reject(control, 'MEASUREMENT_REQUIRED', '休憩10分が必要です。')
  session.status = interrupted ? 'INTERRUPTED' : 'COMPLETED'; session.ended_at = now
  const s = control.state
  if (session.kind === 'FOCUS') {
    s.focusPhase = 'IDLE'
    s.progress.researchActiveSecondsSinceBreak += session.active_seconds
    if (!interrupted) {
      s.progress.focusSessionsCompleted++
      // Reward belongs to the session's starting plan and never carries to another day.
      if (session.plan_date === localDate(now)) s.rewardExpiresAt = new Date(Math.min(Date.parse(now) + 900_000, Date.parse(`${session.plan_date}T23:59:59+09:00`))).toISOString()
    }
  } else if (session.kind === 'BREAK') { s.focusPhase = 'IDLE'; if (!interrupted) s.progress.researchActiveSecondsSinceBreak = 0 }
  else { s.routinePhase = 'EVENING_WRAPUP'; s.progress.bikeActiveSeconds += session.active_seconds }
  return accept(control, now, interrupted ? 'セッションを中断しました。' : '計測済みセッションを完了しました。')
}
