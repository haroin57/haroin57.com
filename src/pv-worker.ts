// PVカウンター + Goodボタン + BBS + CMS用の Worker。/api/pv, /api/good, /api/bbs, /api/cms を扱う。

type KVNamespace = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
  delete: (key: string) => Promise<void>
}

type R2Bucket = {
  put: (key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }) => Promise<void>
  get: (key: string) => Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>
  delete: (key: string) => Promise<void>
}

type Env = {
  HAROIN_PV: KVNamespace
  CMS_IMAGES?: R2Bucket // R2バケット（画像アップロード用）
  ALLOWED_ORIGIN?: string
  ADMIN_SECRET?: string // 管理者用シークレットキー（フォールバック用）
  FIREBASE_PROJECT_ID?: string // Firebase プロジェクトID
  ADMIN_EMAILS?: string // 管理者メールアドレス（カンマ区切り）
  R2_PUBLIC_URL?: string // R2の公開URL
}

// Firebase IDトークンのヘッダー型
type FirebaseTokenHeader = {
  alg: string
  kid: string
  typ: string
}

// Firebase IDトークンのペイロード型
type FirebaseTokenPayload = {
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
type PublicKeyCache = {
  keys: Record<string, CryptoKey>
  expiresAt: number
}

let publicKeyCache: PublicKeyCache | null = null
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// BBS型定義
type Thread = {
  id: string
  title: string
  createdAt: string
  createdBy: string
  postCount: number
  lastPostAt: string
}

type Post = {
  id: number
  name: string
  date: string
  userId: string
  content: string
}

// CMS型定義
type CMSPostMeta = {
  slug: string
  title: string
  summary: string
  createdAt: string
  updatedAt: string
  tags: string[]
  status: 'draft' | 'published'
}

type CMSPost = CMSPostMeta & {
  markdown: string
  html: string
}

type CMSProductMeta = {
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

type CMSProduct = CMSProductMeta & {
  markdown?: string
  html?: string
}

const DEFAULT_ORIGIN = 'https://haroin57.com'
const RL_TTL_SECONDS = 60
const MAX_THREADS = 100
const MAX_POSTS_PER_THREAD = 1000
const POST_RATE_LIMIT_TTL = 60
const THREAD_RATE_LIMIT_TTL = 60

function buildCorsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-Admin-Secret, Authorization',
  }
}

