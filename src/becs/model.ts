export const purposes = ['NFC_WAKE', 'NFC_DEPARTURE', 'NFC_LAB_ARRIVAL', 'NFC_FOCUS_START', 'NFC_HOME_RETURN', 'NFC_STRENGTH_SET', 'NFC_BIKE_START', 'NFC_BATH_DONE', 'NFC_CROQUIS_DONE', 'NFC_DAILY_CLOSE', 'NFC_SLEEP'] as const
export type Purpose = typeof purposes[number]
export type Source = 'IOS_SHORTCUTS' | 'NDEF_WEB' | 'NATIVE_APP' | 'MANUAL'
export type RoutinePhase = 'SLEEPING' | 'MORNING' | 'TRANSIT' | 'RESEARCH' | 'EVENING_STRENGTH' | 'EVENING_BIKE' | 'EVENING_WRAPUP' | 'COMPLETED'
export type FocusPhase = 'IDLE' | 'FOCUS_25' | 'BREAK_10' | 'PAUSED'
export type Progress = {
  morningDepartureWithin45m: boolean | null
  focusSessionsCompleted: number
  researchActiveSecondsSinceBreak: number
  strengthSetsCompleted: number
  bikeActiveSeconds: number
  bathCompleted: boolean
  croquisCompleted: boolean
  tomorrowTop3Defined: boolean
  dailyReviewCompleted: boolean
}
export type State = {
  location: 'HOME' | 'TRANSIT' | 'LAB' | 'OUTSIDE' | 'UNKNOWN'
  locationEvidence: 'NFC_SELF_DECLARED' | 'MANUAL' | 'UNVERIFIED'
  routinePhase: RoutinePhase
  focusPhase: FocusPhase
  overrideMode: 'NONE' | 'TEMPORARY' | 'EMERGENCY'
  progress: Progress
  revision: number
  updatedAt: string
  planDate: string
  wakeAt?: string
  lastCheckpointTagId?: string
  rewardExpiresAt?: string
  restDay: boolean
}
export type Tag = { tag_id: string; purpose: Purpose; label: string; placement: string; status: 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'REPLACED'; version: number; replaced_by?: string; last_success_at?: string }
export type Device = { device_id: string; label: string; type: 'IPHONE' | 'MAC' | 'ESP32' | 'DNS'; token_hash: string; status: 'ACTIVE' | 'REVOKED'; last_seen_at?: string }
export type Binding = { binding_id: string; tag_id: string; device_id: string; mode: Exclude<Source, 'MANUAL'>; registered_at: string; disabled_at?: string }
export type Session = { id: string; kind: 'FOCUS' | 'BREAK' | 'BIKE'; plan_date: string; started_at: string; ended_at?: string; active_seconds: number; status: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED'; last_heartbeat_at?: string; device_id?: string; last_telemetry_at?: string; rpm?: number; local_state?: string; playback_allowed_locally?: boolean }
export type Override = { id: string; mode: 'TEMPORARY' | 'EMERGENCY'; scope: string; reason: string; started_at: string; expires_at: string; ended_at?: string }
export type Policy = {
  policy_id: string; revision: number; device_id: string; level: 'OBSERVE'; issued_at: string; expires_at: string
  domains: { deny: string[]; allow_essential: string[] }
  apps: { discourage: string[]; terminate_only_if_safe: string[] }
  desktop: { open_apps: string[]; focus_url?: string }
  bike: { pre_strength_required: boolean; play_when_pedaling: boolean; viewing_eligible: boolean }
  override: { allowed: true; local_fallback_required: true }
  reason: string
}
export type Command = { command_id: string; device_id: string; policy_revision: number; status: 'PENDING' | 'APPLIED' | 'PARTIAL' | 'FAILED' | 'EXPIRED'; attempts: number; ack_at?: string; detail?: string; policy: Policy }
export type DailyReport = { local_date: string; progress: Progress; review: string; tweet_draft: string; closed_at: string; rest_day: boolean }
export type Control = {
  state: State; tags: Tag[]; bindings: Binding[]; devices: Device[]; sessions: Session[]; overrides: Override[]; commands: Command[]
  todayTasks: { id: string; title: string; completed_at?: string }[]
  tomorrowTop3: string[]; review: string; reports: DailyReport[]
  lastTouches: Record<string, string>
}
export type Result = { outcome: 'ACCEPTED' | 'REJECTED' | 'NO_CHANGE'; state_changed: boolean; state_revision: number; policy_status?: 'DISPATCH_PENDING' | 'NOT_CONFIGURED'; reason?: string; message: string; scan_id?: string; checkpoint?: Purpose; missing?: string[]; session_id?: string; tweet_draft?: string }
export function localDate(now: string): string { return new Date(Date.parse(now) + 9 * 3600_000).toISOString().slice(0, 10) }
export function emptyProgress(): Progress { return { morningDepartureWithin45m: null, focusSessionsCompleted: 0, researchActiveSecondsSinceBreak: 0, strengthSetsCompleted: 0, bikeActiveSeconds: 0, bathCompleted: false, croquisCompleted: false, tomorrowTop3Defined: false, dailyReviewCompleted: false } }
export function initialControl(now: string): Control {
  return { state: { location: 'UNKNOWN', locationEvidence: 'UNVERIFIED', routinePhase: 'SLEEPING', focusPhase: 'IDLE', overrideMode: 'NONE', progress: emptyProgress(), revision: 0, updatedAt: now, planDate: localDate(now), restDay: false }, tags: [], bindings: [], devices: [], sessions: [], overrides: [], commands: [], todayTasks: [], tomorrowTop3: ['', '', ''], review: '', reports: [], lastTouches: {} }
}
