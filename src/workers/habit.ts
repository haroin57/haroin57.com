import type { Env } from './types'
import { habitFields } from '../types/habit.ts'
import type { HabitField, HabitLog, HabitTodo } from '../types/habit.ts'
import { habitTargetDate, shiftHabitDate, habitStreak } from './habit-date.ts'

const actions: Record<string, { counts: Partial<Record<HabitField, number>>; text: string }> = {
  toilet_sq_en: { counts: { squat_count: 30, english_count: 1 }, text: 'トイレ後のワイドSQ30回＋英語1レッスン完了！' },
  jump_sq: { counts: { squat_count: 20 }, text: 'ジャンプSQ20回完了！' },
  squat30: { counts: { squat_count: 30 }, text: 'スクワット30回完了！' },
  pushup_set: { counts: { pushup_sets: 1 }, text: '腕立て1セット完了！' },
  abs_set: { counts: { abs_sets: 1 }, text: '腹筋ローラー1セット完了！' },
  plank: { counts: { abs_sets: 1 }, text: 'プランク90秒完了！' },
  english: { counts: { english_count: 1 }, text: '英語1レッスン完了！' },
  screenshot: { counts: { screenshot_count: 1 }, text: 'スクショ資料1枚保存完了！' },
  work_focus: { counts: { work_focus_done: 1 }, text: '仕事25分初動完了！' },
}
const achievedSql = habitFields.map(field => `${field} > 0`).join(' OR ')

async function matchesSecret(provided: string | null, expected?: string): Promise<boolean> {
  if (!provided || !expected) return false
  const encode = new TextEncoder()
  const [a, b] = await Promise.all([provided, expected].map(value => crypto.subtle.digest('SHA-256', encode.encode(value))))
  const aa = new Uint8Array(a)
  const bb = new Uint8Array(b)
  let difference = 0
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i]
  return difference === 0
}
async function streak(db: D1Database, today: string): Promise<number> {
  const { results } = await db.prepare(`SELECT target_date FROM habit_logs WHERE target_date <= ? AND (${achievedSql}) ORDER BY target_date DESC`).bind(today).all<{ target_date: string }>()
  return habitStreak(results.map(row => row.target_date), today)
}

