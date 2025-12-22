// BBS API

import type { Env, Thread, BBSPost, ThreadRow, BBSPostRow } from './types'
import { MAX_THREADS, MAX_POSTS_PER_THREAD, POST_RATE_LIMIT_TTL, THREAD_RATE_LIMIT_TTL } from './types'
import { checkAdminAuth } from './auth'
import { jsonResponse, errorResponse, generateUserId, formatDate, generateThreadId } from './utils'

// D1の行をThread型に変換
function rowToThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    createdBy: row.created_by,
    postCount: row.post_count,
    lastPostAt: row.last_post_at,
  }
}

// D1の行をBBSPost型に変換
function rowToPost(row: BBSPostRow): BBSPost {
  if (row.is_deleted) {
    return {
      id: row.post_number,
      name: '削除済み',
      date: row.date,
      userId: row.user_id,
      content: 'この投稿は削除されました',
    }
  }
  return {
    id: row.post_number,
    name: row.name,
    date: row.date,
    userId: row.user_id,
    content: row.content,
  }
}

// スレッド一覧取得
async function handleGetThreads(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const result = await env.BBS_DB.prepare(
    `SELECT * FROM bbs_threads ORDER BY last_post_at DESC`
  ).all<ThreadRow>()

  const threads = (result.results || []).map(rowToThread)
  return jsonResponse({ threads }, corsHeaders)
}

// スレッド作成
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
    return errorResponse('rate limited', corsHeaders, 429)
  }

  let payload: { title?: string; name?: string; content?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const title = payload.title?.trim().slice(0, 100)
  const name = payload.name?.trim().slice(0, 50) || '名無しさん'
  const content = payload.content?.trim().slice(0, 2000)

  if (!title || !content) {
    return errorResponse('title and content required', corsHeaders)
  }

  // スレッド数制限
  const countResult = await env.BBS_DB.prepare(
    `SELECT COUNT(*) as count FROM bbs_threads`
  ).first<{ count: number }>()

  if (countResult && countResult.count >= MAX_THREADS) {
    return errorResponse('max threads reached', corsHeaders)
  }

  const threadId = generateThreadId()
  const now = new Date().toISOString()
  const userId = generateUserId(ip)
  const dateStr = formatDate()

  // トランザクション（D1ではbatchを使用）
  await env.BBS_DB.batch([
    env.BBS_DB.prepare(
      `INSERT INTO bbs_threads (id, title, created_at, created_by, post_count, last_post_at)
       VALUES (?, ?, ?, ?, 1, ?)`
    ).bind(threadId, title, now, name, now),
    env.BBS_DB.prepare(
      `INSERT INTO bbs_posts (thread_id, post_number, name, date, user_id, content)
       VALUES (?, 1, ?, ?, ?, ?)`
    ).bind(threadId, name, dateStr, userId, content),
  ])

  // レート制限設定
  await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: THREAD_RATE_LIMIT_TTL })

  console.log('bbs thread created', { ip, threadId, title })

  const thread: Thread = {
    id: threadId,
    title,
    createdAt: now,
    createdBy: name,
    postCount: 1,
    lastPostAt: now,
  }

  const firstPost: BBSPost = {
    id: 1,
    name,
    date: dateStr,
    userId,
    content,
  }

  return jsonResponse({ thread, posts: [firstPost] }, corsHeaders)
}

// スレッド取得
async function handleGetThread(
  threadId: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const threadResult = await env.BBS_DB.prepare(
    `SELECT * FROM bbs_threads WHERE id = ?`
  ).bind(threadId).first<ThreadRow>()

  if (!threadResult) {
    return errorResponse('thread not found', corsHeaders, 404)
  }

  const postsResult = await env.BBS_DB.prepare(
    `SELECT * FROM bbs_posts WHERE thread_id = ? ORDER BY post_number`
  ).bind(threadId).all<BBSPostRow>()

  const thread = rowToThread(threadResult)
  const posts = (postsResult.results || []).map(rowToPost)

  return jsonResponse({ thread, posts }, corsHeaders)
}

