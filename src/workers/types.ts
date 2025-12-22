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
  FIREBASE_PROJECT_ID?: string
  ADMIN_EMAILS?: string
  R2_PUBLIC_URL?: string
}

// Firebase IDトークンのヘッダー型
export type FirebaseTokenHeader = {
  alg: string
  kid: string
  typ: string
}

// Firebase IDトークンのペイロード型
export type FirebaseTokenPayload = {
  iss: string
  aud: string
  auth_time: number
  user_id: string
  sub: string
  iat: number
  exp: number
  email?: string
  email_verified?: boolean
}

// Google公開鍵のキャッシュ
export type PublicKeyCache = {
  keys: Record<string, CryptoKey>
  expiresAt: number
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

// CMS型定義
export type CMSPostMeta = {
  slug: string
  title: string
  summary: string
  createdAt: string
  updatedAt: string
  tags: string[]
  status: 'draft' | 'published'
}

export type CMSPost = CMSPostMeta & {
  markdown: string
  html: string
}

// D1用のPost型
export type CMSPostRow = {
  slug: string
  title: string
  summary: string
  markdown: string
  html: string
  tags: string // JSON string
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

export type CMSProductMeta = {
  slug: string
  name: string
  description: string
  language: string
  tags: string[]
  url: string
  demo?: string
  createdAt: string
  updatedAt: string
}

export type CMSProduct = CMSProductMeta & {
  markdown?: string
  html?: string
}

// D1用のProduct型
export type CMSProductRow = {
  slug: string
  name: string
  description: string
  language: string
  tags: string // JSON string
  url: string
  demo: string | null
  markdown: string | null
  html: string | null
  created_at: string
  updated_at: string
}

// 定数
export const DEFAULT_ORIGIN = 'https://haroin57.com'
export const RL_TTL_SECONDS = 60
export const MAX_THREADS = 100
export const MAX_POSTS_PER_THREAD = 1000
export const POST_RATE_LIMIT_TTL = 60
export const THREAD_RATE_LIMIT_TTL = 60
