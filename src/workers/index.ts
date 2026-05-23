// メインWorkerエントリーポイント
// PVカウンター + Goodボタン + BBS + CMS API を統合

import type { Env } from './types'
import { DEFAULT_ORIGIN } from './types'
import { buildCorsHeaders, checkOrigin } from './utils'
import { handlePv, handleGood } from './pv'
import { handleBbs } from './bbs'
import { handleCyaniteWebhook } from './cyanite'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // サポートするパス
    const isPv = url.pathname.startsWith('/api/pv')
    const isGood = url.pathname.startsWith('/api/good')
    const isBbs = url.pathname.startsWith('/api/bbs')
    const isCyaniteWebhook = url.pathname.startsWith('/api/cyanite/webhook')

    if (!isPv && !isGood && !isBbs && !isCyaniteWebhook) {
      return new Response('not found', { status: 404 })
    }

    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
    const corsHeaders = buildCorsHeaders(allowedOrigin)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Origin / Referer チェック
    if (!checkOrigin(req, env)) {
      return new Response('forbidden', { status: 403, headers: corsHeaders })
    }

    // BBS は GET, POST, DELETE を許可
    if (isBbs) {
      if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
      }
      return handleBbs(req, env, corsHeaders, url.pathname)
    }

    if (isCyaniteWebhook) {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
      }
      return handleCyaniteWebhook(req, env, corsHeaders)
    }

    // PV, Good は POST のみ
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    if (isPv) {
      return handlePv(req, env, corsHeaders)
    }

    return handleGood(req, env, corsHeaders)
  },
}