export async function handleHabit(req: Request, env: Env, cors: Record<string, string>, path: string): Promise<Response> {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
  const endpoint = path.slice('/api/habit/'.length)
  const method = ['today', 'stats'].includes(endpoint) ? 'GET' : 'POST'
  if (!['today', 'stats', 'quick', 'daily-close', 'todo/complete'].includes(endpoint)) return reply({ error: 'Not found' }, 404)
  if (req.method !== method) return reply({ error: 'Method not allowed' }, 405)
  if (endpoint !== 'stats') {
    if (method === 'POST' && !env.HABIT_TOKEN) return reply({ error: 'HABIT_TOKEN is not configured' }, 503)
    const bearer = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1] || null
    if (!(await matchesSecret(bearer, env.HABIT_TOKEN)) && !(await matchesSecret(req.headers.get('X-Admin-Secret'), env.ADMIN_SECRET))) {
      return reply({ error: 'Unauthorized' }, 401)
    }
  }
  if (!env.HABIT_DB) return reply({ error: 'Habit database is not configured' }, 503)
  const db = env.HABIT_DB
  const today = habitTargetDate()
  try {
    if (endpoint === 'stats') {
      const start = shiftHabitDate(today, -364)
      const { results: logs } = await db.prepare('SELECT * FROM habit_logs WHERE target_date BETWEEN ? AND ? ORDER BY target_date DESC').bind(start, today).all<HabitLog>()
      const byDate = new Map(logs.map(log => [log.target_date, log]))
      const totals = await db.prepare(`SELECT COALESCE(SUM(squat_count),0) AS total_squat, COALESCE(SUM(bike_minutes),0) AS total_bike_minutes, COALESCE(SUM(english_count),0) AS total_english, COALESCE(SUM(drawing_done),0) AS drawing_days FROM habit_logs WHERE target_date <= ?`).bind(today).first()
      return reply({
        days: Array.from({ length: 365 }, (_, i) => {
          const date = shiftHabitDate(start, i)
          const log = byDate.get(date)
          return { date, score: log ? habitFields.filter(field => log[field] > 0).length : 0 }
        }), totals, streak_days: await streak(db, today), logs: logs.filter(log => log.target_date >= shiftHabitDate(today, -29)),
      })
    }
    if (endpoint === 'today') {
      const log = await db.prepare('SELECT * FROM habit_logs WHERE target_date = ?').bind(today).first<HabitLog>()
      const { results: todos } = await db.prepare('SELECT * FROM daily_todos WHERE target_date = ? ORDER BY priority').bind(today).all<HabitTodo>()
      return reply({ target_date: today, log, todos, streak_days: await streak(db, today) })
    }
    if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'JSON body required' }, 415)
    if (Number(req.headers.get('content-length')) > 16384) return reply({ error: 'Body too large' }, 413)
    let body: Record<string, unknown>
    try {
      const reader = req.body?.getReader()
      if (!reader) throw new Error('Missing body')
      const chunks: Uint8Array[] = []
      let length = 0
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        length += chunk.value.byteLength
        if (length > 16384) {
          await reader.cancel()
          return reply({ error: 'Body too large' }, 413)
        }
        chunks.push(chunk.value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      const raw = new TextDecoder().decode(bytes)
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      body = parsed as Record<string, unknown>
    } catch { return reply({ error: 'Invalid JSON object' }, 400) }
    if (endpoint === 'todo/complete') {
      if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0) return reply({ error: 'Invalid todo id' }, 400)
      const result = await db.prepare('UPDATE daily_todos SET is_completed = 1 WHERE id = ? AND target_date = ? RETURNING id').bind(body.id, today).first()
      return result ? reply({ status: 'ok' }) : reply({ error: 'Todo not found for today' }, 404)
    }
    let log: HabitLog
    let actionText = ''
    if (endpoint === 'quick') {
      const action = typeof body.action_type === 'string' && Object.hasOwn(actions, body.action_type) ? actions[body.action_type] : null
      if (!action) return reply({ error: 'Unknown action_type' }, 400)
      // Phase 1 actions have fixed increments; value may only be the default 1.
      if (body.value !== undefined && body.value !== 1) return reply({ error: 'value must be 1' }, 400)
      const fields = Object.keys(action.counts) as HabitField[]
      const updates = fields.map(field => `${field} = ${field.endsWith('_done') ? '1' : `habit_logs.${field} + excluded.${field}`}`).join(', ')
      log = (await db.prepare(`INSERT INTO habit_logs (target_date, ${fields.join(', ')}) VALUES (?, ${fields.map(() => '?').join(', ')}) ON CONFLICT(target_date) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP RETURNING *`).bind(today, ...fields.map(field => action.counts[field])).first<HabitLog>())!
      actionText = action.text
    } else {
      const flags = ['circuit_done', 'shadowing_done', 'drawing_done', 'work_focus_done'] as const
      if (flags.some(field => ![true, false, 0, 1].includes(body[field] as boolean)) || !Number.isSafeInteger(body.bike_minutes) || Number(body.bike_minutes) < 0 || Number(body.bike_minutes) > 1440) return reply({ error: 'Flags must be boolean or 0/1; bike_minutes must be 0–1440' }, 400)
      if (body.memo !== undefined && (typeof body.memo !== 'string' || [...body.memo].length > 140)) return reply({ error: 'memo must be at most 140 characters' }, 400)
      if (body.next_todos !== undefined && (!Array.isArray(body.next_todos) || body.next_todos.length > 3 || body.next_todos.some(title => typeof title !== 'string' || title.length > 200))) return reply({ error: 'next_todos must contain at most 3 titles (200 characters each)' }, 400)
      const nextDate = shiftHabitDate(today, 1)
      const statements = [db.prepare(`INSERT INTO habit_logs (target_date, circuit_done, shadowing_done, drawing_done, work_focus_done, bike_minutes, memo) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(target_date) DO UPDATE SET circuit_done=excluded.circuit_done, shadowing_done=excluded.shadowing_done, drawing_done=excluded.drawing_done, work_focus_done=excluded.work_focus_done, bike_minutes=excluded.bike_minutes, memo=excluded.memo, updated_at=CURRENT_TIMESTAMP RETURNING *`).bind(today, ...flags.map(field => Number(body[field])), body.bike_minutes, body.memo ?? '')]
      if (body.next_todos !== undefined) {
        statements.push(db.prepare('DELETE FROM daily_todos WHERE target_date = ?').bind(nextDate))
        const titles = (body.next_todos as string[]).map(title => title.trim()).filter(Boolean)
        titles.forEach((title, i) => statements.push(db.prepare('INSERT INTO daily_todos (target_date, priority, title) VALUES (?, ?, ?)').bind(nextDate, i + 1, title)))
      }
      // D1 batch commits the log and replacement To-Dos together, rolling back on error.
      const result = await db.batch<HabitLog>(statements)
      log = result[0].results[0]
    }
    const days = await streak(db, today)
    const total = await db.prepare('SELECT COALESCE(SUM(squat_count),0) AS total FROM habit_logs WHERE target_date <= ?').bind(today).first<{ total: number }>()
    const tweet = endpoint === 'quick'
      ? `${actionText}\n本日累計SQ：${log.squat_count}回 / 連続${days}日目🔥\n#IfThen習慣 #今日の積み上げ`
      : `【Day ${days} 継続中🔥】今日のIf-Then成果\n💪 筋トレ：腕立て${log.pushup_sets}set / スクワット${log.squat_count}回 / 腹筋${log.abs_sets}set${log.circuit_done ? ' / サーキット完了' : ''}\n🚴 バイク：${log.bike_minutes}分\n🇬🇧 英語：アプリ${log.english_count}レッスン${log.shadowing_done ? '＋シャドーイング' : ''}\n🎨 お絵描き：${log.drawing_done ? '1クロッキー完了' : '未記録'}\n\n累計SQ：${total?.total ?? 0}回\n#今日の積み上げ #IfThen習慣 #筋トレ #iPadお絵描き`
    return reply({ status: 'ok', target_date: today, streak_days: days, today_summary: log, tweet_text: tweet })
  } catch (error) {
    console.error('habit_api_error', error instanceof Error ? error.message : 'Unknown database error')
    return reply({ error: '習慣データの処理に失敗しました。' }, 500)
  }
}
