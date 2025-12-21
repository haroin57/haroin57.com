/**
 * ローカルのMarkdownファイルをCloudflare KV（CMS API）にデプロイするスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/deploy-posts.ts [options]
 *
 * オプション:
 *   --file <path>       指定したファイルのみをデプロイ
 *   --draft             下書きとしてデプロイ（デフォルトは公開）
 *   --dry-run           実際にはデプロイせず、処理内容を表示
 *   --endpoint <url>    CMS APIのエンドポイント（デフォルト: https://haroin57.com/api/cms）
 *   --gen-json          src/data/posts.jsonを生成（デプロイはスキップ）
 *
 * 環境変数:
 *   FIREBASE_ID_TOKEN   Firebase IDトークン（認証用）
 *
 * Markdownファイルのフォーマット（frontmatter）:
 *   ---
 *   title: "記事タイトル"
 *   summary: "記事の概要"
 *   date: "2025-01-01"
 *   tags:
 *     - tag1
 *     - tag2
 *   status: published  # オプション: published または draft
 *   ---
 *   本文...
 */

import '@dotenvx/dotenvx/config'
import fs from 'fs/promises'
import path from 'path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeStringify from 'rehype-stringify'
import { SKIP, visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

const POSTS_DIR = path.join(process.cwd(), 'content/posts')
const OUT_PATH = path.join(process.cwd(), 'src/data/posts.json')
const DEFAULT_ENDPOINT = 'https://haroin57.com/api/cms'

type HastNode = { type: string; [key: string]: unknown }
type HastRoot = { type: 'root'; children: HastNode[] }
type HastElement = {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}
type MdastNode = { type: string; [key: string]: unknown }
type MdastRoot = { type: 'root'; children: MdastNode[] }
type _MdastHeading = { type: 'heading'; depth: number; data?: { id?: unknown } }
type MdastText = { type: 'text'; value: string }
type MdastParagraph = { type: 'paragraph'; children: MdastNode[]; data?: Record<string, unknown> }
type MdastList = { type: 'list'; ordered?: boolean; children: MdastNode[]; data?: Record<string, unknown> }
type MdastListItem = { type: 'listItem'; children: MdastNode[]; data?: Record<string, unknown> }
type MdastStrong = { type: 'strong'; children: MdastNode[] }
type MdastBlockquote = { type: 'blockquote'; children: MdastNode[]; data?: Record<string, unknown> }
type MdastCode = { type: 'code'; lang?: string; meta?: string; value: string; data?: Record<string, unknown> }
type MdastParent = { type: string; children: MdastNode[] }

interface DeployOptions {
  file?: string
  draft: boolean
  dryRun: boolean
  endpoint: string
  token?: string
  adminSecret?: string
  genJson: boolean
}

interface PostData {
  slug: string
  title: string
  summary: string
  markdown: string
  html: string
  tags: string[]
  status: 'draft' | 'published'
  createdAt?: string
}

// コマンドライン引数をパース
function parseArgs(): DeployOptions {
  const args = process.argv.slice(2)
  const options: DeployOptions = {
    draft: false,
    dryRun: false,
    endpoint: process.env.CMS_ENDPOINT || DEFAULT_ENDPOINT,
    token: process.env.FIREBASE_ID_TOKEN,
    adminSecret: process.env.ADMIN_SECRET,
    genJson: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--file' && args[i + 1]) {
      options.file = args[++i]
    } else if (arg === '--draft') {
      options.draft = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--endpoint' && args[i + 1]) {
      options.endpoint = args[++i]
    } else if (arg === '--token' && args[i + 1]) {
      options.token = args[++i]
    } else if (arg === '--gen-json') {
      options.genJson = true
    }
  }

  return options
}

// Markdown変換処理（gen-posts.tsから移植）
const CODE_LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Bash',
  css: 'CSS',
  html: 'HTML',
  javascript: 'JS',
  js: 'JS',
  json: 'JSON',
  jsx: 'JSX',
  markdown: 'MD',
  md: 'MD',
  plaintext: 'TEXT',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  shell: 'Shell',
  sh: 'Shell',
  ts: 'TS',
  tsx: 'TSX',
  typescript: 'TS',
  yaml: 'YAML',
  yml: 'YAML',
}

const normalizeClassName = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  if (value == null) return []
  return [String(value)].filter(Boolean)
}

const formatCodeLanguageLabel = (lang: string): string => {
  const normalized = lang.trim().toLowerCase()
  if (!normalized) return 'CODE'
  return CODE_LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase()
}

