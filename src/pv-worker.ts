// PVカウンター + Goodボタン + BBS用の Worker。/api/pv, /api/good, /api/bbs を扱う。

type KVNamespace = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
  delete: (key: string) => Promise<void>
}

type Env = {
  HAROIN_PV: KVNamespace
  ALLOWED_ORIGIN?: string
}

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

const DEFAULT_ORIGIN = 'https://haroin57.com'
const RL_TTL_SECONDS = 60
const MAX_THREADS = 100
const MAX_POSTS_PER_THREAD = 1000
const POST_RATE_LIMIT_TTL = 30
const THREAD_RATE_LIMIT_TTL = 60

function buildCorsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  }
}

// ユーザーIDを生成（IPベース、日替わり）
function generateUserId(ip: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const hash = simpleHash(`${ip}:${today}`)
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

// 日時フォーマット（2ch形式）
function formatDate(): string {
  const now = new Date()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dayOfWeek = days[now.getDay()]
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).slice(0, 2).padStart(2, '0')
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

// BBS ルーティング
async function handleBbs(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  pathname: string
): Promise<Response> {
  const pathParts = pathname.replace('/api/bbs', '').split('/').filter(Boolean)

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

    if (!isPv && !isGood && !isBbs) {
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

    // BBS は GET も許可
    if (isBbs) {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
      }
      return handleBbs(req, env, corsHeaders, url.pathname)
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
