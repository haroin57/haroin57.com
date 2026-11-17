import type { Env } from '../types.ts'
import { initialControl, purposes } from '../../becs/model.ts'
import type { Control, Purpose, Result, Source, Device, RoutinePhase } from '../../becs/model.ts'
import { accept, reject, checkpoint, heartbeat, completeSession, startSession, closeMissing, settleExpiries } from '../../becs/reducer.ts'
import { effectivePolicy, refreshCommands } from '../../becs/policy.ts'
import { load, commit } from './store.ts'
import { hash, equal, webAuth, sameOrigin, login } from './auth.ts'

type Body = Record<string, unknown>
class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
function string(body: Body, key: string, max = 200): string {
  const value = body[key]
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(422, `${key}を確認してください。`)
  return value.trim()
}
function uuid(body: Body, key: string): string {
  const value = string(body, key, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(422, `${key}にはUUIDを指定します。`)
  return value
}
function purpose(body: Body): Purpose {
  const value = string(body, 'purpose')
  if (!purposes.includes(value as Purpose)) throw new HttpError(422, '用途が不正です。')
  return value as Purpose
}
function object(value: unknown): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(422, 'JSONオブジェクトが必要です。')
  return value as Body
}
async function readBody(req: Request): Promise<Body> {
  if (!req.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'JSON形式で送信してください。')
  const reader = req.body?.getReader(); if (!reader) throw new HttpError(422, '本文が必要です。')
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16384) { await reader.cancel(); throw new HttpError(413, '本文が大きすぎます。') }; chunks.push(value) }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))) } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(422, 'JSONを確認してください。') }
}
function publicControl(control: Control) {
  return { ...control, devices: control.devices.map(device => ({ device_id: device.device_id, label: device.label, type: device.type, status: device.status, last_seen_at: device.last_seen_at })) }
}
function resultStatus(result: Result): number {
  if (result.outcome !== 'REJECTED') return 200
  if (result.reason === 'UNKNOWN_TAG') return 404
  if (result.reason === 'RETOUCH_LIMIT') return 429
  if (result.reason === 'INVALID_INPUT') return 422
  return 409
}
export async function handleBecs(req: Request, env: Env, now = new Date().toISOString()): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  try {
    const db = env.HABIT_DB.withSession('first-primary')
    const path = new URL(req.url).pathname.replace(/^\/api\/v1/, '')
    const mutation = req.method !== 'GET'
    if (req.method === 'OPTIONS') return reply({ error: '同一オリジンで利用してください。' }, 403)
    const body = mutation ? await readBody(req) : {}
    if (path === '/auth/session' && req.method === 'POST') {
      if (!sameOrigin(req, env)) return reply({ error: 'Originを確認してください。' }, 403)
      return login(req, env, db, now, body.secret)
    }
    const isWeb = await webAuth(req, db, now, mutation)
    const bearer = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
    let { control } = await load(db, now)
    let device: Device | undefined
    if (bearer) {
      const digest = await hash(bearer)
      for (const candidate of control.devices) if (candidate.status === 'ACTIVE' && await equal(digest, candidate.token_hash)) { device = candidate; break }
    }
    if (!isWeb && !device) return reply({ error: '本人または登録端末の認証が必要です。' }, 401)
    if (isWeb && mutation && !sameOrigin(req, env)) return reply({ error: 'Originを確認してください。' }, 403)
    if (bearer && req.headers.has('Origin')) return reply({ error: '端末APIはブラウザ認証では利用できません。' }, 403)
    const ownDevicePath = device && path === `/devices/${device.device_id}/policy`
    const allowedDevice = device && (
      (device.type === 'IPHONE' && (path === '/nfc/scans' || path === '/nfc/prepare') && req.method === 'POST') ||
      (device.type !== 'IPHONE' && ownDevicePath && req.method === 'GET') ||
      ((device.type === 'MAC' || device.type === 'DNS' || device.type === 'ESP32') && /^\/device-commands\/[^/]+\/ack$/.test(path) && req.method === 'POST') ||
      (device.type === 'ESP32' && path === `/devices/${device.device_id}/telemetry` && req.method === 'POST'))
    if (!isWeb && !allowedDevice) return reply({ error: '資格情報のスコープ外です。' }, 403)
    // Shortcuts can obtain a fresh envelope without relying on an optional UUID action.
    // Preparing a scan never accepts a checkpoint or changes the routine.
    if (path === '/nfc/prepare' && req.method === 'POST') {
      if (!device || device.type !== 'IPHONE' || body.device_id !== device.device_id) return reply({ error: '登録したiPhoneの資格情報とIDが必要です。' }, 403)
      const tagId = string(body, 'tag_id')
      const tag = control.tags.find(item => item.tag_id === tagId && item.status === 'ACTIVE')
      if (!tag || !control.bindings.some(item => item.tag_id === tagId && item.device_id === device.device_id && item.mode === 'IOS_SHORTCUTS' && !item.disabled_at)) return reply({ error: '有効なタグとShortcuts紐付けが必要です。' }, 403)
      const rate = await db.prepare('INSERT INTO becs_login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(`prepare:${device.device_id}:${now.slice(0,16)}`, new Date(Date.parse(now) + 120000).toISOString()).first<{ attempts: number }>()
      if (!rate || rate.attempts > 120) return reply({ error: '準備要求の回数を超えました。' }, 429)
      return reply({ scan_id: crypto.randomUUID(), tag_id: tagId, device_id: device.device_id, source: 'IOS_SHORTCUTS', occurred_at: now })
    }
    if (path === '/auth/session' && req.method === 'DELETE' && isWeb) {
      const raw = req.headers.get('Cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith('__Host-becs='))?.slice(12)
      if (raw) await db.prepare('DELETE FROM becs_web_sessions WHERE token_hash=?').bind(await hash(raw)).run()
      return Response.json({ message: 'ログアウトしました。' }, { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': '__Host-becs=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' } })
    }
    if (req.method === 'GET') {
      settleExpiries(control, now)
      if (path === '/state' && isWeb) return reply(publicControl(control))
      if (path === '/nfc/tags' && isWeb) return reply(control.tags)
      if (path.startsWith('/nfc/tags/') && isWeb) {
        const tag = control.tags.find(item => item.tag_id === path.split('/')[3]); return tag ? reply(tag) : reply({ error: 'タグが存在しません。' }, 404)
      }
      if (path === '/report/daily' && isWeb) {
        const events = await db.prepare('SELECT type,source,received_at,payload FROM behavior_events ORDER BY received_at DESC LIMIT 100').all()
        return reply({ reports: control.reports, recent_events: events.results })
      }
      if (ownDevicePath && device) {
        const commands = control.commands.filter(item => item.device_id === device.device_id && item.policy_revision === control.state.revision && item.status === 'PENDING' && item.policy.expires_at > now)
        const command = commands.at(-1)
        return reply(command ? { ...command, policy: { ...effectivePolicy(control, device.device_id, now, env.ALLOWED_ORIGIN ?? 'https://haroin57.com'), expires_at: command.policy.expires_at } } : { status: 'NO_PENDING_POLICY', message: '適用要求はありません。ローカルの期限切れ制限を解除してください。' })
      }
      return reply({ error: 'APIが存在しません。' }, 404)
    }
    const id = uuid(body, path === '/nfc/scans' ? 'scan_id' : path.endsWith('/telemetry') && body.event_id !== undefined ? 'event_id' : 'request_id')
    const actor = device?.device_id ?? 'owner'
    const fingerprint = await hash(JSON.stringify({ path, method: req.method, body }))
    let rateExceeded = false
    for (let attempt = 0; attempt < 8; attempt++) {
      const previous = await db.prepare('SELECT actor_id,fingerprint,response_json,http_status FROM nfc_scan_attempts WHERE scan_id=?').bind(id).first<{ actor_id: string; fingerprint: string; response_json: string; http_status: number }>()
      if (previous) {
        if (previous.actor_id !== actor || previous.fingerprint !== fingerprint) return reply({ error: '同じ操作IDを別の操作に再利用できません。' }, 409)
        return reply(JSON.parse(previous.response_json), previous.http_status)
      }
      if (attempt === 0) {
        const limit = await db.prepare('INSERT INTO becs_login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(`api:${actor}:${now.slice(0, 16)}`, new Date(Date.parse(now) + 120000).toISOString()).first<{ attempts: number }>()
        rateExceeded = !limit || limit.attempts > 120
      }
      const loaded = await load(db, now); control = loaded.control
      // Recheck revocation inside the optimistic transaction, not only before it.
      if (device && !control.devices.some(item => item.device_id === device.device_id && item.status === 'ACTIVE' && item.token_hash === device.token_hash)) return reply({ error: '端末資格情報は失効しています。' }, 401)
      settleExpiries(control, now)
      const previousControl = structuredClone(control)
      const before = control.state.revision
      const response = rateExceeded ? reject(control, 'RETOUCH_LIMIT', '操作回数を超えました。1分後に新しい操作として実行してください。') : await mutate(control, path, req.method, body, device, now)
      const status = 'outcome' in response ? resultStatus(response as Result) : 200
      if (control.state.revision !== before) refreshCommands(control, now, env.ALLOWED_ORIGIN ?? 'https://haroin57.com')
      if ('outcome' in response) response.policy_status = control.commands.some(item => item.policy_revision === control.state.revision && item.status === 'PENDING') ? 'DISPATCH_PENDING' : 'NOT_CONFIGURED'
      const source = path === '/nfc/scans' ? String(body.source) : 'MANUAL'
      // A generated device token is returned once and never persisted in audit/replay data.
      const storedResponse = 'token' in response ? { ...response, token: undefined, message: '作成済みです。資格情報は再発行してください。' } : response
      try {
        await commit(db, loaded.sequence, control, { id, actor, fingerprint, tag: typeof body.tag_id === 'string' ? body.tag_id : undefined, device: device?.device_id, source, occurred: typeof body.occurred_at === 'string' ? body.occurred_at : undefined, now, outcome: String(response.outcome ?? 'ACCEPTED'), body: storedResponse, status, event: path === '/nfc/scans' ? response.outcome === 'ACCEPTED' ? 'NFC_CHECKPOINT_ACCEPTED' : 'NFC_CHECKPOINT_REJECTED' : path }, previousControl)
        return reply(response, status)
      } catch (error) {
        if (attempt === 7 || !/UNIQUE|constraint/i.test(String(error))) throw error
      }
    }
    return reply({ error: '競合しました。同じ操作IDで再試行してください。' }, 503)
  } catch (error) {
    if (error instanceof HttpError) return reply({ error: error.message }, error.status)
    console.error(JSON.stringify({ component: 'becs', error: error instanceof Error ? error.name : 'unknown' }))
    return reply({ error: '処理を確認できません。同じ操作IDで再試行してください。' }, 503)
  }
}
async function mutate(c: Control, path: string, method: string, b: Body, device: Device | undefined, now: string): Promise<Body | Result> {
  const s = c.state
  if (path === '/nfc/scans' && method === 'POST') {
    const tagId = string(b, 'tag_id'); string(b, 'device_id'); const source = string(b, 'source') as Source
    const scanId = string(b, 'scan_id')
    const result = (r: Result) => ({ ...r, scan_id: scanId })
    if (!['IOS_SHORTCUTS', 'NDEF_WEB', 'NATIVE_APP'].includes(source)) throw new HttpError(422, 'sourceが不正です。')
    if (Object.keys(b).some(key => !['scan_id', 'tag_id', 'device_id', 'source', 'occurred_at'].includes(key))) throw new HttpError(422, 'スキャンに未定義の項目があります。')
    if (device && (b.device_id !== device.device_id || source !== 'IOS_SHORTCUTS')) throw new HttpError(403, '端末IDまたは送信元が一致しません。')
    if (!device && source !== 'NDEF_WEB') throw new HttpError(403, 'Web操作はNDEF_WEBで送信します。')
    const tag = c.tags.find(item => item.tag_id === tagId)
    if (!tag) return result(reject(c, 'UNKNOWN_TAG', 'タグが存在しません。'))
    if (tag.status !== 'ACTIVE') return result(reject(c, 'TAG_INACTIVE', 'タグは無効です。'))
    if (device && !c.bindings.some(item => item.tag_id === tagId && item.device_id === device.device_id && item.mode === source && !item.disabled_at)) return result(reject(c, 'BINDING_INACTIVE', '有効な端末紐付けがありません。'))
    const occurred = string(b, 'occurred_at', 40); if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(occurred)) throw new HttpError(422, 'occurred_atにはタイムゾーン付き日時を指定します。'); const age = Date.parse(now) - Date.parse(occurred)
    if (!Number.isFinite(age) || age < -30_000 || age > 120_000 || Date.parse(occurred) < Date.parse(s.updatedAt) - 2000) return result(reject(c, 'STALE_EVENT', '古い・時刻が不整合なタッチです。手動訂正を利用してください。'))
    const key = `${device?.device_id ?? 'owner'}:${tagId}`
    if (c.lastTouches[key] && Date.parse(now) - Date.parse(c.lastTouches[key]) < 2000) return result(reject(c, 'RETOUCH_LIMIT', '連続タッチです。2秒以上空けてください。'))
    const r = checkpoint(c, tag.purpose, source, now, tagId)
    if (r.outcome === 'ACCEPTED') { c.lastTouches[key] = now; tag.last_success_at = now; if (device) device.last_seen_at = now }
    return { ...result(r), tag_version: tag.version }
  }
  if (path === '/nfc/tags' && method === 'POST') {
    if (c.tags.length >= 100) throw new HttpError(422, 'タグ台帳は100件までです。')
    const tag = { tag_id: `nfc_${crypto.randomUUID()}`, purpose: purpose(b), label: string(b, 'label', 80), placement: string(b, 'placement', 120), status: 'DRAFT' as const, version: 1 }
    c.tags.push(tag); return { tag }
  }
  const tagMatch = path.match(/^\/nfc\/tags\/([^/]+)(?:\/(disable|replace))?$/)
  if (tagMatch) {
    const tag = c.tags.find(item => item.tag_id === tagMatch[1]); if (!tag) throw new HttpError(404, 'タグが存在しません。')
    if (tag.status === 'REPLACED') throw new HttpError(409, '交換済みのタグIDは再利用できません。')
    if (method === 'PATCH' && !tagMatch[2]) {
      if (b.label !== undefined) tag.label = string(b, 'label', 80)
      if (b.placement !== undefined) tag.placement = string(b, 'placement', 120)
      if (b.purpose !== undefined) tag.purpose = purpose(b)
      if (b.status !== undefined) { if (!['DRAFT', 'ACTIVE', 'DISABLED'].includes(String(b.status))) throw new HttpError(422, 'タグ状態が不正です。'); tag.status = b.status as 'DRAFT' | 'ACTIVE' | 'DISABLED' }
      tag.version++; return { tag }
    }
    if (method === 'POST' && (tagMatch[2] === 'disable' || tagMatch[2] === 'replace')) {
      tag.status = tagMatch[2] === 'replace' ? 'REPLACED' : 'DISABLED'; tag.version++
      for (const binding of c.bindings.filter(item => item.tag_id === tag.tag_id && !item.disabled_at)) binding.disabled_at = now
      if (tagMatch[2] === 'replace') {
        const replacement = { ...tag, tag_id: `nfc_${crypto.randomUUID()}`, status: 'DRAFT' as const, version: 1, last_success_at: undefined }
        tag.replaced_by = replacement.tag_id; c.tags.push(replacement); return { tag, replacement }
      }
      return { tag }
    }
  }
  if (path === '/devices' && method === 'POST') {
    if (c.devices.length >= 30) throw new HttpError(422, '端末は30件までです。')
    const type = string(b, 'type') as Device['type']; if (!['IPHONE', 'MAC', 'ESP32', 'DNS'].includes(type)) throw new HttpError(422, '端末種別が不正です。')
    const token = crypto.randomUUID() + crypto.randomUUID()
    const item: Device = { device_id: crypto.randomUUID(), label: string(b, 'label', 80), type, token_hash: await hash(token), status: 'ACTIVE' }
    c.devices.push(item); accept(c, now, '端末を登録しました。')
    return { device: { ...item, token_hash: undefined }, token }
  }
  const deviceMatch = path.match(/^\/devices\/([^/]+)\/(revoke|rotate)$/)
  if (deviceMatch && method === 'POST') {
    const item = c.devices.find(item => item.device_id === deviceMatch[1]); if (!item) throw new HttpError(404, '端末が存在しません。')
    if (deviceMatch[2] === 'rotate') { const token = crypto.randomUUID() + crypto.randomUUID(); item.token_hash = await hash(token); item.status = 'ACTIVE'; return { token, device_id: item.device_id } }
    item.status = 'REVOKED'
    for (const binding of c.bindings.filter(item => item.device_id === deviceMatch[1] && !item.disabled_at)) binding.disabled_at = now
    return accept(c, now, '端末と紐付けを失効しました。')
  }
  if (path === '/nfc/bindings' && method === 'POST') {
    const tagId = string(b, 'tag_id'); const deviceId = string(b, 'device_id'); const mode = string(b, 'mode')
    if (!c.tags.some(item => item.tag_id === tagId && item.status === 'ACTIVE') || !c.devices.some(item => item.device_id === deviceId && item.status === 'ACTIVE' && item.type === 'IPHONE')) throw new HttpError(422, '有効なタグとiPhoneを指定してください。')
    if (!['IOS_SHORTCUTS', 'NDEF_WEB', 'NATIVE_APP'].includes(mode)) throw new HttpError(422, '方式が不正です。')
    if (c.bindings.some(item => item.tag_id === tagId && item.device_id === deviceId && item.mode === mode && !item.disabled_at)) throw new HttpError(409, '既に紐付け済みです。')
    if (c.bindings.length >= 300) throw new HttpError(422, '紐付けは300件までです。')
    const binding = { binding_id: crypto.randomUUID(), tag_id: tagId, device_id: deviceId, mode: mode as Exclude<Source, 'MANUAL'>, registered_at: now }
    c.bindings.push(binding); return { binding }
  }
  if (path.startsWith('/nfc/bindings/') && method === 'DELETE') {
    const item = c.bindings.find(item => item.binding_id === path.split('/')[3]); if (!item) throw new HttpError(404, '紐付けが存在しません。')
    item.disabled_at = now; return { message: '紐付けを停止しました。' }
  }
  if (path === '/routine/confirm' && method === 'POST') {
    const reason = string(b, 'reason', 200)
    if (b.rest_day === true) {
      s.restDay = true
      if (s.routinePhase === 'EVENING_STRENGTH') s.routinePhase = 'EVENING_WRAPUP'
      return accept(c, now, `休養を申告しました。${reason}`)
    }
    if (b.correct_phase !== undefined) {
      const phase = string(b, 'correct_phase') as RoutinePhase
      if (!['SLEEPING', 'MORNING', 'TRANSIT', 'RESEARCH', 'EVENING_STRENGTH', 'EVENING_WRAPUP'].includes(phase)) throw new HttpError(422, '訂正フェーズが不正です。')
      for (const session of c.sessions.filter(item => item.status === 'ACTIVE')) { session.status = 'INTERRUPTED'; session.ended_at = now }
      s.routinePhase = phase; s.focusPhase = 'IDLE'; s.locationEvidence = 'MANUAL'; delete s.rewardExpiresAt
      s.location = phase === 'RESEARCH' ? 'LAB' : phase === 'TRANSIT' ? 'TRANSIT' : 'HOME'
      if (phase === 'MORNING') s.wakeAt = now
      return accept(c, now, `手動訂正を記録しました。${reason}`)
    }
    return checkpoint(c, purpose(b), 'MANUAL', now)
  }
  if (path === '/sessions' && method === 'POST') {
    const kind = string(b, 'kind')
    if (kind === 'FOCUS') return checkpoint(c, 'NFC_FOCUS_START', 'MANUAL', now)
    if (kind === 'BIKE') return checkpoint(c, 'NFC_BIKE_START', 'MANUAL', now)
    if (kind !== 'BREAK' || s.routinePhase !== 'RESEARCH' || s.focusPhase !== 'IDLE' || c.sessions.some(item => item.status === 'ACTIVE')) return reject(c, 'INVALID_TRANSITION', '研究フェーズで集中の終了後に休憩できます。')
    const session = startSession(c, 'BREAK', now); s.focusPhase = 'BREAK_10'; return { ...accept(c, now, '休憩を開始しました。娯楽解放権とは別です。'), session_id: session.id }
  }
  const sessionMatch = path.match(/^\/sessions\/([^/]+)\/(complete|heartbeat)$/)
  if (sessionMatch && method === 'POST') {
    const session = c.sessions.find(item => item.id === sessionMatch[1]); if (!session) throw new HttpError(404, 'セッションが存在しません。')
    return sessionMatch[2] === 'heartbeat' ? heartbeat(c, session, now) : completeSession(c, session, now, b.interrupted === true)
  }
  const taskMatch = path.match(/^\/tasks\/([^/]+)\/complete$/)
  if (taskMatch && method === 'POST') {
    const task = c.todayTasks.find(item => item.id === taskMatch[1]); if (!task) throw new HttpError(404, '当日のタスクが存在しません。')
    if (task.completed_at) return reject(c, 'ALREADY_RECORDED', '既に完了済みです。')
    task.completed_at = now; return accept(c, now, 'タスク完了を申告しました。')
  }
  if (path === '/privacy/history' && method === 'DELETE') {
    if (b.confirm !== 'DELETE_PRIVATE_HISTORY') throw new HttpError(422, '削除の確認が必要です。')
    const fresh = initialControl(now)
    fresh.state.revision = s.revision
    c.state = fresh.state; c.todayTasks = []; c.sessions = []; c.overrides = []; c.commands = []; c.reports = []; c.lastTouches = {}; c.tomorrowTop3 = ['', '', '']; c.review = ''
    for (const tag of c.tags) delete tag.last_success_at
    for (const device of c.devices) delete device.last_seen_at
    return accept(c, now, 'BECSの非公開行動履歴と自由記述を削除しました。既存の公開Habitログは別データです。')
  }
  if (path === '/daily-close' && method === 'POST') {
    if (s.routinePhase !== 'EVENING_WRAPUP') return reject(c, 'INVALID_TRANSITION', '夜の振り返りフェーズで確定します。')
    if (!Array.isArray(b.tomorrow_top3) || b.tomorrow_top3.length !== 3 || b.tomorrow_top3.some(item => typeof item !== 'string' || !item.trim() || item.length > 200)) throw new HttpError(422, '翌日のTo-Do3枠を入力してください。')
    const proposal = structuredClone(c)
    proposal.state.progress.tomorrowTop3Defined = true; proposal.state.progress.dailyReviewCompleted = true
    const missing = closeMissing(proposal); if (missing.length) return reject(c, 'MISSING_REQUIREMENTS', '日次クローズの条件が不足しています。', missing)
    c.tomorrowTop3 = b.tomorrow_top3.map(item => String(item).trim()); c.review = string(b, 'review', 1000)
    s.progress.tomorrowTop3Defined = true; s.progress.dailyReviewCompleted = true
    const draft = `${s.planDate} 集中${s.progress.focusSessionsCompleted}回 / 筋トレ${s.progress.strengthSetsCompleted}セット / バイク${Math.floor(s.progress.bikeActiveSeconds / 60)}分${s.restDay ? ' / 休養日' : ''}`
    c.reports.push({ local_date: s.planDate, progress: { ...s.progress }, review: c.review, tweet_draft: draft, closed_at: now, rest_day: s.restDay }); s.routinePhase = 'COMPLETED'
    return { ...accept(c, now, '日次クローズしました。投稿は本人の確認後に行ってください。'), tweet_draft: draft }
  }
  if (path === '/overrides' && method === 'POST') {
    const mode = string(b, 'mode'); if (!['TEMPORARY', 'EMERGENCY'].includes(mode)) throw new HttpError(422, '解除モードが不正です。')
    const minutes = mode === 'EMERGENCY' ? 60 : Number(b.minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw new HttpError(422, '一時解除は1〜120分です。')
    c.overrides.push({ id: crypto.randomUUID(), mode: mode as 'TEMPORARY' | 'EMERGENCY', scope: 'habit-restrictions', reason: mode === 'EMERGENCY' ? '緊急解除' : string(b, 'reason', 200), started_at: now, expires_at: new Date(Date.parse(now) + minutes * 60_000).toISOString() }); settleExpiries(c, now)
    return accept(c, now, '解除を受理しました。端末反映はACKを確認してください。通信断時はローカル解除を利用します。')
  }
  if (path.startsWith('/overrides/') && method === 'DELETE') {
    const item = c.overrides.find(item => item.id === path.split('/')[2]); if (!item) throw new HttpError(404, '解除が存在しません。')
    item.ended_at = now; settleExpiries(c, now); return accept(c, now, '解除を終了しました。')
  }
  const ackMatch = path.match(/^\/device-commands\/([^/]+)\/ack$/)
  if (ackMatch && method === 'POST' && device) {
    const command = c.commands.find(item => item.command_id === ackMatch[1] && item.device_id === device.device_id)
    if (!command) throw new HttpError(404, 'コマンドが存在しません。')
    if (command.policy_revision !== s.revision || command.policy.expires_at <= now || command.status !== 'PENDING') return reject(c, 'STALE_POLICY', '古い・期限切れ・処理済みのコマンドです。')
    if (!['APPLIED', 'PARTIAL', 'FAILED'].includes(String(b.status))) throw new HttpError(422, 'ACK状態が不正です。')
    command.status = b.status as 'APPLIED' | 'PARTIAL' | 'FAILED'; command.ack_at = now; command.attempts++; command.detail = string(b, 'detail', 300); device.last_seen_at = now
    return { message: '適用結果を記録しました。', command }
  }
  if (device?.type === 'ESP32' && path === `/devices/${device.device_id}/telemetry` && method === 'POST') {
    const session = c.sessions.find(item => item.kind === 'BIKE' && item.status === 'ACTIVE'); if (!session) return reject(c, 'SESSION_INACTIVE', '実行中のバイクセッションがありません。')
    const localState = string(b, 'local_state')
    if (!['IDLE', 'READY', 'PEDALING', 'WARNING', 'PAUSED', 'ENDED', 'FAULT'].includes(localState) || typeof b.playback_allowed_locally !== 'boolean') throw new HttpError(422, 'ローカル状態を確認してください。')
    const rpm = Number(b.rpm); const active = Number(b.active_seconds); const occurred = string(b, 'occurred_at', 40)
    const age = Date.parse(now) - Date.parse(occurred)
    const elapsed = (Date.parse(now) - Date.parse(session.started_at)) / 1000
    if (!Number.isFinite(age) || age < -30_000 || age > 30_000 || !Number.isFinite(rpm) || rpm < 0 || rpm > 300 || !Number.isInteger(active) || active < session.active_seconds || active > elapsed || (session.device_id && session.device_id !== device.device_id)) return reject(c, 'INVALID_INPUT', '実測値または時刻が不正です。')
    if (session.last_telemetry_at && occurred <= session.last_telemetry_at) return reject(c, 'STALE_EVENT', '過去のテレメトリーです。')
    session.active_seconds = active; session.device_id = device.device_id; session.rpm = rpm; session.last_telemetry_at = occurred; session.local_state = localState; session.playback_allowed_locally = b.playback_allowed_locally; device.last_seen_at = now
    return accept(c, now, '実測値を受信しました。停止判定はESP32で継続します。')
  }
  throw new HttpError(404, 'APIまたはメソッドが存在しません。')
}
