import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { becsRequest, BecsError } from '../src/becs/client.ts'

const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
let storage
beforeEach(() => {
  storage = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
  } })
})
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
})

test('a tab without operation authentication never sends activation or binding requests', async () => {
  let requests = 0
  globalThis.fetch = async () => { requests++; return Response.json({}) }
  for (const [path, method, body] of [
    ['/nfc/tags/nfc_test', 'PATCH', { status: 'ACTIVE' }],
    ['/nfc/bindings', 'POST', { tag_id: 'nfc_test', device_id: 'test-phone', mode: 'IOS_SHORTCUTS' }],
  ]) {
    await assert.rejects(becsRequest(path, method, body), error => error instanceof BecsError && error.status === 401)
  }
  assert.equal(requests, 0)
})

test('owner login remains available in a new tab and preserves same-origin authentication', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/auth/session')
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'same-origin')
    return Response.json({ csrf: 'new-tab-csrf' })
  }
  assert.deepEqual(await becsRequest('/auth/session', 'POST', { secret: 'fixture-owner' }), { csrf: 'new-tab-csrf' })
})

test('authenticated activation carries the tab token and API rejection remains recoverable', async () => {
  storage.set('becs_csrf', 'current-tab-csrf')
  const body = { request_id: crypto.randomUUID(), status: 'ACTIVE' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/nfc/tags/nfc_test')
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers['X-BECS-CSRF'], 'current-tab-csrf')
    assert.deepEqual(JSON.parse(options.body), body)
    return Response.json({ error: '本人または登録端末の認証が必要です。' }, { status: 401 })
  }
  await assert.rejects(becsRequest('/nfc/tags/nfc_test', 'PATCH', body), error => error instanceof BecsError && error.status === 401)
})
