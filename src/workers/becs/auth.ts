import type { Env } from '../types.ts'
import type { Db } from './store.ts'

export async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function equal(left: string, right: string): Promise<boolean> {
  const a = await hash(left); const b = await hash(right)
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}
export function sameOrigin(req: Request, env: Env): boolean {
  return req.headers.get('Origin') === (env.ALLOWED_ORIGIN ?? 'https://haroin57.com')
}
export async function webAuth(req: Request, db: Db, now: string, mutation: boolean): Promise<boolean> {
  const raw = req.headers.get('Cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith('__Host-becs='))?.slice(12)
  if (!raw) return false
  const session = await db.prepare('SELECT csrf_hash,expires_at FROM becs_web_sessions WHERE token_hash=?').bind(await hash(raw)).first<{ csrf_hash: string; expires_at: string }>()
  if (!session || session.expires_at <= now) return false
  return !mutation || await equal(await hash(req.headers.get('X-BECS-CSRF') ?? ''), session.csrf_hash)
}
export async function login(req: Request, env: Env, db: Db, now: string, secret: unknown): Promise<Response> {
  const json = (body: unknown, status: number, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
  if (!env.BECS_ADMIN_SECRET) return json({ error: 'BECSの管理者認証が未設定です。' }, 503)
  const bucket = `${await hash(req.headers.get('CF-Connecting-IP') ?? 'local')}:${now.slice(0, 16)}`
  const row = await db.prepare('INSERT INTO becs_login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket, new Date(Date.parse(now) + 120_000).toISOString()).first<{ attempts: number }>()
  if (!row || row.attempts > 5) return json({ error: '認証の試行回数を超えました。1分後に再試行してください。' }, 429)
  if (typeof secret !== 'string' || !await equal(secret, env.BECS_ADMIN_SECRET)) return json({ error: '認証できません。' }, 401)
  const token = crypto.randomUUID() + crypto.randomUUID(); const csrf = crypto.randomUUID()
  const expires = new Date(Date.parse(now) + 3600_000).toISOString()
  await db.prepare('INSERT INTO becs_web_sessions VALUES(?,?,?)').bind(await hash(token), await hash(csrf), expires).run()
  return json({ csrf, expires_at: expires }, 200, { 'Set-Cookie': `__Host-becs=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600` })
}