// ユーザーIDを生成（IPベースで固定）
function generateUserId(ip: string): string {
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
function formatDate(): string {
  // UTC から JST（UTC+9）に変換
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
function generateThreadId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
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
  } catch {
    return new Response('bad request', { status: 400, headers: corsHeaders })
  }

  const slug = payload.slug?.trim()
  const actionRaw = payload.action?.toLowerCase()
  const action = actionRaw === 'vote' ? 'vote' : actionRaw === 'unvote' ? 'unvote' : 'get'
  if (!slug) {
    return new Response('missing slug', { status: 400, headers: corsHeaders })
  }

  const countKey = `good:${slug}:count`
  const ipKey = `good:${slug}:ip:${ip}`

  const current = Number((await env.HAROIN_PV.get(countKey)) ?? '0') || 0
  const alreadyVoted = Boolean(await env.HAROIN_PV.get(ipKey))

  if (action === 'get' || (action === 'vote' && alreadyVoted)) {
    return new Response(JSON.stringify({ total: current, voted: alreadyVoted }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  if (action === 'unvote') {
    const next = Math.max(0, current - 1)
    await env.HAROIN_PV.put(countKey, String(next))
    await env.HAROIN_PV.delete(ipKey)
    console.log('good unvote', { ip, slug, total: next })
    return new Response(JSON.stringify({ total: next, voted: false }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // vote
  const next = current + 1
  await env.HAROIN_PV.put(countKey, String(next))
  await env.HAROIN_PV.put(ipKey, '1')

  console.log('good ok', { ip, slug, total: next })

  return new Response(JSON.stringify({ total: next, voted: true }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// BBS: スレッド一覧取得
async function handleGetThreads(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const threadsJson = await env.HAROIN_PV.get('bbs:threads:list')
  const threads: Thread[] = threadsJson ? JSON.parse(threadsJson) : []

  // 最新投稿順にソート
  threads.sort((a, b) => new Date(b.lastPostAt).getTime() - new Date(a.lastPostAt).getTime())

  return new Response(JSON.stringify({ threads }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// BBS: スレッド作成
async function handleCreateThread(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown'

  // レート制限
  const rlKey = `bbs:rl:thread:${ip}`
  const alreadyLimited = await env.HAROIN_PV.get(rlKey)
  if (alreadyLimited) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: { title?: string; name?: string; content?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const title = payload.title?.trim().slice(0, 100)
  const name = payload.name?.trim().slice(0, 50) || '名無しさん'
  const content = payload.content?.trim().slice(0, 2000)

  if (!title || !content) {
    return new Response(JSON.stringify({ error: 'title and content required' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // スレッド数制限
  const threadsJson = await env.HAROIN_PV.get('bbs:threads:list')
  const threads: Thread[] = threadsJson ? JSON.parse(threadsJson) : []
  if (threads.length >= MAX_THREADS) {
    return new Response(JSON.stringify({ error: 'max threads reached' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const threadId = generateThreadId()
  const now = new Date().toISOString()
  const userId = generateUserId(ip)

  // 最初の投稿
  const firstPost: Post = {
    id: 1,
    name,
    date: formatDate(),
    userId,
    content,
  }

  // スレッドメタ情報
  const thread: Thread = {
    id: threadId,
    title,
    createdAt: now,
    createdBy: name,
    postCount: 1,
    lastPostAt: now,
  }

  // 保存
  threads.unshift(thread)
  await env.HAROIN_PV.put('bbs:threads:list', JSON.stringify(threads))
  await env.HAROIN_PV.put(`bbs:thread:${threadId}:posts`, JSON.stringify([firstPost]))
  await env.HAROIN_PV.put(`bbs:thread:${threadId}:meta`, JSON.stringify(thread))

  // レート制限設定
  await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: THREAD_RATE_LIMIT_TTL })

  console.log('bbs thread created', { ip, threadId, title })

  return new Response(JSON.stringify({ thread, posts: [firstPost] }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// BBS: スレッド取得
async function handleGetThread(
  threadId: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const metaJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:meta`)
  if (!metaJson) {
    return new Response(JSON.stringify({ error: 'thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const thread: Thread = JSON.parse(metaJson)
  const postsJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:posts`)
  const posts: Post[] = postsJson ? JSON.parse(postsJson) : []

  return new Response(JSON.stringify({ thread, posts }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// BBS: 投稿追加
async function handleAddPost(
  threadId: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown'

  // レート制限
  const rlKey = `bbs:rl:post:${ip}`
  const alreadyLimited = await env.HAROIN_PV.get(rlKey)
  if (alreadyLimited) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // スレッド存在確認
  const metaJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:meta`)
  if (!metaJson) {
    return new Response(JSON.stringify({ error: 'thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: { name?: string; content?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const name = payload.name?.trim().slice(0, 50) || '名無しさん'
  const content = payload.content?.trim().slice(0, 2000)

  if (!content) {
    return new Response(JSON.stringify({ error: 'content required' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const postsJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:posts`)
  const posts: Post[] = postsJson ? JSON.parse(postsJson) : []

  if (posts.length >= MAX_POSTS_PER_THREAD) {
    return new Response(JSON.stringify({ error: 'max posts reached' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const userId = generateUserId(ip)
  const newPost: Post = {
    id: posts.length + 1,
    name,
    date: formatDate(),
    userId,
    content,
  }

  posts.push(newPost)

  // スレッドメタ更新
  const thread: Thread = JSON.parse(metaJson)
  thread.postCount = posts.length
  thread.lastPostAt = new Date().toISOString()

  // スレッド一覧も更新
  const threadsJson = await env.HAROIN_PV.get('bbs:threads:list')
  const threads: Thread[] = threadsJson ? JSON.parse(threadsJson) : []
  const idx = threads.findIndex((t) => t.id === threadId)
  if (idx !== -1) {
    threads[idx] = thread
  }

  // 保存
  await env.HAROIN_PV.put(`bbs:thread:${threadId}:posts`, JSON.stringify(posts))
  await env.HAROIN_PV.put(`bbs:thread:${threadId}:meta`, JSON.stringify(thread))
  await env.HAROIN_PV.put('bbs:threads:list', JSON.stringify(threads))

  // レート制限設定
  await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: POST_RATE_LIMIT_TTL })

  console.log('bbs post added', { ip, threadId, postId: newPost.id })

  return new Response(JSON.stringify({ post: newPost, thread }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// Base64URLデコード（文字列として）
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}

// Base64URLデコード（バイナリとして）
function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// PEM形式の証明書からCryptoKeyを生成
async function importPublicKeyFromCert(pem: string): Promise<CryptoKey> {
  // PEMヘッダー/フッターを削除してBase64デコード
  const pemContents = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  const binaryDer = atob(pemContents)
  const bytes = new Uint8Array(binaryDer.length)
  for (let i = 0; i < binaryDer.length; i++) {
    bytes[i] = binaryDer.charCodeAt(i)
  }

  // X.509証明書からSPKI形式の公開鍵を抽出
  // 証明書のTBSCertificate内のsubjectPublicKeyInfoを探す
  const spki = extractSpkiFromCertificate(bytes)

  return await crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
}

// X.509証明書からSPKI（公開鍵情報）を抽出
function extractSpkiFromCertificate(certBytes: Uint8Array): ArrayBuffer {
  // ASN.1 DER形式のX.509証明書をパース
  // 証明書構造: SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
  // tbsCertificate内のsubjectPublicKeyInfo（7番目のフィールド）を抽出

  let offset = 0

  // 外側のSEQUENCE
  if (certBytes[offset] !== 0x30) throw new Error('Invalid certificate: expected SEQUENCE')
  offset++
  const [, outerLen] = readAsn1Length(certBytes, offset)
  offset += outerLen

  // tbsCertificate SEQUENCE
  if (certBytes[offset] !== 0x30) throw new Error('Invalid tbsCertificate: expected SEQUENCE')
  offset++
  const [, tbsLenBytes] = readAsn1Length(certBytes, offset)
  offset += tbsLenBytes

  // version [0] (optional)
  if (certBytes[offset] === 0xa0) {
    offset++
    const [vLen, vLenBytes] = readAsn1Length(certBytes, offset)
    offset += vLenBytes + vLen
  }

  // serialNumber INTEGER
  offset = skipAsn1Element(certBytes, offset)

  // signature AlgorithmIdentifier
  offset = skipAsn1Element(certBytes, offset)

  // issuer Name
  offset = skipAsn1Element(certBytes, offset)

  // validity Validity
  offset = skipAsn1Element(certBytes, offset)

  // subject Name
  offset = skipAsn1Element(certBytes, offset)

  // subjectPublicKeyInfo - これが欲しい
  if (certBytes[offset] !== 0x30) throw new Error('Invalid subjectPublicKeyInfo')
  const spkiStart = offset
  offset = skipAsn1Element(certBytes, offset)
  const spkiEnd = offset

  return certBytes.slice(spkiStart, spkiEnd).buffer
}

// ASN.1長さフィールドを読み取り
function readAsn1Length(bytes: Uint8Array, offset: number): [number, number] {
  const first = bytes[offset]
  if (first < 0x80) {
    return [first, 1]
  }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | bytes[offset + 1 + i]
  }
  return [length, 1 + numBytes]
}

// ASN.1要素をスキップ
function skipAsn1Element(bytes: Uint8Array, offset: number): number {
  offset++ // タグをスキップ
  const [len, lenBytes] = readAsn1Length(bytes, offset)
  return offset + lenBytes + len
}

// Google公開鍵を取得（キャッシュ付き）
async function getGooglePublicKeys(): Promise<Record<string, CryptoKey>> {
  const now = Date.now()

  // キャッシュが有効な場合はそれを返す
  if (publicKeyCache && publicKeyCache.expiresAt > now) {
    return publicKeyCache.keys
  }

  // Googleから証明書を取得
  const response = await fetch(GOOGLE_CERTS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Google public keys: ${response.status}`)
  }

  // Cache-Controlヘッダーからmax-ageを取得
  const cacheControl = response.headers.get('Cache-Control') || ''
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600

  const certs = (await response.json()) as Record<string, string>
  const keys: Record<string, CryptoKey> = {}

  // 各証明書をCryptoKeyに変換
  for (const [kid, pem] of Object.entries(certs)) {
    try {
      keys[kid] = await importPublicKeyFromCert(pem)
    } catch (e) {
      console.error(`Failed to import key ${kid}:`, e)
    }
  }

  // キャッシュを更新
  publicKeyCache = {
    keys,
    expiresAt: now + maxAge * 1000,
  }

  return keys
}

// Firebase IDトークンを検証（RS256署名検証付き）
async function verifyFirebaseToken(token: string, env: Env): Promise<FirebaseTokenPayload | null> {
  try {
    // JWTの構造: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.log('Invalid token format')
      return null
    }

    // ヘッダーをデコード
    const header = JSON.parse(base64UrlDecode(parts[0])) as FirebaseTokenHeader

    // アルゴリズムチェック（RS256のみ許可）
    if (header.alg !== 'RS256') {
      console.log('Invalid algorithm:', header.alg)
      return null
    }

    // kidチェック
    if (!header.kid) {
      console.log('Missing kid in header')
      return null
    }

    // ペイロードをデコード
    const payload = JSON.parse(base64UrlDecode(parts[1])) as FirebaseTokenPayload
    const now = Math.floor(Date.now() / 1000)

    // 1. 有効期限チェック (exp)
    if (!payload.exp || payload.exp < now) {
      console.log('Token expired')
      return null
    }

    // 2. 発行時刻チェック (iat) - 過去である必要がある
    if (!payload.iat || payload.iat > now) {
      console.log('Invalid iat:', payload.iat)
      return null
    }

    // 3. 認証時刻チェック (auth_time) - 過去である必要がある
    if (!payload.auth_time || payload.auth_time > now) {
      console.log('Invalid auth_time:', payload.auth_time)
      return null
    }

    // 4. 発行者チェック (iss)
    const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
    if (payload.iss !== expectedIssuer) {
      console.log('Invalid issuer:', payload.iss)
      return null
    }

    // 5. オーディエンスチェック (aud)
    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
      console.log('Invalid audience:', payload.aud)
      return null
    }

    // 6. subチェック - 非空の文字列である必要がある
    if (!payload.sub || typeof payload.sub !== 'string') {
      console.log('Invalid sub')
      return null
    }

    // 7. メール検証済みチェック
    if (!payload.email_verified) {
      console.log('Email not verified')
      return null
    }

    // 8. 署名検証（RS256）
    const publicKeys = await getGooglePublicKeys()
    const publicKey = publicKeys[header.kid]
    if (!publicKey) {
      console.log('Public key not found for kid:', header.kid)
      return null
    }

    // 署名対象データ: header.payload
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const signature = base64UrlToArrayBuffer(parts[2])

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      signedData
    )

    if (!isValid) {
      console.log('Invalid signature')
      return null
    }

    return payload
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

// BBS: 管理者認証チェック（Firebase対応）
async function checkAdminAuth(req: Request, env: Env): Promise<boolean> {
  // まずBearerトークン（Firebase）をチェック
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyFirebaseToken(token, env)

    if (payload?.email) {
      // 管理者メールリストをチェック
      const adminEmails = (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase())
      if (adminEmails.includes(payload.email.toLowerCase())) {
        console.log('Admin authenticated via Firebase:', payload.email)
        return true
      }
      console.log('Email not in admin list:', payload.email)
    }
    return false
  }

  // フォールバック: X-Admin-Secret ヘッダー（後方互換性）
  const secret = req.headers.get('X-Admin-Secret')
  if (env.ADMIN_SECRET && secret === env.ADMIN_SECRET) {
    console.log('Admin authenticated via secret')
    return true
  }

  return false
}

// BBS: スレッド削除（管理者用）
async function handleDeleteThread(
  threadId: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // スレッド存在確認
  const metaJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:meta`)
  if (!metaJson) {
    return new Response(JSON.stringify({ error: 'thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // スレッド一覧から削除
  const threadsJson = await env.HAROIN_PV.get('bbs:threads:list')
  const threads: Thread[] = threadsJson ? JSON.parse(threadsJson) : []
  const newThreads = threads.filter((t) => t.id !== threadId)
  await env.HAROIN_PV.put('bbs:threads:list', JSON.stringify(newThreads))

  // スレッドデータ削除
  await env.HAROIN_PV.delete(`bbs:thread:${threadId}:meta`)
  await env.HAROIN_PV.delete(`bbs:thread:${threadId}:posts`)

  console.log('bbs thread deleted', { threadId })

  return new Response(JSON.stringify({ success: true, threadId }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// BBS: 投稿削除（管理者用）
async function handleDeletePost(
  threadId: string,
  postId: number,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // スレッド存在確認
  const metaJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:meta`)
  if (!metaJson) {
    return new Response(JSON.stringify({ error: 'thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const postsJson = await env.HAROIN_PV.get(`bbs:thread:${threadId}:posts`)
  const posts: Post[] = postsJson ? JSON.parse(postsJson) : []

  const postIndex = posts.findIndex((p) => p.id === postId)
  if (postIndex === -1) {
    return new Response(JSON.stringify({ error: 'post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // 投稿を削除（内容を削除済みに置換）
  posts[postIndex] = {
    ...posts[postIndex],
    name: '削除済み',
    content: 'この投稿は削除されました',
  }

  // 保存
  await env.HAROIN_PV.put(`bbs:thread:${threadId}:posts`, JSON.stringify(posts))

  console.log('bbs post deleted', { threadId, postId })

  return new Response(JSON.stringify({ success: true, threadId, postId }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// BBS ルーティング
async function handleBbs(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  pathname: string
): Promise<Response> {
  const pathParts = pathname.replace('/api/bbs', '').split('/').filter(Boolean)

  // POST /api/bbs/admin/verify - 管理者認証確認
  if (req.method === 'POST' && pathParts[0] === 'admin' && pathParts[1] === 'verify') {
    if (await checkAdminAuth(req, env)) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // GET /api/bbs/threads - スレッド一覧
  if (req.method === 'GET' && pathParts[0] === 'threads' && pathParts.length === 1) {
    return handleGetThreads(env, corsHeaders)
  }

  // POST /api/bbs/threads - スレッド作成
  if (req.method === 'POST' && pathParts[0] === 'threads' && pathParts.length === 1) {
    return handleCreateThread(req, env, corsHeaders)
  }

  // GET /api/bbs/threads/:id - スレッド取得
  if (req.method === 'GET' && pathParts[0] === 'threads' && pathParts.length === 2) {
    return handleGetThread(pathParts[1], env, corsHeaders)
  }

  // POST /api/bbs/threads/:id/posts - 投稿追加
  if (req.method === 'POST' && pathParts[0] === 'threads' && pathParts[2] === 'posts') {
    return handleAddPost(pathParts[1], req, env, corsHeaders)
  }

  // DELETE /api/bbs/threads/:id - スレッド削除（管理者用）
  if (req.method === 'DELETE' && pathParts[0] === 'threads' && pathParts.length === 2) {
    return handleDeleteThread(pathParts[1], req, env, corsHeaders)
  }

  // DELETE /api/bbs/threads/:id/posts/:postId - 投稿削除（管理者用）
  if (req.method === 'DELETE' && pathParts[0] === 'threads' && pathParts[2] === 'posts' && pathParts[3]) {
    const postId = parseInt(pathParts[3], 10)
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'invalid post id' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }
    return handleDeletePost(pathParts[1], postId, req, env, corsHeaders)
  }

  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// ============================================
// CMS: Posts/Products管理
// ============================================

// CMS: 記事一覧取得（公開済みのみ）
async function handleGetCMSPosts(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const listJson = await env.HAROIN_PV.get('cms:posts:list')
  const allPosts: CMSPostMeta[] = listJson ? JSON.parse(listJson) : []
  // 公開済みのみフィルタリング（statusがない古いデータは公開済みとみなす）
  const posts = allPosts.filter((p) => !p.status || p.status === 'published')
  // 作成日時の新しい順にソート
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return new Response(JSON.stringify({ posts }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 下書き一覧取得（管理者のみ）
async function handleGetCMSDrafts(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const listJson = await env.HAROIN_PV.get('cms:posts:list')
  const allPosts: CMSPostMeta[] = listJson ? JSON.parse(listJson) : []
  // 下書きのみフィルタリング
  const drafts = allPosts.filter((p) => p.status === 'draft')
  // 更新日時の新しい順にソート
  drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return new Response(JSON.stringify({ drafts }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 記事ステータス変更（管理者のみ）
async function handleUpdateCMSPostStatus(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existingJson = await env.HAROIN_PV.get(`cms:post:${slug}`)
  if (!existingJson) {
    return new Response(JSON.stringify({ error: 'post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: { status?: 'draft' | 'published' } = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  if (!payload.status || !['draft', 'published'].includes(payload.status)) {
    return new Response(JSON.stringify({ error: 'invalid status' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existing: CMSPost = JSON.parse(existingJson)
  const now = new Date().toISOString()
  const updated: CMSPost = {
    ...existing,
    status: payload.status,
    updatedAt: now,
  }

  await env.HAROIN_PV.put(`cms:post:${slug}`, JSON.stringify(updated))

  // 一覧のメタデータも更新
  const listJson = await env.HAROIN_PV.get('cms:posts:list')
  const posts: CMSPostMeta[] = listJson ? JSON.parse(listJson) : []
  const idx = posts.findIndex((p) => p.slug === slug)
  if (idx !== -1) {
    posts[idx] = { ...posts[idx], status: payload.status, updatedAt: now }
    await env.HAROIN_PV.put('cms:posts:list', JSON.stringify(posts))
  }

  console.log('cms post status updated', { slug, status: payload.status })

  return new Response(JSON.stringify({ success: true, status: payload.status }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 記事詳細取得
async function handleGetCMSPost(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const postJson = await env.HAROIN_PV.get(`cms:post:${slug}`)
  if (!postJson) {
    return new Response(JSON.stringify({ error: 'post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
  const post: CMSPost = JSON.parse(postJson)

  // 下書きは管理者のみ閲覧可能
  if (post.status === 'draft') {
    if (!(await checkAdminAuth(req, env))) {
      return new Response(JSON.stringify({ error: 'post not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ post }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 記事作成
async function handleCreateCMSPost(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: Partial<CMSPost> = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const { slug, title, summary, markdown, html, tags } = payload
  if (!slug || !title || !markdown || !html) {
    return new Response(JSON.stringify({ error: 'slug, title, markdown, and html are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // 重複チェック
  const existingPost = await env.HAROIN_PV.get(`cms:post:${slug}`)
  if (existingPost) {
    return new Response(JSON.stringify({ error: 'post with this slug already exists' }), {
      status: 409,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const now = new Date().toISOString()
  const status = payload.status || 'published'
  const post: CMSPost = {
    slug,
    title,
    summary: summary || '',
    markdown,
    html,
    tags: tags || [],
    status,
    createdAt: payload.createdAt || now,
    updatedAt: now,
  }

  // 記事データ保存
  await env.HAROIN_PV.put(`cms:post:${slug}`, JSON.stringify(post))

  // 一覧にメタデータ追加
  const listJson = await env.HAROIN_PV.get('cms:posts:list')
  const posts: CMSPostMeta[] = listJson ? JSON.parse(listJson) : []
  const meta: CMSPostMeta = { slug, title, summary: summary || '', tags: tags || [], status, createdAt: post.createdAt, updatedAt: now }
  posts.unshift(meta)
  await env.HAROIN_PV.put('cms:posts:list', JSON.stringify(posts))

  console.log('cms post created', { slug, title })

  return new Response(JSON.stringify({ post }), {
    status: 201,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 記事更新
async function handleUpdateCMSPost(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existingJson = await env.HAROIN_PV.get(`cms:post:${slug}`)
  if (!existingJson) {
    return new Response(JSON.stringify({ error: 'post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: Partial<CMSPost> = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existing: CMSPost = JSON.parse(existingJson)
  const now = new Date().toISOString()
  const updated: CMSPost = {
    ...existing,
    title: payload.title ?? existing.title,
    summary: payload.summary ?? existing.summary,
    markdown: payload.markdown ?? existing.markdown,
    html: payload.html ?? existing.html,
    tags: payload.tags ?? existing.tags,
    status: payload.status ?? existing.status ?? 'published',
    createdAt: payload.createdAt ?? existing.createdAt,
    updatedAt: now,
  }

  await env.HAROIN_PV.put(`cms:post:${slug}`, JSON.stringify(updated))

  // 一覧のメタデータも更新
  const listJson = await env.HAROIN_PV.get('cms:posts:list')
  const posts: CMSPostMeta[] = listJson ? JSON.parse(listJson) : []
  const idx = posts.findIndex((p) => p.slug === slug)
  if (idx !== -1) {
    posts[idx] = {
      slug,
      title: updated.title,
      summary: updated.summary,
      tags: updated.tags,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: now,
    }
    await env.HAROIN_PV.put('cms:posts:list', JSON.stringify(posts))
  }

  console.log('cms post updated', { slug })

  return new Response(JSON.stringify({ post: updated }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 記事削除
async function handleDeleteCMSPost(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existingJson = await env.HAROIN_PV.get(`cms:post:${slug}`)
  if (!existingJson) {
    return new Response(JSON.stringify({ error: 'post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  await env.HAROIN_PV.delete(`cms:post:${slug}`)

  // 一覧から削除
  const listJson = await env.HAROIN_PV.get('cms:posts:list')
  const posts: CMSPostMeta[] = listJson ? JSON.parse(listJson) : []
  const filtered = posts.filter((p) => p.slug !== slug)
  await env.HAROIN_PV.put('cms:posts:list', JSON.stringify(filtered))

  console.log('cms post deleted', { slug })

  return new Response(JSON.stringify({ success: true, slug }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: プロダクト一覧取得
async function handleGetCMSProducts(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const listJson = await env.HAROIN_PV.get('cms:products:list')
  const products: CMSProductMeta[] = listJson ? JSON.parse(listJson) : []
  return new Response(JSON.stringify({ products }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: プロダクト詳細取得
async function handleGetCMSProduct(slug: string, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const productJson = await env.HAROIN_PV.get(`cms:product:${slug}`)
  if (!productJson) {
    return new Response(JSON.stringify({ error: 'product not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
  const product: CMSProduct = JSON.parse(productJson)
  return new Response(JSON.stringify({ product }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: プロダクト作成
async function handleCreateCMSProduct(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: Partial<CMSProduct> = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const { slug, name, description, language, url } = payload
  if (!slug || !name || !description || !language || !url) {
    return new Response(JSON.stringify({ error: 'slug, name, description, language, and url are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // 重複チェック
  const existing = await env.HAROIN_PV.get(`cms:product:${slug}`)
  if (existing) {
    return new Response(JSON.stringify({ error: 'product with this slug already exists' }), {
      status: 409,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const now = new Date().toISOString()
  const product: CMSProduct = {
    slug,
    name,
    description,
    language,
    tags: payload.tags || [],
    url,
    demo: payload.demo,
    markdown: payload.markdown,
    html: payload.html,
    createdAt: now,
    updatedAt: now,
  }

  await env.HAROIN_PV.put(`cms:product:${slug}`, JSON.stringify(product))

  // 一覧にメタデータ追加
  const listJson = await env.HAROIN_PV.get('cms:products:list')
  const products: CMSProductMeta[] = listJson ? JSON.parse(listJson) : []
  const meta: CMSProductMeta = {
    slug, name, description, language, tags: payload.tags || [], url, demo: payload.demo, createdAt: now, updatedAt: now
  }
  products.unshift(meta)
  await env.HAROIN_PV.put('cms:products:list', JSON.stringify(products))

  console.log('cms product created', { slug, name })

  return new Response(JSON.stringify({ product }), {
    status: 201,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: プロダクト更新
async function handleUpdateCMSProduct(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existingJson = await env.HAROIN_PV.get(`cms:product:${slug}`)
  if (!existingJson) {
    return new Response(JSON.stringify({ error: 'product not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let payload: Partial<CMSProduct> = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existing: CMSProduct = JSON.parse(existingJson)
  const now = new Date().toISOString()
  const updated: CMSProduct = {
    ...existing,
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    language: payload.language ?? existing.language,
    tags: payload.tags ?? existing.tags,
    url: payload.url ?? existing.url,
    demo: payload.demo ?? existing.demo,
    markdown: payload.markdown ?? existing.markdown,
    html: payload.html ?? existing.html,
    updatedAt: now,
  }

  await env.HAROIN_PV.put(`cms:product:${slug}`, JSON.stringify(updated))

  // 一覧のメタデータも更新
  const listJson = await env.HAROIN_PV.get('cms:products:list')
  const products: CMSProductMeta[] = listJson ? JSON.parse(listJson) : []
  const idx = products.findIndex((p) => p.slug === slug)
  if (idx !== -1) {
    products[idx] = {
      slug,
      name: updated.name,
      description: updated.description,
      language: updated.language,
      tags: updated.tags,
      url: updated.url,
      demo: updated.demo,
      createdAt: updated.createdAt,
      updatedAt: now,
    }
    await env.HAROIN_PV.put('cms:products:list', JSON.stringify(products))
  }

  console.log('cms product updated', { slug })

  return new Response(JSON.stringify({ product: updated }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: プロダクト削除
async function handleDeleteCMSProduct(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const existingJson = await env.HAROIN_PV.get(`cms:product:${slug}`)
  if (!existingJson) {
    return new Response(JSON.stringify({ error: 'product not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  await env.HAROIN_PV.delete(`cms:product:${slug}`)

  // 一覧から削除
  const listJson = await env.HAROIN_PV.get('cms:products:list')
  const products: CMSProductMeta[] = listJson ? JSON.parse(listJson) : []
  const filtered = products.filter((p) => p.slug !== slug)
  await env.HAROIN_PV.put('cms:products:list', JSON.stringify(filtered))

  console.log('cms product deleted', { slug })

  return new Response(JSON.stringify({ success: true, slug }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 画像アップロード
async function handleUploadImage(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  if (!env.CMS_IMAGES) {
    return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    return new Response(JSON.stringify({ error: 'content-type must be an image type' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // ファイル名を生成
  const ext = contentType.split('/')[1] || 'png'
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const body = await req.arrayBuffer()
  await env.CMS_IMAGES.put(key, body, {
    httpMetadata: { contentType },
  })

  const publicUrl = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : key

  console.log('cms image uploaded', { key, contentType, size: body.byteLength })

  return new Response(JSON.stringify({ key, url: publicUrl }), {
    status: 201,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS: 画像削除
async function handleDeleteImage(
  key: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  if (!env.CMS_IMAGES) {
    return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  await env.CMS_IMAGES.delete(key)

  console.log('cms image deleted', { key })

  return new Response(JSON.stringify({ success: true, key }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// CMS ルーティング
async function handleCms(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  pathname: string
): Promise<Response> {
  const pathParts = pathname.replace('/api/cms', '').split('/').filter(Boolean)

  // Posts
  if (pathParts[0] === 'posts') {
    // GET /api/cms/posts - 記事一覧（公開済みのみ）
    if (req.method === 'GET' && pathParts.length === 1) {
      return handleGetCMSPosts(env, corsHeaders)
    }
    // GET /api/cms/posts/drafts - 下書き一覧（管理者のみ）
    if (req.method === 'GET' && pathParts[1] === 'drafts' && pathParts.length === 2) {
      return handleGetCMSDrafts(req, env, corsHeaders)
    }
    // POST /api/cms/posts - 記事作成
    if (req.method === 'POST' && pathParts.length === 1) {
      return handleCreateCMSPost(req, env, corsHeaders)
    }
    // GET /api/cms/posts/:slug - 記事詳細
    if (req.method === 'GET' && pathParts.length === 2) {
      return handleGetCMSPost(pathParts[1], req, env, corsHeaders)
    }
    // PUT /api/cms/posts/:slug - 記事更新
    if (req.method === 'PUT' && pathParts.length === 2) {
      return handleUpdateCMSPost(pathParts[1], req, env, corsHeaders)
    }
    // PATCH /api/cms/posts/:slug/status - ステータス変更（管理者のみ）
    if (req.method === 'PATCH' && pathParts[2] === 'status' && pathParts.length === 3) {
      return handleUpdateCMSPostStatus(pathParts[1], req, env, corsHeaders)
    }
    // DELETE /api/cms/posts/:slug - 記事削除
    if (req.method === 'DELETE' && pathParts.length === 2) {
      return handleDeleteCMSPost(pathParts[1], req, env, corsHeaders)
    }
  }

  // Products
  if (pathParts[0] === 'products') {
    // GET /api/cms/products - プロダクト一覧
    if (req.method === 'GET' && pathParts.length === 1) {
      return handleGetCMSProducts(env, corsHeaders)
    }
    // POST /api/cms/products - プロダクト作成
    if (req.method === 'POST' && pathParts.length === 1) {
      return handleCreateCMSProduct(req, env, corsHeaders)
    }
    // GET /api/cms/products/:slug - プロダクト詳細
    if (req.method === 'GET' && pathParts.length === 2) {
      return handleGetCMSProduct(pathParts[1], env, corsHeaders)
    }
    // PUT /api/cms/products/:slug - プロダクト更新
    if (req.method === 'PUT' && pathParts.length === 2) {
      return handleUpdateCMSProduct(pathParts[1], req, env, corsHeaders)
    }
    // DELETE /api/cms/products/:slug - プロダクト削除
    if (req.method === 'DELETE' && pathParts.length === 2) {
      return handleDeleteCMSProduct(pathParts[1], req, env, corsHeaders)
    }
  }

  // Upload
  if (pathParts[0] === 'upload') {
    // POST /api/cms/upload - 画像アップロード
    if (req.method === 'POST' && pathParts.length === 1) {
      return handleUploadImage(req, env, corsHeaders)
    }
    // DELETE /api/cms/upload/:key - 画像削除
    if (req.method === 'DELETE' && pathParts.length === 2) {
      return handleDeleteImage(pathParts[1], req, env, corsHeaders)
    }
  }

  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

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
    const origin = req.headers.get('origin') || ''
    const referer = req.headers.get('referer') || ''
    const corsHeaders = buildCorsHeaders(allowedOrigin)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Origin / Referer チェック
    const isAllowed =
      origin === allowedOrigin ||
      (origin === '' && referer.startsWith(allowedOrigin)) ||
      (origin === '' && referer === '')
    if (!isAllowed) {
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
      if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'DELETE') {
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
