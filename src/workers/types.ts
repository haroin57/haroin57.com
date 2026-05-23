// 共通の型定義

export type Env = {
  // KV (レート制限、PVカウント、Good用)
  HAROIN_PV: KVNamespace

  // D1 Database
  POSTS_DB: D1Database
  BBS_DB: D1Database

  // R2 (画像ストレージ)
  CMS_IMAGES?: R2Bucket

  // 環境変数
  ALLOWED_ORIGIN?: string
  ADMIN_SECRET?: string
  R2_PUBLIC_URL?: string
  CYANITE_WEBHOOK_SECRET?: string
}

// BBS型定義
export type Thread = {
  id: string
  title: string
  createdAt: string
  createdBy: string
  postCount: number
  lastPostAt: string
}

export type BBSPost = {
  id: number
  name: string
  date: string
  userId: string
  content: string
}

// D1用のBBS投稿型
export type BBSPostRow = {
  id: number
  thread_id: string
  post_number: number
  name: string
  date: string
  user_id: string
  content: string
  is_deleted: number
}

// D1用のスレッド型
export type ThreadRow = {
  id: string
  title: string
  created_at: string
  created_by: string
  post_count: number
  last_post_at: string
}

// 定数
export const DEFAULT_ORIGIN = 'https://haroin57.com'
export const RL_TTL_SECONDS = 60
export const MAX_THREADS = 100
export const MAX_POSTS_PER_THREAD = 1000
export const POST_RATE_LIMIT_TTL = 60
export const THREAD_RATE_LIMIT_TTL = 60
