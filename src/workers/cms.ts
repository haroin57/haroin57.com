// CMS API (Posts/Products管理)

import type { Env, CMSPost, CMSPostMeta, CMSProduct, CMSProductMeta, CMSPostRow, CMSProductRow } from './types'
import { checkAdminAuth } from './auth'
import { jsonResponse, errorResponse } from './utils'

// D1の行をCMSPost型に変換
function rowToPost(row: CMSPostRow): CMSPost {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    markdown: row.markdown,
    html: row.html,
    tags: JSON.parse(row.tags),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToPostMeta(row: CMSPostRow): CMSPostMeta {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    tags: JSON.parse(row.tags),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToProduct(row: CMSProductRow): CMSProduct {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    language: row.language,
    tags: JSON.parse(row.tags),
    url: row.url,
    demo: row.demo || undefined,
    markdown: row.markdown || undefined,
    html: row.html || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToProductMeta(row: CMSProductRow): CMSProductMeta {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    language: row.language,
    tags: JSON.parse(row.tags),
    url: row.url,
    demo: row.demo || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// 記事一覧取得（公開済みのみ）
async function handleGetPosts(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const result = await env.POSTS_DB.prepare(
    `SELECT slug, title, summary, tags, status, created_at, updated_at
     FROM posts WHERE status = 'published' ORDER BY created_at DESC`
  ).all<CMSPostRow>()

  const posts = (result.results || []).map(rowToPostMeta)
  return jsonResponse({ posts }, corsHeaders)
}

// 下書き一覧取得（管理者のみ）
async function handleGetDrafts(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const result = await env.POSTS_DB.prepare(
    `SELECT slug, title, summary, tags, status, created_at, updated_at
     FROM posts WHERE status = 'draft' ORDER BY updated_at DESC`
  ).all<CMSPostRow>()

  const drafts = (result.results || []).map(rowToPostMeta)
  return jsonResponse({ drafts }, corsHeaders)
}

// 記事詳細取得
async function handleGetPost(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const result = await env.POSTS_DB.prepare(
    `SELECT * FROM posts WHERE slug = ?`
  ).bind(slug).first<CMSPostRow>()

  if (!result) {
    return errorResponse('post not found', corsHeaders, 404)
  }

  // 下書きは管理者のみ閲覧可能
  if (result.status === 'draft') {
    if (!(await checkAdminAuth(req, env))) {
      return errorResponse('post not found', corsHeaders, 404)
    }
  }

  return jsonResponse({ post: rowToPost(result) }, corsHeaders)
}

// 記事作成
async function handleCreatePost(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  let payload: Partial<CMSPost> = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const { slug, title, summary, markdown, html, tags, status } = payload
  if (!slug || !title || !markdown || !html) {
    return errorResponse('slug, title, markdown, and html are required', corsHeaders)
  }

  // 重複チェック
  const existing = await env.POSTS_DB.prepare(
    `SELECT slug FROM posts WHERE slug = ?`
  ).bind(slug).first()

  if (existing) {
    return errorResponse('post with this slug already exists', corsHeaders, 409)
  }

  const now = new Date().toISOString()
  const postStatus = status || 'published'

  await env.POSTS_DB.prepare(
    `INSERT INTO posts (slug, title, summary, markdown, html, tags, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    slug,
    title,
    summary || '',
    markdown,
    html,
    JSON.stringify(tags || []),
    postStatus,
    payload.createdAt || now,
    now
  ).run()

  console.log('cms post created', { slug, title })

  const post: CMSPost = {
    slug,
    title,
    summary: summary || '',
    markdown,
    html,
    tags: tags || [],
    status: postStatus,
    createdAt: payload.createdAt || now,
    updatedAt: now,
  }

  return jsonResponse({ post }, corsHeaders, 201)
}

// 記事更新
async function handleUpdatePost(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const existing = await env.POSTS_DB.prepare(
    `SELECT * FROM posts WHERE slug = ?`
  ).bind(slug).first<CMSPostRow>()

  if (!existing) {
    return errorResponse('post not found', corsHeaders, 404)
  }

  let payload: Partial<CMSPost> = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const now = new Date().toISOString()

  await env.POSTS_DB.prepare(
    `UPDATE posts SET
       title = ?, summary = ?, markdown = ?, html = ?, tags = ?, status = ?, created_at = ?, updated_at = ?
     WHERE slug = ?`
  ).bind(
    payload.title ?? existing.title,
    payload.summary ?? existing.summary,
    payload.markdown ?? existing.markdown,
    payload.html ?? existing.html,
    JSON.stringify(payload.tags ?? JSON.parse(existing.tags)),
    payload.status ?? existing.status,
    payload.createdAt ?? existing.created_at,
    now,
    slug
  ).run()

  console.log('cms post updated', { slug })

  const updated = await env.POSTS_DB.prepare(
    `SELECT * FROM posts WHERE slug = ?`
  ).bind(slug).first<CMSPostRow>()

  return jsonResponse({ post: rowToPost(updated!) }, corsHeaders)
}

// 記事ステータス変更
async function handleUpdatePostStatus(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const existing = await env.POSTS_DB.prepare(
    `SELECT slug FROM posts WHERE slug = ?`
  ).bind(slug).first()

  if (!existing) {
    return errorResponse('post not found', corsHeaders, 404)
  }

  let payload: { status?: 'draft' | 'published' } = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  if (!payload.status || !['draft', 'published'].includes(payload.status)) {
    return errorResponse('invalid status', corsHeaders)
  }

  const now = new Date().toISOString()

  await env.POSTS_DB.prepare(
    `UPDATE posts SET status = ?, updated_at = ? WHERE slug = ?`
  ).bind(payload.status, now, slug).run()

  console.log('cms post status updated', { slug, status: payload.status })

  return jsonResponse({ success: true, status: payload.status }, corsHeaders)
}

// 記事削除
async function handleDeletePost(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const existing = await env.POSTS_DB.prepare(
    `SELECT slug FROM posts WHERE slug = ?`
  ).bind(slug).first()

  if (!existing) {
    return errorResponse('post not found', corsHeaders, 404)
  }

  await env.POSTS_DB.prepare(`DELETE FROM posts WHERE slug = ?`).bind(slug).run()

  console.log('cms post deleted', { slug })

  return jsonResponse({ success: true, slug }, corsHeaders)
}

// プロダクト一覧取得
async function handleGetProducts(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const result = await env.POSTS_DB.prepare(
    `SELECT slug, name, description, language, tags, url, demo, created_at, updated_at
     FROM products ORDER BY created_at DESC`
  ).all<CMSProductRow>()

  const products = (result.results || []).map(rowToProductMeta)
  return jsonResponse({ products }, corsHeaders)
}

// プロダクト詳細取得
async function handleGetProduct(
  slug: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const result = await env.POSTS_DB.prepare(
    `SELECT * FROM products WHERE slug = ?`
  ).bind(slug).first<CMSProductRow>()

  if (!result) {
    return errorResponse('product not found', corsHeaders, 404)
  }

  return jsonResponse({ product: rowToProduct(result) }, corsHeaders)
}

// プロダクト作成
async function handleCreateProduct(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  let payload: Partial<CMSProduct> = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const { slug, name, description, language, url } = payload
  if (!slug || !name || !description || !language || !url) {
    return errorResponse('slug, name, description, language, and url are required', corsHeaders)
  }

  const existing = await env.POSTS_DB.prepare(
    `SELECT slug FROM products WHERE slug = ?`
  ).bind(slug).first()

  if (existing) {
    return errorResponse('product with this slug already exists', corsHeaders, 409)
  }

  const now = new Date().toISOString()

  await env.POSTS_DB.prepare(
    `INSERT INTO products (slug, name, description, language, tags, url, demo, markdown, html, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    slug,
    name,
    description,
    language,
    JSON.stringify(payload.tags || []),
    url,
    payload.demo || null,
    payload.markdown || null,
    payload.html || null,
    now,
    now
  ).run()

  console.log('cms product created', { slug, name })

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

  return jsonResponse({ product }, corsHeaders, 201)
}

// プロダクト更新
async function handleUpdateProduct(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const existing = await env.POSTS_DB.prepare(
    `SELECT * FROM products WHERE slug = ?`
  ).bind(slug).first<CMSProductRow>()

  if (!existing) {
    return errorResponse('product not found', corsHeaders, 404)
  }

  let payload: Partial<CMSProduct> = {}
  try {
    payload = await req.json()
  } catch {
    return errorResponse('bad request', corsHeaders)
  }

  const now = new Date().toISOString()

  await env.POSTS_DB.prepare(
    `UPDATE products SET
       name = ?, description = ?, language = ?, tags = ?, url = ?, demo = ?, markdown = ?, html = ?, updated_at = ?
     WHERE slug = ?`
  ).bind(
    payload.name ?? existing.name,
    payload.description ?? existing.description,
    payload.language ?? existing.language,
    JSON.stringify(payload.tags ?? JSON.parse(existing.tags)),
    payload.url ?? existing.url,
    payload.demo ?? existing.demo,
    payload.markdown ?? existing.markdown,
    payload.html ?? existing.html,
    now,
    slug
  ).run()

  console.log('cms product updated', { slug })

  const updated = await env.POSTS_DB.prepare(
    `SELECT * FROM products WHERE slug = ?`
  ).bind(slug).first<CMSProductRow>()

  return jsonResponse({ product: rowToProduct(updated!) }, corsHeaders)
}

// プロダクト削除
async function handleDeleteProduct(
  slug: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  const existing = await env.POSTS_DB.prepare(
    `SELECT slug FROM products WHERE slug = ?`
  ).bind(slug).first()

  if (!existing) {
    return errorResponse('product not found', corsHeaders, 404)
  }

  await env.POSTS_DB.prepare(`DELETE FROM products WHERE slug = ?`).bind(slug).run()

  console.log('cms product deleted', { slug })

  return jsonResponse({ success: true, slug }, corsHeaders)
}

// 画像アップロード
async function handleUploadImage(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  if (!env.CMS_IMAGES) {
    return errorResponse('R2 bucket not configured', corsHeaders, 500)
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    return errorResponse('content-type must be an image type', corsHeaders)
  }

  const ext = contentType.split('/')[1] || 'png'
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const body = await req.arrayBuffer()
  await env.CMS_IMAGES.put(key, body, {
    httpMetadata: { contentType },
  })

  const publicUrl = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : key

  console.log('cms image uploaded', { key, contentType, size: body.byteLength })

  return jsonResponse({ key, url: publicUrl }, corsHeaders, 201)
}

// 画像削除
async function handleDeleteImage(
  key: string,
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!(await checkAdminAuth(req, env))) {
    return errorResponse('unauthorized', corsHeaders, 401)
  }

  if (!env.CMS_IMAGES) {
    return errorResponse('R2 bucket not configured', corsHeaders, 500)
  }

  await env.CMS_IMAGES.delete(key)

  console.log('cms image deleted', { key })

  return jsonResponse({ success: true, key }, corsHeaders)
}

// CMS ルーティング
export async function handleCms(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  pathname: string
): Promise<Response> {
  const pathParts = pathname.replace('/api/cms', '').split('/').filter(Boolean)

  // Posts
  if (pathParts[0] === 'posts') {
    if (req.method === 'GET' && pathParts.length === 1) {
      return handleGetPosts(env, corsHeaders)
    }
    if (req.method === 'GET' && pathParts[1] === 'drafts' && pathParts.length === 2) {
      return handleGetDrafts(req, env, corsHeaders)
    }
    if (req.method === 'POST' && pathParts.length === 1) {
      return handleCreatePost(req, env, corsHeaders)
    }
    if (req.method === 'GET' && pathParts.length === 2) {
      return handleGetPost(pathParts[1], req, env, corsHeaders)
    }
    if (req.method === 'PUT' && pathParts.length === 2) {
      return handleUpdatePost(pathParts[1], req, env, corsHeaders)
    }
    if (req.method === 'PATCH' && pathParts[2] === 'status' && pathParts.length === 3) {
      return handleUpdatePostStatus(pathParts[1], req, env, corsHeaders)
    }
    if (req.method === 'DELETE' && pathParts.length === 2) {
      return handleDeletePost(pathParts[1], req, env, corsHeaders)
    }
  }

  // Products
  if (pathParts[0] === 'products') {
    if (req.method === 'GET' && pathParts.length === 1) {
      return handleGetProducts(env, corsHeaders)
    }
    if (req.method === 'POST' && pathParts.length === 1) {
      return handleCreateProduct(req, env, corsHeaders)
    }
    if (req.method === 'GET' && pathParts.length === 2) {
      return handleGetProduct(pathParts[1], env, corsHeaders)
    }
    if (req.method === 'PUT' && pathParts.length === 2) {
      return handleUpdateProduct(pathParts[1], req, env, corsHeaders)
    }
    if (req.method === 'DELETE' && pathParts.length === 2) {
      return handleDeleteProduct(pathParts[1], req, env, corsHeaders)
    }
  }

  // Upload
  if (pathParts[0] === 'upload') {
    if (req.method === 'POST' && pathParts.length === 1) {
      return handleUploadImage(req, env, corsHeaders)
    }
    if (req.method === 'DELETE' && pathParts.length === 2) {
      return handleDeleteImage(pathParts[1], req, env, corsHeaders)
    }
  }

  return errorResponse('not found', corsHeaders, 404)
}
