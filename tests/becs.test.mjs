import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { handleBecs } from '../src/workers/becs/api.ts'
import { initialControl } from '../src/becs/model.ts'
import { checkpoint, heartbeat, completeSession, startSession } from '../src/becs/reducer.ts'
import { effectivePolicy } from '../src/becs/policy.ts'
import { cleanup } from '../src/workers/becs/store.ts'

const start = '2026-11-17T00:00:00.000Z'
function setup() {
  const sql = new DatabaseSync(':memory:')
  sql.exec(readFileSync(new URL('../migrations/0004_becs.sql', import.meta.url), 'utf8'))
  function prepared(query, args = []) {
    return { bind(...values) { return prepared(query, values) }, async first() { return sql.prepare(query).get(...args) ?? null }, async all() { return { results: sql.prepare(query).all(...args) } }, async run() { return sql.prepare(query).run(...args) } }
  }
  const db = { prepare: prepared, withSession() { return db }, async batch(statements) { sql.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.all()); sql.exec('COMMIT'); return result } catch (error) { sql.exec('ROLLBACK'); throw error } } }
  const env = { HABIT_DB: db, BECS_ADMIN_SECRET: 'owner-test-secret', ALLOWED_ORIGIN: 'https://example.com' }
  let cookie, csrf
  async function call(path, body, options = {}) {
    const method = options.method ?? (body === undefined ? 'GET' : 'POST')
    const requestBody = body === undefined ? undefined : { request_id: crypto.randomUUID(), ...body }
    if (path === '/nfc/scans') delete requestBody.request_id
    const req = new Request(`https://example.com/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : { Origin: 'https://example.com', Cookie: cookie ?? '', 'X-BECS-CSRF': csrf ?? '' }), ...options.headers }, body: requestBody === undefined ? undefined : JSON.stringify(requestBody) })
    const response = await handleBecs(req, env, options.now ?? start)
    const data = await response.json()
    if (path === '/auth/session' && response.ok) { cookie = response.headers.get('Set-Cookie').split(';')[0]; csrf = data.csrf }
    return { status: response.status, data, response }
  }
  async function login() { assert.equal((await call('/auth/session', { secret: 'owner-test-secret' })).status, 200) }
  async function tag(purpose) {
    const { data: { tag } } = await call('/nfc/tags', { purpose, label: purpose, placement: 'test' })
    assert.equal((await call(`/nfc/tags/${tag.tag_id}`, { status: 'ACTIVE' }, { method: 'PATCH' })).status, 200)
    return tag
  }
  async function device(type = 'IPHONE') { return (await call('/devices', { type, label: 'test device' })).data }
  return { sql, db, env, call, login, tag, device }
}
const nfc = (tag_id, patch = {}) => ({ scan_id: crypto.randomUUID(), tag_id, device_id: 'web-owner', source: 'NDEF_WEB', occurred_at: start, ...patch })

test('auth fails closed, CSRF and exact Origin required; login attempts bounded', async () => {
  const f = setup()
  assert.equal((await f.call('/state')).status, 401)
  assert.equal((await f.call('/auth/session', { secret: 'owner-test-secret' }, { headers: { Origin: 'https://evil.com' } })).status, 403)
  await f.login()
  assert.equal((await f.call('/state')).status, 200)
  assert.equal((await f.call('/nfc/tags', { purpose: 'NFC_WAKE', label: 'a', placement: 'b' }, { headers: { 'X-BECS-CSRF': 'bad' } })).status, 401)
  assert.equal((await f.call('/nfc/tags', {}, { headers: { Origin: 'https://evil.com' } })).status, 403)
  for (let i = 0; i < 4; i++) assert.equal((await f.call('/auth/session', { secret: 'bad' })).status, 401)
  assert.equal((await f.call('/auth/session', { secret: 'bad' })).status, 429)
  assert.equal((await f.call('/state', undefined, { now: '2026-11-17T02:00:00.000Z' })).status, 401)
})
test('NFC wake replay 100 times returns original result; mismatched ID cannot be reused', async () => {
  const f = setup(); await f.login(); const tag = await f.tag('NFC_WAKE'); const scan = nfc(tag.tag_id)
  const original = await f.call('/nfc/scans', scan)
  assert.equal(original.status, 200); assert.equal(original.data.state_revision, 1)
  for (let i = 0; i < 100; i++) assert.deepEqual((await f.call('/nfc/scans', scan)).data, original.data)
  assert.equal((await f.call('/state')).data.state.revision, 1)
  assert.equal((await f.call('/nfc/scans', { ...scan, tag_id: 'another' })).status, 409)
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM nfc_scan_attempts WHERE scan_id=?').get(scan.scan_id).n, 1)
})
test('tag GET has no side effects; purpose is authoritative; stale and disabled tags rejected', async () => {
  const f = setup(); await f.login(); const tag = await f.tag('NFC_WAKE')
  const count = f.sql.prepare('SELECT COUNT(*) AS n FROM becs_snapshots').get().n
  await f.call(`/nfc/tags/${tag.tag_id}`)
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM becs_snapshots').get().n, count)
  assert.equal((await f.call('/nfc/scans', nfc(tag.tag_id, { action: 'UNLOCK_ALL' }))).status, 422)
  assert.equal((await f.call('/nfc/scans', nfc(tag.tag_id, { occurred_at: '2026-11-16T00:00:00.000Z' }))).data.reason, 'STALE_EVENT')
  await f.call(`/nfc/tags/${tag.tag_id}/disable`, {})
  assert.equal((await f.call('/nfc/scans', nfc(tag.tag_id))).data.reason, 'TAG_INACTIVE')
  assert.equal((await f.call('/state')).data.state.revision, 0)
})
test('morning to lab requests PC policy, rejects premature return, never marks ACK early', async () => {
  const f = setup(); await f.login(); const mac = await f.device('MAC')
  const wrong = await f.tag('NFC_HOME_RETURN')
  assert.equal((await f.call('/nfc/scans', nfc(wrong.tag_id))).data.reason, 'INVALID_TRANSITION')
  for (const [p, time] of [['NFC_WAKE', start], ['NFC_DEPARTURE', '2026-11-17T00:40:00.000Z'], ['NFC_LAB_ARRIVAL', '2026-11-17T00:50:00.000Z']]) {
    const tag = await f.tag(p); const result = await f.call('/nfc/scans', nfc(tag.tag_id, { occurred_at: time }), { now: time }); assert.equal(result.status, 200)
  }
  const { data } = await f.call('/state', undefined, { now: '2026-11-17T00:50:00.000Z' })
  assert.equal(data.state.routinePhase, 'RESEARCH'); assert.equal(data.state.progress.morningDepartureWithin45m, true)
  assert.equal(data.commands.at(-1).status, 'PENDING')
  const policy = await f.call(`/devices/${mac.device.device_id}/policy`, undefined, { token: mac.token, now: '2026-11-17T00:50:00.000Z' })
  assert.equal(policy.data.policy.level, 'OBSERVE'); assert.ok(policy.data.policy.desktop.focus_url.endsWith('/focus'))
  assert.ok(!JSON.stringify(data).includes(mac.token)); assert.ok(!JSON.stringify(data).includes('token_hash'))
})
test('scoped iPhone cannot administer tags; binding required; rotation and revocation enforced', async () => {
  const f = setup(); await f.login(); const tag = await f.tag('NFC_WAKE'); const phone = await f.device()
  const scan = nfc(tag.tag_id, { device_id: phone.device.device_id, source: 'IOS_SHORTCUTS' })
  assert.equal((await f.call('/nfc/tags', {}, { token: phone.token })).status, 403)
  assert.equal((await f.call('/nfc/scans', scan, { token: phone.token })).data.reason, 'BINDING_INACTIVE')
  await f.call('/nfc/bindings', { tag_id: tag.tag_id, device_id: phone.device.device_id, mode: 'IOS_SHORTCUTS' })
  assert.equal((await f.call('/nfc/scans', { ...scan, scan_id: crypto.randomUUID(), device_id: 'wrong' }, { token: phone.token })).status, 403)
  assert.equal((await f.call('/nfc/scans', { ...scan, scan_id: crypto.randomUUID() }, { token: phone.token })).status, 200)
  const rotated = await f.call(`/devices/${phone.device.device_id}/rotate`, {})
  assert.ok(!JSON.stringify(f.sql.prepare('SELECT document_json FROM becs_snapshots ORDER BY sequence DESC LIMIT 1').get()).includes(rotated.data.token))
  assert.equal((await f.call('/nfc/scans', { ...scan, scan_id: crypto.randomUUID() }, { token: phone.token })).status, 401)
  await f.call(`/devices/${phone.device.device_id}/revoke`, {})
  assert.equal((await f.call('/nfc/scans', { ...scan, scan_id: crypto.randomUUID() }, { token: rotated.data.token })).status, 401)
})
test('replacement preserves history, disables old binding and issues a new draft ID', async () => {
  const f = setup(); await f.login(); const tag = await f.tag('NFC_WAKE'); const scan = nfc(tag.tag_id)
  await f.call('/nfc/scans', scan)
  const replaced = await f.call(`/nfc/tags/${tag.tag_id}/replace`, {})
  assert.notEqual(replaced.data.replacement.tag_id, tag.tag_id); assert.equal(replaced.data.replacement.status, 'DRAFT')
  assert.equal((await f.call('/nfc/scans', nfc(tag.tag_id))).data.reason, 'TAG_INACTIVE')
  assert.equal((await f.call(`/nfc/tags/${tag.tag_id}`, { status: 'ACTIVE' }, { method: 'PATCH' })).status, 409)
  assert.equal(f.sql.prepare('SELECT outcome FROM nfc_scan_attempts WHERE scan_id=?').get(scan.scan_id).outcome, 'ACCEPTED')
})
test('atomic D1 rollback cannot leave a state change without its receipt', async () => {
  const f = setup(); await f.login(); const tag = await f.tag('NFC_WAKE')
  const count = f.sql.prepare('SELECT COUNT(*) AS n FROM becs_snapshots').get().n
  f.sql.exec("CREATE TRIGGER failure BEFORE INSERT ON behavior_events BEGIN SELECT RAISE(ABORT,'test failure'); END")
  assert.equal((await f.call('/nfc/scans', nfc(tag.tag_id))).status, 503)
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM becs_snapshots').get().n, count)
  assert.equal((await f.call('/state')).data.state.revision, 0)
})
test('strength sets distinguish bounce, retries, legitimate repeats, upper bound and bike eligibility', async () => {
  const f = setup(); await f.login()
  await f.call('/routine/confirm', { correct_phase: 'EVENING_STRENGTH', reason: 'manual test correction' })
  const strength = await f.tag('NFC_STRENGTH_SET'); const bike = await f.tag('NFC_BIKE_START')
  assert.equal((await f.call('/nfc/scans', nfc(bike.tag_id))).data.reason, 'STRENGTH_REQUIRED')
  const scan = nfc(strength.tag_id); const original = await f.call('/nfc/scans', scan)
  assert.equal(original.status, 200); assert.deepEqual((await f.call('/nfc/scans', scan)).data, original.data)
  assert.equal((await f.call('/nfc/scans', nfc(strength.tag_id))).data.reason, 'RETOUCH_LIMIT')
  for (const sec of [3, 6]) {
    const now = `2026-11-17T00:00:0${sec}.000Z`
    assert.equal((await f.call('/nfc/scans', nfc(strength.tag_id, { occurred_at: now }), { now })).status, 200)
  }
  const now = '2026-11-17T00:00:09.000Z'
  assert.equal((await f.call('/nfc/scans', nfc(strength.tag_id, { occurred_at: now }), { now })).status, 409)
  assert.equal((await f.call('/nfc/scans', nfc(bike.tag_id, { occurred_at: now }), { now })).status, 200)
  assert.equal((await f.call('/state')).data.state.progress.strengthSetsCompleted, 3)
})
test('focus requires continuous timed heartbeats, rejects retap and incomplete completion, rewards once', () => {
  const c = initialControl(start); c.state.routinePhase = 'RESEARCH'
  assert.equal(checkpoint(c, 'NFC_FOCUS_START', 'MANUAL', start).outcome, 'ACCEPTED')
  assert.equal(checkpoint(c, 'NFC_FOCUS_START', 'MANUAL', start).outcome, 'REJECTED')
  const session = c.sessions[0]
  assert.equal(completeSession(c, session, start, false).reason, 'MEASUREMENT_REQUIRED')
  assert.equal(c.state.rewardExpiresAt, undefined)
  for (let seconds = 10; seconds <= 1500; seconds += 10) heartbeat(c, session, new Date(Date.parse(start) + seconds * 1000).toISOString())
  const now = new Date(Date.parse(start) + 1500_000).toISOString()
  assert.equal(completeSession(c, session, now, false).outcome, 'ACCEPTED')
  assert.equal(Date.parse(c.state.rewardExpiresAt) - Date.parse(now), 900_000)
  assert.equal(completeSession(c, session, now, false).outcome, 'REJECTED')
  assert.equal(c.state.progress.focusSessionsCompleted, 1)
})
test('timer interruption gives no reward; break leaves routine RESEARCH; overnight belongs to starting plan', () => {
  const c = initialControl(start); c.state.routinePhase = 'RESEARCH'
  const first = startSession(c, 'FOCUS', start)
  heartbeat(c, first, '2026-11-17T00:01:00.000Z')
  assert.equal(first.status, 'INTERRUPTED'); assert.equal(c.state.rewardExpiresAt, undefined)
  c.state.progress.researchActiveSecondsSinceBreak = 5400
  const rest = startSession(c, 'BREAK', start)
  assert.equal(completeSession(c, rest, '2026-11-17T00:10:00.000Z', false).outcome, 'ACCEPTED')
  assert.equal(c.state.routinePhase, 'RESEARCH'); assert.equal(c.state.progress.researchActiveSecondsSinceBreak, 0)
  const overnight = startSession(c, 'FOCUS', '2026-11-17T14:50:00.000Z'); overnight.active_seconds = 1500; overnight.last_heartbeat_at = '2026-11-17T15:15:00.000Z'
  completeSession(c, overnight, '2026-11-17T15:15:00.000Z', false)
  assert.equal(overnight.plan_date, '2026-11-17'); assert.equal(c.state.rewardExpiresAt, undefined)
})
test('daily close revalidates prerequisites; rest is explicit; draft never auto-publishes', async () => {
  const f = setup(); await f.login()
  await f.call('/routine/confirm', { correct_phase: 'EVENING_WRAPUP', reason: 'manual correction' })
  const close = { tomorrow_top3: ['a', 'b', 'c'], review: 'private review' }
  const failed = await f.call('/daily-close', close)
  assert.equal(failed.status, 409); assert.ok(failed.data.missing.includes('バイク実測24分'))
  assert.equal((await f.call('/state')).data.state.progress.dailyReviewCompleted, false)
  await f.call('/routine/confirm', { rest_day: true, reason: 'rest' })
  await f.call('/routine/confirm', { purpose: 'NFC_BATH_DONE', reason: 'manual' })
  const result = await f.call('/daily-close', close)
  assert.equal(result.status, 200); assert.ok(result.data.tweet_draft.includes('休養日'))
  const state = (await f.call('/state')).data
  assert.equal(state.state.routinePhase, 'COMPLETED'); assert.equal(state.reports[0].review, 'private review')
})
test('emergency override needs no tag or achievement; policy remains reversible and OBSERVE', async () => {
  const f = setup(); await f.login()
  assert.equal((await f.call('/overrides', { mode: 'EMERGENCY' })).status, 200)
  const { data } = await f.call('/state'); assert.equal(data.state.overrideMode, 'EMERGENCY')
  const policy = effectivePolicy(data, 'mac', start, 'https://example.com')
  assert.equal(policy.override.local_fallback_required, true); assert.deepEqual(policy.domains.deny, []); assert.deepEqual(policy.apps.terminate_only_if_safe, [])
})
test('retention removes expired scan data and sessions while retaining current snapshot', async () => {
  const f = setup(); await f.login(); const tag = await f.tag('NFC_WAKE'); await f.call('/nfc/scans', nfc(tag.tag_id))
  await cleanup(f.db, '2027-05-17T00:00:00.000Z')
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM nfc_scan_attempts').get().n, 0)
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM behavior_events').get().n, 0)
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM becs_snapshots').get().n, 1)
})

test('ACK is device-specific, not accepted before matching a live revision; lease never slides on GET', async () => {
  const f = setup(); await f.login(); const mac = await f.device('MAC'); const other = await f.device('MAC')
  const now = '2026-11-17T00:00:01.000Z'
  const { data: command } = await f.call(`/devices/${mac.device.device_id}/policy`, undefined, { token: mac.token, now })
  assert.equal(command.policy.expires_at, '2026-11-17T00:02:00.000Z')
  assert.equal((await f.call(`/device-commands/${command.command_id}/ack`, { status: 'APPLIED', detail: 'OBSERVE applied' }, { token: other.token, now })).status, 404)
  assert.equal((await f.call(`/device-commands/${command.command_id}/ack`, { status: 'APPLIED', detail: 'OBSERVE applied' }, { token: mac.token, now })).status, 200)
  assert.equal((await f.call('/state')).data.commands.find(item => item.command_id === command.command_id).status, 'APPLIED')
})
test('privacy deletion removes private free text from every snapshot, receipt, report and projection', async () => {
  const f = setup(); await f.login()
  await f.call('/routine/confirm', { correct_phase: 'EVENING_WRAPUP', reason: 'private-secret-value' })
  await f.call('/routine/confirm', { rest_day: true, reason: 'rest' })
  await f.call('/routine/confirm', { purpose: 'NFC_BATH_DONE', reason: 'manual' })
  await f.call('/daily-close', { review: 'private-secret-value', tomorrow_top3: ['private-secret-value', 'b', 'c'] })
  assert.equal((await f.call('/privacy/history', { confirm: 'DELETE_PRIVATE_HISTORY' }, { method: 'DELETE' })).status, 200)
  for (const table of ['becs_snapshots', 'nfc_scan_attempts', 'behavior_events', 'daily_plans', 'routine_sessions']) {
    assert.ok(!JSON.stringify(f.sql.prepare(`SELECT * FROM ${table}`).all()).includes('private-secret-value'))
  }
  assert.equal((await f.call('/state')).data.reports.length, 0)
})
test('scheduler interrupts stale timer, expires override, renews short policy independently of requests', async () => {
  const { maintainBecs } = await import('../src/workers/becs/scheduler.ts')
  const f = setup(); await f.login(); await f.device('MAC')
  await f.call('/routine/confirm', { correct_phase: 'RESEARCH', reason: 'test' })
  await f.call('/sessions', { kind: 'FOCUS' })
  await f.call('/overrides', { mode: 'TEMPORARY', minutes: 1, reason: 'test' })
  await maintainBecs(f.env, '2026-11-17T00:01:01.000Z')
  const state = (await f.call('/state', undefined, { now: '2026-11-17T00:01:01.000Z' })).data
  assert.equal(state.state.overrideMode, 'NONE'); assert.equal(state.sessions[0].status, 'INTERRUPTED')
  assert.equal(state.commands.at(-1).status, 'PENDING')
})
test('simultaneous unique manual actions serialize; replays never double-apply', async () => {
  const f = setup(); await f.login()
  await f.call('/routine/confirm', { correct_phase: 'EVENING_STRENGTH', reason: 'test' })
  const results = await Promise.all(Array.from({ length: 3 }, () => f.call('/routine/confirm', { purpose: 'NFC_STRENGTH_SET', reason: 'test' })))
  assert.ok(results.every(result => result.status === 200))
  assert.equal((await f.call('/state')).data.state.progress.strengthSetsCompleted, 3)
})
test('ESP32-only bike telemetry is bounded by elapsed session time; Web cannot fabricate RPM', async () => {
  const f = setup(); await f.login(); const esp = await f.device('ESP32')
  await f.call('/routine/confirm', { correct_phase: 'EVENING_STRENGTH', reason: 'test' })
  for (let i = 0; i < 3; i++) await f.call('/routine/confirm', { purpose: 'NFC_STRENGTH_SET', reason: 'test' })
  await f.call('/sessions', { kind: 'BIKE' })
  const path = `/devices/${esp.device.device_id}/telemetry`
  const body = { local_state: 'PEDALING', playback_allowed_locally: true, rpm: 55, active_seconds: 20, occurred_at: '2026-11-17T00:00:30.000Z' }
  const options = { token: esp.token, now: body.occurred_at }
  assert.equal((await f.call(path, body, { now: body.occurred_at })).status, 404)
  assert.equal((await f.call(path, { ...body, active_seconds: 1000 }, options)).status, 422)
  assert.equal((await f.call(path, body, options)).status, 200)
  assert.equal((await f.call(path, body, options)).status, 409)
  const session = (await f.call('/state', undefined, { now: body.occurred_at })).data.sessions.at(-1)
  await f.call(`/sessions/${session.id}/complete`, {}, { now: body.occurred_at })
  assert.equal((await f.call('/state')).data.state.progress.bikeActiveSeconds, 20)
})

test('compacted snapshots cannot reopen an old sequence to a stale writer', async () => {
  const f = setup(); await f.login()
  for (const purpose of ['NFC_WAKE', 'NFC_DEPARTURE', 'NFC_LAB_ARRIVAL']) await f.tag(purpose)
  const max = f.sql.prepare('SELECT MAX(sequence) AS n FROM becs_snapshots').get().n
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM becs_snapshots').get().n, 1)
  assert.throws(() => f.sql.prepare('INSERT INTO becs_snapshots VALUES(?,?,?,?)').run(max - 1, 0, '{}', start), /BECS_SEQUENCE_CONSTRAINT/)
})

test('virtual NFC day runs wake → research → measured focus → three sets → measured bike → close → sleep', async () => {
  const f = setup(); await f.login()
  const tags = {}
  for (const purpose of ['NFC_WAKE', 'NFC_DEPARTURE', 'NFC_LAB_ARRIVAL', 'NFC_FOCUS_START', 'NFC_HOME_RETURN', 'NFC_STRENGTH_SET', 'NFC_BIKE_START', 'NFC_BATH_DONE', 'NFC_CROQUIS_DONE', 'NFC_SLEEP']) tags[purpose] = (await f.tag(purpose)).tag_id
  const esp = await f.device('ESP32')
  const time = seconds => new Date(Date.parse(start) + seconds * 1000).toISOString()
  async function scan(purpose, seconds) {
    const now = time(seconds)
    const result = await f.call('/nfc/scans', nfc(tags[purpose], { occurred_at: now }), { now })
    assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data
  }
  await scan('NFC_WAKE', 0); await scan('NFC_DEPARTURE', 60); await scan('NFC_LAB_ARRIVAL', 120)
  const focus = await scan('NFC_FOCUS_START', 121)
  for (let i = 10; i <= 1500; i += 10) {
    assert.equal((await f.call(`/sessions/${focus.session_id}/heartbeat`, {}, { now: time(121 + i) })).status, 200)
  }
  assert.equal((await f.call(`/sessions/${focus.session_id}/complete`, {}, { now: time(1621) })).status, 200)
  await scan('NFC_HOME_RETURN', 1680)
  await scan('NFC_STRENGTH_SET', 1681); await scan('NFC_STRENGTH_SET', 1684); await scan('NFC_STRENGTH_SET', 1687)
  const bike = await scan('NFC_BIKE_START', 1690)
  const now = time(3130)
  assert.equal((await f.call(`/devices/${esp.device.device_id}/telemetry`, { event_id: crypto.randomUUID(), local_state: 'PEDALING', playback_allowed_locally: true, rpm: 56, active_seconds: 1440, occurred_at: now }, { token: esp.token, now })).status, 200)
  assert.equal((await f.call(`/sessions/${bike.session_id}/complete`, {}, { now })).status, 200)
  await scan('NFC_BATH_DONE', 3200); await scan('NFC_CROQUIS_DONE', 3210)
  const result = await f.call('/daily-close', { review: '非公開レビュー', tomorrow_top3: ['研究', '制作', '連絡'] }, { now: time(3300) })
  assert.equal(result.status, 200); assert.ok(!result.data.tweet_draft.includes('非公開レビュー'))
  await scan('NFC_SLEEP', 3310)
  const state = (await f.call('/state', undefined, { now: time(3310) })).data.state
  assert.equal(state.routinePhase, 'SLEEPING'); assert.equal(state.progress.focusSessionsCompleted, 1); assert.equal(state.progress.bikeActiveSeconds, 1440)
})

test('Shortcuts preparation issues fresh runtime envelopes without a state change and requires a live binding', async () => {
  const f=setup(); await f.login(); const tag=await f.tag('NFC_WAKE'); const phone=await f.device()
  const body={tag_id:tag.tag_id,device_id:phone.device.device_id}
  assert.equal((await f.call('/nfc/prepare',body,{token:phone.token})).status,403)
  await f.call('/nfc/bindings',{...body,mode:'IOS_SHORTCUTS'})
  const before=(await f.call('/state')).data.state.revision
  const a=await f.call('/nfc/prepare',body,{token:phone.token})
  const b=await f.call('/nfc/prepare',body,{token:phone.token})
  assert.equal(a.status,200); assert.notEqual(a.data.scan_id,b.data.scan_id)
  assert.equal((await f.call('/state')).data.state.revision,before)
  const accepted=await f.call('/nfc/scans',a.data,{token:phone.token})
  assert.equal(accepted.status,200)
  assert.deepEqual((await f.call('/nfc/scans',a.data,{token:phone.token})).data,accepted.data)
  await f.call(`/devices/${phone.device.device_id}/revoke`,{})
  assert.equal((await f.call('/nfc/prepare',body,{token:phone.token})).status,401)
})