const readDataAttr = (properties: Record<string, unknown>, name: string): string => {
  const raw = properties[name] ?? properties[name.replace(/-([a-z])/g, (_, c) => String(c).toUpperCase())]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0] ?? '')
  return ''
}

const rehypeMdnCodeHeaders = () => {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: HastElement) => {
      if (node.tagName !== 'figure') return
      const props = (node.properties ?? {}) as Record<string, unknown>
      const hasPrettyCodeFigure =
        Object.prototype.hasOwnProperty.call(props, 'data-rehype-pretty-code-figure') ||
        Object.prototype.hasOwnProperty.call(props, 'dataRehypePrettyCodeFigure')
      if (!hasPrettyCodeFigure) return

      const children = node.children ?? []
      const pre = children.find(
        (child) => child.type === 'element' && (child as HastElement).tagName === 'pre'
      ) as HastElement | undefined
      if (!pre) return

      const alreadyHasHeader = children.some((child) => {
        if (child.type !== 'element') return false
        const el = child as HastElement
        if (el.tagName !== 'div') return false
        const className = normalizeClassName(el.properties?.className)
        return className.includes('mdn-code-header')
      })
      if (alreadyHasHeader) return

      const className = normalizeClassName(props.className)
      if (!className.includes('mdn-code')) className.unshift('mdn-code')
      props.className = className
      node.properties = props

      const preProps = (pre.properties ?? {}) as Record<string, unknown>
      const language = readDataAttr(preProps, 'data-language')
      const label = formatCodeLanguageLabel(language)

      const header: HastElement = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['mdn-code-header'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['mdn-code-lang'] },
            children: [{ type: 'text', value: label }],
          },
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['mdn-code-actions'] },
            children: [
              {
                type: 'element',
                tagName: 'button',
                properties: {
                  type: 'button',
                  className: ['mdn-code-copy'],
                  'aria-label': 'Copy code to clipboard',
                },
                children: [{ type: 'text', value: 'Copy' }],
              },
            ],
          },
        ],
      }

      node.children = [header, ...children]
    })
  }
}

// 目次自動生成は廃止。マニュアルで目次を記述する方式に変更。
// 各記事内でMarkdownリストを使って手動で目次を記述してください。
const injectToc = () => {
  return (_tree: MdastRoot) => {
    // 自動生成を無効化 - 何もしない
  }
}

const wrapTocInDiv = () => {
  return (tree: HastRoot) => {
    let foundTocHeading = false
    visit(tree, 'element', (node: HastElement, index: number | undefined, parent: HastNode | undefined) => {
      if (!foundTocHeading && node.tagName === 'h2') {
        const children = node.children || []
        const textContent = children
          .filter((child) => child.type === 'text')
          .map((child) => {
            const textNode = child as { type: 'text'; value: string }
            return textNode.value || ''
          })
          .join('')
          .trim()

        if (textContent === '目次') {
          foundTocHeading = true
          return
        }
      }

      if (foundTocHeading && node.tagName === 'ul' && parent && parent.type === 'root' && index !== undefined) {
        const parentRoot = parent as HastRoot
        const wrapper: HastElement = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['toc-box'] },
          children: [node],
        }
        parentRoot.children[index] = wrapper
        foundTocHeading = false
        return SKIP
      }
    })
  }
}

const wrapTablesForResponsive = () => {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: HastElement, index: number | undefined, parent: HastNode | undefined) => {
      if (node.tagName !== 'table') return
      if (!parent || index === undefined) return

      const parentEl = parent as HastRoot | { children: HastNode[] }
      if (!Array.isArray(parentEl.children)) return

      const parentNode = parent as HastElement
      if (parentNode.tagName === 'div') {
        const className = parentNode.properties?.className
        if (Array.isArray(className) && className.includes('table-wrapper')) {
          return SKIP
        }
      }

      const wrapper: HastElement = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrapper'] },
        children: [node],
      }
      parentEl.children[index] = wrapper
      return SKIP
    })
  }
}