// 投稿追加
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
    return errorResponse('rate limited', corsHeaders, 429)
  }

  // スレッド存在確認
  const threadResult = await env.BBS_DB.prepare(
    `SELECT * FROM bbs_threads WHERE id = ?`
  ).bind(threadId).first<ThreadRow>()

  if (!threadResult) {
    return errorResponse('thread not found', corsHeaders, 404)
  }

  let payload: { name?: string; content?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const name = payload.name?.trim().slice(0, 50) || '名無しさん'
  const content = payload.content?.trim().slice(0, 2000)

  if (!content) {
    return errorResponse('content required', corsHeaders)
  }

  // 投稿数制限
  if (threadResult.post_count >= MAX_POSTS_PER_THREAD) {
    return errorResponse('max posts reached', corsHeaders)
  }

  const userId = generateUserId(ip)
  const dateStr = formatDate()
  const now = new Date().toISOString()
  const newPostNumber = threadResult.post_count + 1

  // トランザクション
  await env.BBS_DB.batch([
    env.BBS_DB.prepare(
      `INSERT INTO bbs_posts (thread_id, post_number, name, date, user_id, content)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(threadId, newPostNumber, name, dateStr, userId, content),
    env.BBS_DB.prepare(
      `UPDATE bbs_threads SET post_count = ?, last_post_at = ? WHERE id = ?`
    ).bind(newPostNumber, now, threadId),
  ])

  // レート制限設定
  await env.HAROIN_PV.put(rlKey, '1', { expirationTtl: POST_RATE_LIMIT_TTL })

  console.log('bbs post added', { ip, threadId, postId: newPostNumber })

  const newPost: BBSPost = {
    id: newPostNumber,
    name,
    date: dateStr,
    userId,
    content,
  }

  const thread: Thread = {
    ...rowToThread(threadResult),
    postCount: newPostNumber,
    lastPostAt: now,
  }

  return jsonResponse({ post: newPost, thread }, corsHeaders)
}

// スレッド削除（管理者用）
async function handleDeleteThread(
  threadId: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const threadResult = await env.BBS_DB.prepare(
    `SELECT id FROM bbs_threads WHERE id = ?`
  ).bind(threadId).first()

  if (!threadResult) {
    return errorResponse('thread not found', corsHeaders, 404)
  }

  // CASCADE削除（投稿も削除される）
  await env.BBS_DB.prepare(`DELETE FROM bbs_threads WHERE id = ?`).bind(threadId).run()

  console.log('bbs thread deleted', { threadId })

  return jsonResponse({ success: true, threadId }, corsHeaders)
}

// 投稿削除（管理者用）
async function handleDeletePost(
  threadId: string,
  postId: number,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const threadResult = await env.BBS_DB.prepare(
    `SELECT id FROM bbs_threads WHERE id = ?`
  ).bind(threadId).first()

  if (!threadResult) {
    return errorResponse('thread not found', corsHeaders, 404)
  }

  const postResult = await env.BBS_DB.prepare(
    `SELECT id FROM bbs_posts WHERE thread_id = ? AND post_number = ?`
  ).bind(threadId, postId).first()

  if (!postResult) {
    return errorResponse('post not found', corsHeaders, 404)
  }

  // 削除済みフラグを立てる（完全削除ではない）
  await env.BBS_DB.prepare(
    `UPDATE bbs_posts SET is_deleted = 1 WHERE thread_id = ? AND post_number = ?`
  ).bind(threadId, postId).run()

  console.log('bbs post deleted', { threadId, postId })

  return jsonResponse({ success: true, threadId, postId }, corsHeaders)
}

// BBS ルーティング
export async function handleBbs(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  pathname: string
): Promise<Response> {
  const pathParts = pathname.replace('/api/bbs', '').split('/').filter(Boolean)

  // POST /api/bbs/admin/verify - 管理者認証確認
  if (req.method === 'POST' && pathParts[0] === 'admin' && pathParts[1] === 'verify') {
    if (await checkAdminAuth(req, env)) {
      return jsonResponse({ success: true }, corsHeaders)
    }
    return errorResponse('unauthorized', corsHeaders, 401)
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
      return errorResponse('invalid post id', corsHeaders)
    }
    return handleDeletePost(pathParts[1], postId, req, env, corsHeaders)
  }

  return errorResponse('not found', corsHeaders, 404)
}
