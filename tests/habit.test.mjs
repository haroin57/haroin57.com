import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { handleHabit } from '../src/workers/habit.ts'
import { habitTargetDate, shiftHabitDate, habitStreak } from '../src/workers/habit-date.ts'

function setup() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0003_habit.sql', import.meta.url), 'utf8'))
  function prepared(sql, args = []) {
    return {
      bind(...values) { return prepared(sql, values) },
      async first() { return sqlite.prepare(sql).get(...args) ?? null },
      async all() { return { results: sqlite.prepare(sql).all(...args), success: true } },
    }
  }
  const db = {
    prepare: prepared,
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const result = []
        for (const statement of statements) result.push(await statement.all())
        sqlite.exec('COMMIT')
        return result
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  }
  const env = { HABIT_DB: db, HABIT_TOKEN: 'test-token', ADMIN_SECRET: 'admin-test' }
  async function request(endpoint, body, token = 'test-token', overrides = {}) {
    const method = body === undefined ? 'GET' : 'POST'
    const response = await handleHabit(new Request(`https://example.com/api/habit/${endpoint}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...overrides },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env, {}, `/api/habit/${endpoint}`)
    return { status: response.status, data: await response.json() }
  }
  return { sqlite, env, request }
}

test('JST 04:00 boundary, month and year rollover', () => {
  assert.equal(habitTargetDate(new Date('2026-11-16T18:59:59Z')), '2026-11-16')
  assert.equal(habitTargetDate(new Date('2026-11-16T19:00:00Z')), '2026-11-17')
  assert.equal(habitTargetDate(new Date('2026-12-31T18:59:59Z')), '2026-12-31')
  assert.equal(habitTargetDate(new Date('2026-12-31T19:00:00Z')), '2027-01-01')
  assert.equal(shiftHabitDate('2028-02-28', 1), '2028-02-29')
})
test('streak starts today or yesterday and stops at gaps', () => {
  assert.equal(habitStreak(['2026-11-17', '2026-11-16'], '2026-11-17'), 2)
  assert.equal(habitStreak(['2026-11-16', '2026-11-15'], '2026-11-17'), 2)
  assert.equal(habitStreak(['2026-11-15'], '2026-11-17'), 0)
  assert.equal(habitStreak([], '2026-11-17'), 0)
})
test('auth fails closed; stats are public; admin fallback requires write token configured', async () => {
  const { request, env } = setup()
  assert.equal((await request('today', undefined, 'bad')).status, 401)
  assert.equal((await request('quick', { action_type: 'squat30' }, 'bad')).status, 401)
  assert.equal((await request('today', undefined, '', { 'X-Admin-Secret': 'admin-test' })).status, 200)
  assert.equal((await request('stats', undefined, '')).status, 200)
  env.HABIT_TOKEN = ''
  assert.equal((await request('quick', { action_type: 'squat30' }, '', { 'X-Admin-Secret': 'admin-test' })).status, 503)
})
test('quick actions add fixed counts and work focus remains a flag', async () => {
  const { request } = setup()
  for (const action_type of ['toilet_sq_en', 'jump_sq', 'squat30', 'pushup_set', 'abs_set', 'plank', 'english', 'screenshot', 'work_focus', 'work_focus']) {
    assert.equal((await request('quick', { action_type })).status, 200)
  }
  const { data } = await request('today')
  assert.equal(data.log.squat_count, 80)
  assert.equal(data.log.abs_sets, 2)
  assert.equal(data.log.pushup_sets, 1)
  assert.equal(data.log.english_count, 2)
  assert.equal(data.log.screenshot_count, 1)
  assert.equal(data.log.work_focus_done, 1)
  assert.equal(data.streak_days, 1)
  const result = await request('quick', { action_type: 'squat30' })
  assert.match(result.data.tweet_text, /本日累計SQ：110回 \/ 連続1日目🔥/)
  assert.match(result.data.tweet_text, /#IfThen習慣 #今日の積み上げ/)
  assert.equal((await request('quick', { action_type: '__proto__' })).status, 400)
  assert.equal((await request('quick', { action_type: 'squat30', value: -1 })).status, 400)
})
const closing = { circuit_done: true, bike_minutes: 48, shadowing_done: true, drawing_done: true, work_focus_done: true, memo: '公開メモ', next_todos: ['秘密の仕事', '制作'] }
test('daily close preserves counters and replaces only tomorrow todos; omitted todos remain', async () => {
  const { request, sqlite } = setup()
  await request('quick', { action_type: 'squat30' })
  const result = await request('daily-close', closing)
  assert.equal(result.status, 200)
  assert.equal(result.data.today_summary.squat_count, 30)
  assert.equal(result.data.today_summary.bike_minutes, 48)
  assert.match(result.data.tweet_text, /【Day 1 継続中🔥】/)
  const tomorrow = shiftHabitDate(habitTargetDate(), 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM daily_todos WHERE target_date=?').get(tomorrow).n, 2)
  await request('daily-close', { ...closing, next_todos: ['置き換え'] })
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM daily_todos').get().n, 1)
  const { next_todos: _, ...withoutTodos } = closing
  await request('daily-close', withoutTodos)
  assert.equal(sqlite.prepare('SELECT title FROM daily_todos').get().title, '置き換え')
  await request('daily-close', { ...closing, next_todos: [] })
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM daily_todos').get().n, 0)
})
test('daily close validation rejects invalid fields without modifying database', async () => {
  const { request, sqlite } = setup()
  for (const patch of [{ bike_minutes: -1 }, { bike_minutes: 1.5 }, { drawing_done: 'yes' }, { memo: 'あ'.repeat(141) }, { next_todos: ['a', 'b', 'c', 'd'] }, { next_todos: [null] }]) {
    assert.equal((await request('daily-close', { ...closing, ...patch })).status, 400)
  }
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM habit_logs').get().n, 0)
})
test('log and tomorrow todos roll back together when batch fails', async () => {
  const { request, sqlite } = setup()
  sqlite.exec("CREATE TRIGGER fail_todo BEFORE INSERT ON daily_todos BEGIN SELECT RAISE(ABORT, 'test failure'); END")
  assert.equal((await request('daily-close', closing)).status, 500)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM habit_logs').get().n, 0)
})
test('stats fill 365 days, use 30 calendar days, aggregate all time and never expose todos', async () => {
  const { request, sqlite } = setup()
  const today = habitTargetDate()
  sqlite.prepare('INSERT INTO habit_logs (target_date,squat_count,memo) VALUES (?,?,?)').run(shiftHabitDate(today, -500), 100, 'old')
  sqlite.prepare('INSERT INTO habit_logs (target_date,squat_count) VALUES (?,?)').run(shiftHabitDate(today, -30), 20)
  await request('daily-close', closing)
  const result = await request('stats', undefined, '')
  assert.equal(result.data.days.length, 365)
  assert.equal(result.data.days.at(-1).score, 5)
  assert.equal(result.data.totals.total_squat, 120)
  assert.equal(result.data.logs.length, 1)
  assert.equal(result.data.logs[0].memo, '公開メモ')
  assert.ok(!JSON.stringify(result.data).includes('秘密の仕事'))
})
test('empty rows do not count as achievements; completion is restricted to today', async () => {
  const { request, sqlite } = setup()
  const today = habitTargetDate()
  const yesterday = shiftHabitDate(today, -1)
  sqlite.prepare('INSERT INTO habit_logs (target_date) VALUES (?)').run(today)
  sqlite.prepare('INSERT INTO habit_logs (target_date,english_count) VALUES (?,1)').run(yesterday)
  sqlite.prepare('INSERT INTO daily_todos (target_date,priority,title) VALUES (?,1,?)').run(today, 'today')
  sqlite.prepare('INSERT INTO daily_todos (target_date,priority,title) VALUES (?,1,?)').run(yesterday, 'yesterday')
  assert.equal((await request('today')).data.streak_days, 1)
  assert.equal((await request('todo/complete', { id: 1 })).status, 200)
  assert.equal((await request('todo/complete', { id: 2 })).status, 404)
  assert.equal((await request('todo/complete', { id: '1' })).status, 400)
})
test('overlapping quick requests do not lose increments', async () => {
  const { request } = setup()
  const results = await Promise.all(Array.from({ length: 30 }, () => request('quick', { action_type: 'squat30' })))
  assert.ok(results.every(result => result.status === 200))
  assert.equal((await request('today')).data.log.squat_count, 900)
})
