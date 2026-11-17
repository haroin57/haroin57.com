// Isolated Mac E2E backend: executes the real Worker handlers against in-memory SQLite.
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { handleBecs } from '../../src/workers/becs/api.ts'
import { handleHabit } from '../../src/workers/habit.ts'
import { initialControl } from '../../src/becs/model.ts'
import { hash } from '../../src/workers/becs/auth.ts'

const directory = resolve(process.argv[2] ?? '/tmp/haroin-shortcuts-e2e-run')
mkdirSync(directory, { recursive: true, mode: 0o700 })
const port = Number(process.env.BECS_E2E_PORT ?? 18765)
const origin = `http://127.0.0.1:${port}`
const sql = new DatabaseSync(':memory:')
for (const name of ['0003_habit.sql', '0004_becs.sql']) sql.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'))
function prepare(query, args = []) {
  return {
    bind(...values) { return prepare(query, values) },
    async first() { return sql.prepare(query).get(...args) ?? null },
    async all() { return { results: sql.prepare(query).all(...args) } },
    async run() { return sql.prepare(query).run(...args) },
  }
}
const db = { prepare, withSession() { return db }, async batch(statements) {
  sql.exec('BEGIN')
  try { const results = []; for (const statement of statements) results.push(await statement.all()); sql.exec('COMMIT'); return results }
  catch (error) { sql.exec('ROLLBACK'); throw error }
} }
const previous = existsSync(resolve(directory, 'config.json')) ? JSON.parse(readFileSync(resolve(directory, 'config.json'), 'utf8')) : null
const token = existsSync(resolve(directory, 'token')) ? readFileSync(resolve(directory, 'token'), 'utf8') : crypto.randomUUID() + crypto.randomUUID()
const deviceId = previous?.device_id ?? crypto.randomUUID()
const now = new Date().toISOString()
const control = initialControl(now)
control.devices.push({ device_id: deviceId, label: 'Isolated E2E iPhone credential', type: 'IPHONE', token_hash: await hash(token), status: 'ACTIVE' })
const tags = {}
for (const [name, purpose] of [['wake', 'NFC_WAKE'], ['departure', 'NFC_DEPARTURE'], ['lab-arrival', 'NFC_LAB_ARRIVAL']]) {
  const tagId = previous?.tags?.[name] ?? `nfc_${crypto.randomUUID()}`
  tags[name] = tagId
  control.tags.push({ tag_id: tagId, purpose, label: `E2E ${name}`, placement: 'Mac localhost fixture', status: 'ACTIVE', version: 1 })
  control.bindings.push({ binding_id: crypto.randomUUID(), tag_id: tagId, device_id: deviceId, mode: 'IOS_SHORTCUTS', registered_at: now })
}
const seed = JSON.stringify(control)
sql.prepare('INSERT INTO becs_snapshots VALUES(?,?,?,?)').run(1, 0, seed, now)
const env = { HABIT_DB: db, HABIT_TOKEN: 'isolated-habit-token', BECS_ADMIN_SECRET: 'isolated-owner-secret', ALLOWED_ORIGIN: origin }
await handleHabit(new Request(origin + '/api/habit/quick', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer isolated-habit-token' }, body: JSON.stringify({ action_type: 'toilet_sq_en' }) }), env, {}, '/api/habit/quick')
const requests = []
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin)
    const chunks = []; for await (const chunk of incoming) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    let requestBody
    try { requestBody = body.length ? JSON.parse(body.toString()) : undefined } catch { requestBody = '(invalid JSON)' }
    if (!url.pathname.startsWith('/__e2e/')) requests.push({ path: url.pathname, method: incoming.method, body: requestBody })
    let response
    if (url.pathname === '/__e2e/reset' && incoming.method === 'POST' && incoming.headers['x-becs-e2e-reset'] === token) {
      for (const { name } of sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
        if (!['habit_logs', 'daily_todos'].includes(name)) sql.exec(`DELETE FROM ${name}`)
      }
      sql.prepare('INSERT INTO becs_snapshots VALUES(?,?,?,?)').run(1, 0, seed, now)
      requests.length = 0
      response = Response.json({ reset: true, isolated_fixture: true })
    } else if (url.pathname === '/__e2e/state') {
      const snapshot = JSON.parse(sql.prepare('SELECT document_json FROM becs_snapshots ORDER BY sequence DESC LIMIT 1').get().document_json)
      response = Response.json({ state: snapshot.state, requests, scans: sql.prepare('SELECT scan_id,outcome,response_json FROM nfc_scan_attempts').all() })
    } else if (url.pathname.startsWith('/api/')) {
      const req = new Request(url, { method: incoming.method, headers: incoming.headers, ...(body.length ? { body } : {}) })
      response = url.pathname.startsWith('/api/v1/') ? await handleBecs(req, env) : await handleHabit(req, env, {}, url.pathname)
    } else {
      response = new Response(`<title>BECS isolated E2E ${url.pathname}</title><p>Mac E2E fixture; no production data.</p>`, { headers: { 'Content-Type': 'text/html' } })
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)) }
})
server.listen(port, '127.0.0.1', () => {
  writeFileSync(resolve(directory, 'config.json'), JSON.stringify({ origin, device_id: deviceId, tags }), { mode: 0o600 })
  writeFileSync(resolve(directory, 'token'), token, { mode: 0o600 })
  writeFileSync(resolve(directory, 'ready.json'), JSON.stringify({ port, pid: process.pid, fixture: true }), { mode: 0o600 })
  console.log(`Isolated E2E backend ready on localhost:${port}; production is untouched.`)
})