const mdnAdmonitions = () => {
  const ADMONITION_RE = /^\[!(NOTE|WARNING|CALLOUT)\]\s*(.*)$/i
  const LABELS: Record<string, string> = { note: 'メモ:', warning: '警告:' }

  const prependLabel = (paragraph: MdastParagraph, label: string) => {
    const strong: MdastStrong = { type: 'strong', children: [{ type: 'text', value: label }] }
    const spacer: MdastText = { type: 'text', value: ' ' }
    paragraph.children = [strong, spacer, ...(paragraph.children || [])]
  }

  return (tree: MdastRoot) => {
    visit(tree, 'blockquote', (node: MdastBlockquote) => {
      const first = node.children?.[0] as MdastNode | undefined
      if (!first || first.type !== 'paragraph') return

      const markerParagraph = first as MdastParagraph
      const markerFirstChild = markerParagraph.children?.[0] as MdastNode | undefined
      if (!markerFirstChild || markerFirstChild.type !== 'text') return

      const markerTextNode = markerFirstChild as MdastText
      const firstLine = (markerTextNode.value.split(/\r?\n/)[0] || '').trim()
      const match = firstLine.match(ADMONITION_RE)
      if (!match) return

      const kindRaw = match[1].toUpperCase()
      const titleFromLine = (match[2] || '').trim()

      const markerPrefixRe = new RegExp(`^\\[!${match[1]}\\]\\s*`, 'i')
      markerTextNode.value = markerTextNode.value.replace(markerPrefixRe, '')
      if (toString(markerParagraph).trim().length === 0) {
        node.children.shift()
      }

      if (kindRaw === 'CALLOUT') {
        node.data = {
          ...(node.data || {}),
          hName: 'div',
          hProperties: { className: ['callout'] },
        }

        if (titleFromLine) {
          node.children.unshift({
            type: 'paragraph',
            children: [{ type: 'strong', children: [{ type: 'text', value: titleFromLine }] }],
          })

          const next = node.children?.[1] as MdastNode | undefined
          if (next && next.type === 'paragraph') {
            const p = next as MdastParagraph
            const firstInline = p.children?.[0] as MdastNode | undefined
            if (firstInline && firstInline.type === 'text') {
              const t = firstInline as MdastText
              t.value = t.value.split(/\r?\n/).slice(1).join('\n').replace(/^\s+/, '')
            }
            if (toString(p).trim().length === 0) {
              node.children.splice(1, 1)
            }
          }
        }
        return
      }

      const kind = kindRaw === 'NOTE' ? 'note' : 'warning'
      node.data = {
        ...(node.data || {}),
        hName: 'div',
        hProperties: { className: ['notecard', kind] },
      }

      const firstParagraphIndex = node.children.findIndex((child) => child.type === 'paragraph')
      if (firstParagraphIndex === -1) {
        node.children.unshift({
          type: 'paragraph',
          children: [
            { type: 'strong', children: [{ type: 'text', value: LABELS[kind] }] },
            { type: 'text', value: '' },
          ],
        })
        return
      }

      const paragraph = node.children[firstParagraphIndex] as MdastParagraph
      prependLabel(paragraph, LABELS[kind])
    })
  }
}

const mdnDefinitionLists = () => {
  const stripLeadingColon = (paragraph: MdastParagraph) => {
    const firstTextIndex = (paragraph.children || []).findIndex((child) => child.type === 'text')
    if (firstTextIndex === -1) return
    const textNode = paragraph.children[firstTextIndex] as MdastText
    const nextValue = textNode.value.replace(/^\s*:\s*/, '')
    if (nextValue.length === 0) {
      paragraph.children.splice(firstTextIndex, 1)
    } else {
      textNode.value = nextValue
    }
  }

  const parseEntry = (item: MdastListItem) => {
    const term = item.children?.[0] as MdastNode | undefined
    if (!term || term.type !== 'paragraph') return null
    const nested = item.children.find((child, idx) => idx > 0 && child.type === 'list') as MdastList | undefined
    if (!nested || nested.ordered) return null
    const defItems = (nested.children || []).filter((c) => c.type === 'listItem') as MdastListItem[]
    if (defItems.length !== 1) return null
    for (const def of defItems) {
      const first = def.children?.[0] as MdastNode | undefined
      if (!first || first.type !== 'paragraph') return null
      if (!/^\s*:/.test(toString(first))) return null
    }
    return { term: term as MdastParagraph, defs: defItems }
  }

  return (tree: MdastRoot) => {
    visit(tree, 'list', (node: MdastList) => {
      if (node.ordered) return
      const items = (node.children || []).filter((c) => c.type === 'listItem') as MdastListItem[]
      if (items.length === 0) return

      const entries = items.map(parseEntry)
      if (entries.some((e) => !e)) return

      const dlChildren: MdastNode[] = []
      for (const entry of entries as NonNullable<ReturnType<typeof parseEntry>>[]) {
        const dt: MdastParagraph = {
          ...entry.term,
          data: { ...(entry.term.data || {}), hName: 'dt' },
        }
        dlChildren.push(dt)

        for (const def of entry.defs) {
          const firstParagraph = def.children?.[0] as MdastNode | undefined
          if (firstParagraph && firstParagraph.type === 'paragraph') {
            stripLeadingColon(firstParagraph as MdastParagraph)
          }
          def.data = { ...(def.data || {}), hName: 'dd' }
          dlChildren.push(def)
        }
      }

      node.data = {
        ...(node.data || {}),
        hName: 'dl',
        hProperties: { className: ['definition-list'] },
      }
      node.children = dlChildren
    })
  }
}

