// Minimal KV type for this Worker（追加の型パッケージなしで利用）
type KVNamespace = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

type Env = {
  HAROIN_PV: KVNamespace
  ALLOWED_ORIGIN?: string
}

const DEFAULT_ORIGIN = 'https://haroin57.com'
const RL_TTL_SECONDS = 60 // 同一IPからの連打を抑制（簡易レート制限）

function buildCorsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
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

    // Origin/Referer チェック（他サイトからの不正加算防止）
    const isAllowed =
      origin === '' // ブラウザ以外のクライアントは referer で確認
        ? referer.startsWith(allowedOrigin)
        : origin === allowedOrigin
    if (!isAllowed) {
      console.warn('pv forbidden', { origin, referer })
      return new Response('forbidden', { status: 403, headers: corsHeaders })
    }

    // 簡易レート制限（IPごとの連続加算を抑止）
    const ip = req.headers.get('cf-connecting-ip') || 'unknown'
    const rlKey = `rl:${ip}`
    const alreadyHit = await env.HAROIN_PV.get(rlKey)
    if (alreadyHit) {
      // レート超過時は現在値だけ返す（加算しない）
      const current = Number((await env.HAROIN_PV.get('total')) ?? '0')
      const duration = Date.now() - started
      console.log('pv rate-limited', { ip, durationMs: duration, total: current })
      return new Response(JSON.stringify({ total: current }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }

    // レート制限用フラグを TTL 付きで保存
    await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: RL_TTL_SECONDS })

    // PV カウンタの加算
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
