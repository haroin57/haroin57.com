// PVカウンター専用のシンプルな Worker。/api/pv 以外は扱わない。

type KVNamespace = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

type Env = {
  HAROIN_PV: KVNamespace
  ALLOWED_ORIGIN?: string
}

const DEFAULT_ORIGIN = 'https://haroin57.com'
const RL_TTL_SECONDS = 60

function buildCorsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // /api/pv 以外は扱わない
    if (!url.pathname.startsWith('/api/pv')) {
      return new Response('not found', { status: 404 })
    }

    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
    const origin = req.headers.get('origin') || ''
    const referer = req.headers.get('referer') || ''
    const corsHeaders = buildCorsHeaders(allowedOrigin)
    const started = Date.now()

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // メソッド制限
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    // Origin / Referer チェック
    const isAllowed =
      origin === allowedOrigin ||
      (origin === '' && referer.startsWith(allowedOrigin)) ||
      (origin === '' && referer === '')
    if (!isAllowed) {
      return new Response('forbidden', { status: 403, headers: corsHeaders })
    }

    // 簡易レート制限（IPごと）
    const ip = req.headers.get('cf-connecting-ip') || 'unknown'
    const rlKey = `rl:${ip}`
    const already = await env.HAROIN_PV.get(rlKey)
    if (already) {
      const current = Number((await env.HAROIN_PV.get('total')) ?? '0')
      return new Response(JSON.stringify({ total: current }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }
    await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: RL_TTL_SECONDS })

    // カウント加算
    const key = 'total'
    const current = Number((await env.HAROIN_PV.get(key)) ?? '0')
    const next = Number.isFinite(current) ? current + 1 : 1
    await env.HAROIN_PV.put(key, String(next))

    const duration = Date.now() - started
    console.log('pv ok', { ip, durationMs: duration, total: next })

    return new Response(JSON.stringify({ total: next }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  },
}
