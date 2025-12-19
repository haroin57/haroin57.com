/**
 * 既存のPosts/ProductsデータをCloudflare KVに移行するスクリプト
 *
 * 使用方法:
 * 1. wrangler CLIがインストールされていることを確認
 * 2. npx tsx scripts/migrate-to-kv.ts を実行
 *
 * 注意: 実行前にKV名前空間IDを確認してください
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// KV設定（wrangler.pv.jsoncから）
const KV_NAMESPACE_ID = '186445ba0495498facbca1e8c5c67bcc'
const WRANGLER_CONFIG = 'wrangler.pv.jsonc'

// 型定義
type PostMeta = {
  slug: string
  title: string
  summary: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

type ProductMeta = {
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

// KVにデータを書き込む関数
function writeToKV(key: string, value: string): void {
  const tempFile = join(__dirname, '.temp-kv-value.json')
  writeFileSync(tempFile, value, 'utf8')

  try {
    execSync(
      `wrangler kv key put "${key}" --namespace-id="${KV_NAMESPACE_ID}" --path="${tempFile}" --config="${WRANGLER_CONFIG}" --remote`,
      { stdio: 'inherit' }
    )
    console.log(`  ✓ ${key}`)
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile)
    }
  }
}

// Postsの移行
async function migratePosts(): Promise<void> {
  console.log('\n📝 Postsを移行中...')

  const postsJsonPath = join(__dirname, '../src/data/posts.json')
  if (!existsSync(postsJsonPath)) {
    console.log('  posts.jsonが見つかりません。スキップします。')
    return
  }

  const postsData = JSON.parse(readFileSync(postsJsonPath, 'utf8')) as Array<{
    slug: string
    title: string
    summary: string
    createdAt: string
    tags: string[]
    html: string
  }>

  // Markdownソースを探す
  const contentDir = join(__dirname, '../content/posts')

  const postsList: PostMeta[] = []

  for (const post of postsData) {
    const now = new Date().toISOString()

    // Markdownファイルを探す
    let markdown = ''
    if (existsSync(contentDir)) {
      const mdPath = join(contentDir, `${post.slug}.md`)
      if (existsSync(mdPath)) {
        markdown = readFileSync(mdPath, 'utf8')
      }
    }

    // 個別記事データ
    const postData = {
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      createdAt: post.createdAt,
      updatedAt: now,
      tags: post.tags || [],
      markdown,
      html: post.html,
    }

    // KVに書き込み
    writeToKV(`cms:post:${post.slug}`, JSON.stringify(postData))

    // 一覧用メタデータ
    postsList.push({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      createdAt: post.createdAt,
      updatedAt: now,
      tags: post.tags || [],
    })
  }

  // 記事一覧を書き込み
  writeToKV('cms:posts:list', JSON.stringify(postsList))
  console.log(`  合計 ${postsList.length} 件の記事を移行しました`)
}

// Productsの移行
async function migrateProducts(): Promise<void> {
  console.log('\n📦 Productsを移行中...')

  const productsJsonPath = join(__dirname, '../src/data/products.json')
  if (!existsSync(productsJsonPath)) {
    console.log('  products.jsonが見つかりません。スキップします。')
    return
  }

  const productsData = JSON.parse(readFileSync(productsJsonPath, 'utf8')) as Array<{
    slug: string
    name: string
    description: string
    language: string
    tags?: string[]
    url: string
    demo?: string
    content?: unknown
  }>

  // product-posts.jsonからMarkdown/HTMLを取得
  const productPostsPath = join(__dirname, '../src/data/product-posts.json')
  let productPosts: Record<string, { html: string }> = {}
  if (existsSync(productPostsPath)) {
    productPosts = JSON.parse(readFileSync(productPostsPath, 'utf8'))
  }

  // Markdownソースを探す
  const contentDir = join(__dirname, '../content/products')

  const productsList: ProductMeta[] = []

  for (const product of productsData) {
    const now = new Date().toISOString()

    // Markdownファイルを探す
    let markdown = ''
    if (existsSync(contentDir)) {
      const mdPath = join(contentDir, `${product.slug}.md`)
      if (existsSync(mdPath)) {
        markdown = readFileSync(mdPath, 'utf8')
      }
    }

    // HTMLを取得
    const html = productPosts[product.slug]?.html || ''

    // 個別プロダクトデータ
    const productData = {
      slug: product.slug,
      name: product.name,
      description: product.description,
      language: product.language,
      tags: product.tags || [],
      url: product.url,
      demo: product.demo,
      createdAt: now,
      updatedAt: now,
      markdown,
      html,
    }

    // KVに書き込み
    writeToKV(`cms:product:${product.slug}`, JSON.stringify(productData))

    // 一覧用メタデータ
    productsList.push({
      slug: product.slug,
      name: product.name,
      description: product.description,
      language: product.language,
      tags: product.tags || [],
      url: product.url,
      demo: product.demo,
      createdAt: now,
      updatedAt: now,
    })
  }

  // プロダクト一覧を書き込み
  writeToKV('cms:products:list', JSON.stringify(productsList))
  console.log(`  合計 ${productsList.length} 件のプロダクトを移行しました`)
}

// メイン処理
async function main(): Promise<void> {
  console.log('🚀 データ移行を開始します...')
  console.log(`   KV Namespace ID: ${KV_NAMESPACE_ID}`)
  console.log(`   Config: ${WRANGLER_CONFIG}`)

  try {
    await migratePosts()
    await migrateProducts()
    console.log('\n✅ データ移行が完了しました！')
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error)
    process.exit(1)
  }
}

main()
