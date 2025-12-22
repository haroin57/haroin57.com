// メインWorkerエントリーポイント
// PVカウンター + Goodボタン + BBS + CMS API を統合

import type { Env } from './types'
import { DEFAULT_ORIGIN } from './types'
import { buildCorsHeaders, checkOrigin } from './utils'
import { handlePv, handleGood } from './pv'
import { handleBbs } from './bbs'
import { handleCms } from './cms'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // サポートするパス
    const isPv = url.pathname.startsWith('/api/pv')
    const isGood = url.pathname.startsWith('/api/good')
    const isBbs = url.pathname.startsWith('/api/bbs')
    const isCms = url.pathname.startsWith('/api/cms')

    if (!isPv && !isGood && !isBbs && !isCms) {
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

    // CMS は GET, POST, PUT, PATCH, DELETE を許可
    if (isCms) {
      if (
        req.method !== 'GET' &&
        req.method !== 'POST' &&
        req.method !== 'PUT' &&
        req.method !== 'PATCH' &&
        req.method !== 'DELETE'
      ) {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
      }
      return handleCms(req, env, corsHeaders, url.pathname)
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