const mdnCodeBlocks = () => {
  const VALID_TOKEN_RE = /^[a-z0-9][a-z0-9-]*$/i

  const normalizeLang = (raw: string | undefined) => {
    if (!raw) return { lang: undefined, extraClasses: [] as string[] }

    let lang = raw.trim()

    const colonIdx = lang.indexOf(':')
    if (colonIdx !== -1) lang = lang.slice(0, colonIdx)

    const extraClasses: string[] = []
    if (lang.endsWith('-nolint')) {
      lang = lang.slice(0, -'-nolint'.length)
      extraClasses.push('nolint')
    }

    if (lang === 'plain') lang = 'plaintext'
    return { lang: lang || undefined, extraClasses }
  }

  return (tree: MdastRoot) => {
    visit(tree, 'code', (node: MdastCode, index: number | undefined, parent: MdastNode | undefined) => {
      const p = parent as MdastParent | undefined
      if (!p || !Array.isArray(p.children) || index === undefined) return

      const metaTokens = typeof node.meta === 'string' ? node.meta.split(/\s+/).filter(Boolean) : []
      const mdnTokens = metaTokens.map((t) => t.trim()).filter((t) => VALID_TOKEN_RE.test(t))

      if (mdnTokens.includes('hidden')) {
        p.children.splice(index, 1)
        return [SKIP, index]
      }

      const langLower = node.lang?.toLowerCase()
      if (langLower === 'mermaid') {
        node.data = {
          ...(node.data || {}),
          hName: 'div',
          hProperties: {
            className: ['mermaid-block'],
            'data-mermaid': node.value,
          },
        }
        return
      }

      const { lang, extraClasses } = normalizeLang(node.lang)
      node.lang = lang

      const classSet = new Set<string>(['mdn-code', ...extraClasses, ...mdnTokens])
      node.data = {
        ...(node.data || {}),
        mdnCodeClasses: Array.from(classSet),
      }
    })
  }
}

const mdnCodeHandler = (_state: unknown, node: MdastCode): HastElement => {
  const langLower = node.lang?.toLowerCase()
  if (langLower === 'mermaid') {
    return {
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['mermaid-block'],
        'data-mermaid': node.value,
      },
      children: [],
    }
  }

  const mdnClasses = Array.isArray(node.data?.mdnCodeClasses) ? (node.data?.mdnCodeClasses as unknown[]) : []
  const className = mdnClasses.map((c) => String(c)).filter(Boolean)

  const properties: Record<string, unknown> = {}
  if (className.length > 0) properties.className = className

  const pre: HastElement = {
    type: 'element',
    tagName: 'pre',
    properties,
    children: [],
  }

  const codeClassName = node.lang ? [`language-${node.lang}`] : []

  pre.children = [
    {
      type: 'element',
      tagName: 'code',
      properties: { className: codeClassName },
      children: [{ type: 'text', value: node.value || '' }],
    },
  ]

  return pre
}

// MarkdownをHTMLに変換
async function convertMarkdownToHtml(content: string): Promise<string> {
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkSlug)
    .use(remarkMath)
    .use(injectToc)
    .use(mdnAdmonitions)
    .use(mdnDefinitionLists)
    .use(mdnCodeBlocks)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: {
        code: mdnCodeHandler as unknown as never,
      },
    })
    .use(rehypeKatex)
    .use(rehypePrettyCode, {
      defaultLang: 'plaintext',
      keepBackground: false,
      showLineNumbers: true,
    })
    .use(rehypeMdnCodeHeaders)
    .use(rehypeRaw)
    .use(wrapTocInDiv)
    .use(wrapTablesForResponsive)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content)

  return processed.toString()
}

// Markdownファイルを解析
async function parseMarkdownFile(filePath: string, options: DeployOptions): Promise<PostData> {
  const fileContent = await fs.readFile(filePath, 'utf8')
  const { data, content } = matter(fileContent)

  const slug = path.basename(filePath, '.md')
  const html = await convertMarkdownToHtml(content)

  const tags =
    Array.isArray(data.tags) && data.tags.length > 0
      ? data.tags.map((t: unknown) => String(t))
      : typeof data.tags === 'string'
        ? data.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : []

  // ステータスの決定: コマンドライン > frontmatter > デフォルト(published)
  let status: 'draft' | 'published' = 'published'
  if (options.draft) {
    status = 'draft'
  } else if (data.status === 'draft' || data.status === 'published') {
    status = data.status
  }

  return {
    slug,
    title: data.title || slug,
    summary: data.summary || '',
    markdown: content,
    html,
    tags,
    status,
    createdAt: data.date || undefined,
  }
}

