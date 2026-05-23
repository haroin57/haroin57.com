// 認証関連のユーティリティ（ADMIN_SECRET のみ）

import type { Env } from './types'

export async function checkAdminAuth(req: Request, env: Env): Promise<boolean> {
  const secret = req.headers.get('X-Admin-Secret')
  if (env.ADMIN_SECRET && secret === env.ADMIN_SECRET) {
    return true
  }
  return false
}
