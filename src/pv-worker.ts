// PVカウンター + Goodボタン用の Worker。/api/pv と /api/good を扱う。

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

async function handlePv(req: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
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

  const started = Date.now()
  const duration = Date.now() - started
  console.log('pv ok', { ip, durationMs: duration, total: next })

  return new Response(JSON.stringify({ total: next }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

async function handleGood(req: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown'
  let payload: { slug?: string; action?: string } = {}
  try {
    payload = await req.json()
  } catch (e) {
    return new Response('bad request', { status: 400, headers: corsHeaders })
  }

  const slug = payload.slug?.trim()
  const action = payload.action === 'vote' ? 'vote' : 'get'
  if (!slug) {
    return new Response('missing slug', { status: 400, headers: corsHeaders })
  }

  const countKey = `good:${slug}:count`
  const ipKey = `good:${slug}:ip:${ip}`

  const current = Number((await env.HAROIN_PV.get(countKey)) ?? '0') || 0
  const alreadyVoted = Boolean(await env.HAROIN_PV.get(ipKey))

  if (action !== 'vote' || alreadyVoted) {
    return new Response(JSON.stringify({ total: current, voted: alreadyVoted }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const next = current + 1
  await env.HAROIN_PV.put(countKey, String(next))
  await env.HAROIN_PV.put(ipKey, '1')

  console.log('good ok', { ip, slug, total: next })

  return new Response(JSON.stringify({ total: next, voted: true }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // サポートするパス以外は404
    const isPv = url.pathname.startsWith('/api/pv')
    const isGood = url.pathname.startsWith('/api/good')
    if (!isPv && !isGood) {
      return new Response('not found', { status: 404 })
    }

    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
    const origin = req.headers.get('origin') || ''
    const referer = req.headers.get('referer') || ''
    const corsHeaders = buildCorsHeaders(allowedOrigin)

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

    if (isPv) {
      return handlePv(req, env, corsHeaders)
    }

    return handleGood(req, env, corsHeaders)
  },
}
