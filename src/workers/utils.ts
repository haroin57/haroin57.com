// 共通ユーティリティ関数

import { DEFAULT_ORIGIN } from './types'

// CORSヘッダー生成
export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-Admin-Secret, Authorization',
  }
}

// ユーザーIDを生成（IPベースで固定）
export function generateUserId(ip: string): string {
  const hash = simpleHash(ip)
  return hash.slice(0, 9)
}

// シンプルなハッシュ関数
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  let h = Math.abs(hash)
  for (let i = 0; i < 9; i++) {
    result += chars[h % chars.length]
    h = Math.floor(h / chars.length) + (h % 7)
  }
  return result
}

// 日時フォーマット（2ch形式、日本時間 JST）
export function formatDate(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const year = jst.getUTCFullYear()
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(jst.getUTCDate()).padStart(2, '0')
  const dayOfWeek = days[jst.getUTCDay()]
  const hours = String(jst.getUTCHours()).padStart(2, '0')
  const minutes = String(jst.getUTCMinutes()).padStart(2, '0')
  const seconds = String(jst.getUTCSeconds()).padStart(2, '0')
  const ms = String(jst.getUTCMilliseconds()).slice(0, 2).padStart(2, '0')
  return `${year}/${month}/${day}(${dayOfWeek}) ${hours}:${minutes}:${seconds}.${ms}`
}

// スレッドID生成
export function generateThreadId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// JSONレスポンス
export function jsonResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// エラーレスポンス
export function errorResponse(
  error: string,
  corsHeaders: Record<string, string>,
  status = 400
): Response {
  return jsonResponse({ error }, corsHeaders, status)
}

// Origin/Refererチェック
export function checkOrigin(req: Request, env: { ALLOWED_ORIGIN?: string }): boolean {
  const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
  const origin = req.headers.get('origin') || ''
  const referer = req.headers.get('referer') || ''

  return (
    origin === allowedOrigin ||
    (origin === '' && referer.startsWith(allowedOrigin)) ||
    (origin === '' && referer === '')
  )
}
