import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchHabitStats } from '../src/lib/habit.ts'

test('public Habit data uses only a credential-free GET and propagates backend failure', async () => {
  const original=globalThis.fetch
  const signal=new AbortController().signal
  try {
    globalThis.fetch=async (url,options) => {
      assert.equal(url,'/api/habit/stats'); assert.equal(options.method,'GET')
      assert.equal(options.credentials,'omit'); assert.equal(options.cache,'no-store'); assert.equal(options.signal,signal)
      assert.equal(options.body,undefined); assert.equal(options.headers,undefined)
      return Response.json({days:[],logs:[],totals:{},streak_days:0})
    }
    assert.equal((await fetchHabitStats(signal)).streak_days,0)
    globalThis.fetch=async () => Response.json({error:'一時停止'},{status:503})
    await assert.rejects(fetchHabitStats(),/一時停止/)
  } finally { globalThis.fetch=original }
})