// CMS APIにデプロイ
async function deployPost(post: PostData, options: DeployOptions): Promise<{ success: boolean; message: string }> {
  if (options.dryRun) {
    return {
      success: true,
      message: `[dry-run] Would deploy: ${post.slug} (${post.status})`,
    }
  }

  if (!options.token || !options.adminSecret) {
    return {
      success: false,
      message: 'Both FIREBASE_ID_TOKEN and ADMIN_SECRET are required. Please set both environment variables.',
    }
  }

  // 認証ヘッダーを構築
  const authHeaders: Record<string, string> = {}
  if (options.token) {
    authHeaders['Authorization'] = `Bearer ${options.token}`
  }
  if (options.adminSecret) {
    authHeaders['X-Admin-Secret'] = options.adminSecret
  }

  const url = `${options.endpoint}/posts/${post.slug}`

  // まず既存の記事があるか確認
  const checkResponse = await fetch(url, {
    method: 'GET',
    headers: authHeaders,
  })

  const isUpdate = checkResponse.ok

  const method = isUpdate ? 'PUT' : 'POST'
  const endpoint = isUpdate ? url : `${options.endpoint}/posts`

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      markdown: post.markdown,
      html: post.html,
      tags: post.tags,
      status: post.status,
      createdAt: post.createdAt,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    return {
      success: false,
      message: `Failed to ${isUpdate ? 'update' : 'create'} post: ${response.status} - ${errorBody}`,
    }
  }

  return {
    success: true,
    message: `${isUpdate ? 'Updated' : 'Created'}: ${post.slug} (${post.status})`,
  }
}

// JSON生成（gen-posts.tsの機能）
async function generatePostsJson(options: DeployOptions): Promise<void> {
  console.log('=== Generating posts.json ===')

  const relativePaths = await fg('**/*.md', { cwd: POSTS_DIR })
  const files = relativePaths.map((f) => path.join(POSTS_DIR, f))

  if (files.length === 0) {
    console.log('No markdown files found.')
    return
  }

  console.log(`Found ${files.length} file(s) to process.\n`)

  const posts: {
    slug: string
    title: string
    summary: string
    createdAt: string | null
    tags: string[]
    html: string
  }[] = []

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file)
    console.log(`Processing: ${relativePath}`)

    try {
      const post = await parseMarkdownFile(file, options)
      posts.push({
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        createdAt: post.createdAt || null,
        tags: post.tags,
        html: post.html,
      })
      console.log(`  ✓ ${post.slug}`)
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 日付でソート（新しい順）
  posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(posts, null, 2), 'utf8')

  console.log('')
  console.log(`Generated ${posts.length} posts -> ${OUT_PATH}`)
}

// メイン処理
async function main(): Promise<void> {
  const options = parseArgs()

  // --gen-json モードの場合はJSONを生成して終了
  if (options.genJson) {
    await generatePostsJson(options)
    return
  }

  console.log('=== Markdown to CMS Deployment Script ===')
  console.log(`Endpoint: ${options.endpoint}`)
  console.log(`Draft mode: ${options.draft}`)
  console.log(`Dry run: ${options.dryRun}`)
  console.log('')

  let files: string[] = []

  if (options.file) {
    // 指定ファイルのみ
    const filePath = path.resolve(options.file)
    if (!filePath.endsWith('.md')) {
      console.error('Error: File must be a .md file')
      process.exit(1)
    }
    files = [filePath]
  } else {
    // content/posts配下のすべてのMarkdownファイル
    const relativePaths = await fg('**/*.md', { cwd: POSTS_DIR })
    files = relativePaths.map((f) => path.join(POSTS_DIR, f))
  }

  if (files.length === 0) {
    console.log('No markdown files found.')
    return
  }

  console.log(`Found ${files.length} file(s) to process.\n`)

  let successCount = 0
  let failCount = 0

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file)
    console.log(`Processing: ${relativePath}`)

    try {
      const post = await parseMarkdownFile(file, options)
      const result = await deployPost(post, options)

      if (result.success) {
        console.log(`  ✓ ${result.message}`)
        successCount++
      } else {
        console.log(`  ✗ ${result.message}`)
        failCount++
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`)
      failCount++
    }
  }

  console.log('')
  console.log('=== Summary ===')
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
