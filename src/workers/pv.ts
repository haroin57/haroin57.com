// PVカウンター + Goodボタン API

import type { Env } from './types'
import { RL_TTL_SECONDS } from './types'
import { jsonResponse, errorResponse } from './utils'

// PVカウント
export async function handlePv(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // リクエストボディからskipCountフラグを取得
    let skipCount = false
    try {
      const body = (await req.json()) as { skipCount?: boolean }
      skipCount = body.skipCount === true
    } catch {
      // bodyがない場合は無視
    }

    const key = 'total'

    // skipCountがtrueの場合（セッション内で既にカウント済み）はカウントをスキップ
    if (skipCount) {
      const current = Number((await env.HAROIN_PV.get(key)) ?? '0')
      return jsonResponse({ total: current }, corsHeaders)
    }

    const ip = req.headers.get('cf-connecting-ip') || 'unknown'
    const rlKey = `rl:${ip}`

    // レート制限チェック（IPごと60秒）
    const already = await env.HAROIN_PV.get(rlKey)
    if (already) {
      const current = Number((await env.HAROIN_PV.get(key)) ?? '0')
      return jsonResponse({ total: current }, corsHeaders)
    }

    await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: RL_TTL_SECONDS })

    // カウント加算
    const current = Number((await env.HAROIN_PV.get(key)) ?? '0')
    const next = Number.isFinite(current) ? current + 1 : 1
    await env.HAROIN_PV.put(key, String(next))

    return jsonResponse({ total: next }, corsHeaders)
  } catch (error) {
    console.error('pv error:', error)
    // エラー時はキャッシュされた値を返す
    try {
      const current = Number((await env.HAROIN_PV.get('total')) ?? '0')
      return jsonResponse({ total: current }, corsHeaders)
    } catch {
      return jsonResponse({ total: 0 }, corsHeaders)
    }
  }
}

// Goodボタン
export async function handleGood(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown'

  let payload: { slug?: string; action?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const slug = payload.slug?.trim()
  const actionRaw = payload.action?.toLowerCase()
  const action = actionRaw === 'vote' ? 'vote' : actionRaw === 'unvote' ? 'unvote' : 'get'

  if (!slug) {
    return errorResponse('missing slug', corsHeaders)
  }

  const countKey = `good:${slug}:count`
  const ipKey = `good:${slug}:ip:${ip}`

  const current = Number((await env.HAROIN_PV.get(countKey)) ?? '0') || 0
  const alreadyVoted = Boolean(await env.HAROIN_PV.get(ipKey))

  if (action === 'get' || (action === 'vote' && alreadyVoted)) {
    return jsonResponse({ total: current, voted: alreadyVoted }, corsHeaders)
  }

  if (action === 'unvote') {
    const next = Math.max(0, current - 1)
    await env.HAROIN_PV.put(countKey, String(next))
    await env.HAROIN_PV.delete(ipKey)
    console.log('good unvote', { ip, slug, total: next })
    return jsonResponse({ total: next, voted: false }, corsHeaders)
  }

  // vote
  const next = current + 1
  await env.HAROIN_PV.put(countKey, String(next))
  await env.HAROIN_PV.put(ipKey, '1')

  console.log('good ok', { ip, slug, total: next })

  return jsonResponse({ total: next, voted: true }, corsHeaders)
}
