// scripts/gen-product-posts.ts
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

const PRODUCTS_DIR = path.join(process.cwd(), 'content/products')
const OUT_PATH = path.join(process.cwd(), 'src/data/product-posts.json')

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
type MdastHeading = { type: 'heading'; depth: number; data?: { id?: unknown } }
type MdastText = { type: 'text'; value: string }
type MdastParagraph = { type: 'paragraph'; children: MdastNode[]; data?: Record<string, unknown> }
type MdastList = { type: 'list'; ordered?: boolean; children: MdastNode[]; data?: Record<string, unknown> }
type MdastListItem = { type: 'listItem'; children: MdastNode[]; data?: Record<string, unknown> }
type MdastStrong = { type: 'strong'; children: MdastNode[] }
type MdastBlockquote = { type: 'blockquote'; children: MdastNode[]; data?: Record<string, unknown> }
type MdastCode = { type: 'code'; lang?: string; meta?: string; value: string; data?: Record<string, unknown> }
type MdastParent = { type: string; children: MdastNode[] }

type TocItem = {
  id: string
  text: string
  level: number
}

/** HTMLから見出しを抽出（tocがない場合のフォールバック用） */
function extractHeadingsFromHtml(html: string): TocItem[] {
  const items: TocItem[] = []
  const regex = /<h([234])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = match[3].replace(/<[^>]+>/g, '').trim()
    if (text && text !== '目次') {
      items.push({ id, text, level })
    }
  }

  return items
}

// Markdownから手動で記述した目次を抽出
function extractTocFromMarkdown(markdown: string): TocItem[] {
  const items: TocItem[] = []
  const lines = markdown.split('\n')

  let inTocSection = false

  for (const line of lines) {
    if (/^##\s+目次\s*$/.test(line)) {
      inTocSection = true
      continue
    }

    if (inTocSection && /^##\s+/.test(line) && !/^##\s+目次\s*$/.test(line)) {
      break
    }

    if (!inTocSection) continue

    const match = line.match(/^(\s*)-\s+\[([^\]]+)\]\(#([^)]+)\)/)
    if (match) {
      const indent = match[1].length
      const text = match[2].replace(/`/g, '')
      const id = match[3]
      const level = Math.min(4, 2 + Math.floor(indent / 2))
      items.push({ id, text, level })
    }
  }

  return items
}

async function main() {
  const files = await fg('**/*.md', { cwd: PRODUCTS_DIR })
  const productPosts = []


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
    java: 'Java',
    python: 'Python',
    py: 'Python',
    sql: 'SQL',
    protobuf: 'Proto',
    proto: 'Proto',
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

  const injectToc = () => {
    return (tree: MdastRoot) => {
      const headings: { depth: number; text: string; id?: string }[] = []
      visit(tree, 'heading', (node: MdastHeading) => {
        const text = toString(node).trim()
        if (text === '目次') return
        if (node.depth >= 2 && node.depth <= 4) {
          const id = typeof node.data?.id === 'string' ? node.data.id : undefined
          headings.push({ depth: node.depth, text, id })
        }
      })

      const tocIndex = tree.children.findIndex(
        (n: MdastNode) => n.type === 'heading' && toString(n).trim() === '目次'
      )
      if (tocIndex === -1 || headings.length === 0) return

      const list: MdastList = {
        type: 'list',
        ordered: false,
        children: headings.map((h) => ({
          type: 'listItem',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: h.id ? `#${h.id}` : '#',
                  children: [{ type: 'text', value: h.text }],
                },
              ],
            },
          ],
        })),
      }

      tree.children.splice(tocIndex + 1, 0, list)
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

  // 本文中の「## 目次」セクションをHTMLから除去（サイドバーのTableOfContentsで表示するため）
  const removeTocSection = () => {
    return (tree: HastRoot) => {
      let tocHeadingIndex: number | undefined
      let tocContentIndex: number | undefined

      for (let i = 0; i < tree.children.length; i++) {
        const node = tree.children[i]
        if (node.type !== 'element') continue
        const el = node as HastElement

        if (el.tagName === 'h2' && tocHeadingIndex === undefined) {
          const textContent = (el.children || [])
            .filter((child) => child.type === 'text')
            .map((child) => (child as { type: 'text'; value: string }).value || '')
            .join('')
            .trim()

          if (textContent === '目次') {
            tocHeadingIndex = i
            continue
          }
        }

        if (tocHeadingIndex !== undefined && tocContentIndex === undefined) {
          if (el.tagName === 'div') {
            const className = normalizeClassName(el.properties?.className)
            if (className.includes('toc-box')) {
              tocContentIndex = i
              break
            }
          }

          if (el.tagName === 'ul') {
            tocContentIndex = i
            break
          }
        }
      }

      if (tocHeadingIndex === undefined) return

      const indices = [tocHeadingIndex]
      if (tocContentIndex !== undefined) indices.push(tocContentIndex)
      indices.sort((a, b) => b - a).forEach((idx) => tree.children.splice(idx, 1))

      // 直後の改行だけ残りやすいので削除
      const start = tocHeadingIndex
      while (true) {
        const next = tree.children[start]
        if (!next || next.type !== 'element') break
        const el = next as HastElement
        if (el.tagName !== 'br') break
        tree.children.splice(start, 1)
      }
    }
  }

  // テーブルをレスポンシブラッパーで囲む
  const wrapTablesForResponsive = () => {
    return (tree: HastRoot) => {
      visit(tree, 'element', (node: HastElement, index: number | undefined, parent: HastNode | undefined) => {
        if (node.tagName !== 'table') return
        if (!parent || index === undefined) return

        const parentEl = parent as HastRoot | { children: HastNode[] }
        if (!Array.isArray(parentEl.children)) return

        // 既にラッパーで囲まれている場合はスキップ
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

  const rehypeLazyMedia = () => {
    return (tree: HastRoot) => {
      let firstImageSeen = false

      visit(tree, 'element', (node: HastElement) => {
        const props = (node.properties ?? {}) as Record<string, unknown>

        if (node.tagName === 'img') {
          if (!firstImageSeen) {
            firstImageSeen = true
            if (props.loading == null) props.loading = 'eager'
            if (props.decoding == null) props.decoding = 'async'
            if (props.fetchPriority == null) props.fetchPriority = 'high'
          } else {
            if (props.loading == null) props.loading = 'lazy'
            if (props.decoding == null) props.decoding = 'async'
            if (props.fetchPriority == null) props.fetchPriority = 'low'
          }

          node.properties = props
          return
        }

        if (node.tagName === 'iframe') {
          if (props.loading == null) props.loading = 'lazy'
          node.properties = props
        }
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

        // Mermaidコードブロックは特別に処理
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
    // Mermaidコードブロックは特別に処理してdivに変換
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

  for (const file of files) {
    const full = await fs.readFile(path.join(PRODUCTS_DIR, file), 'utf8')
    const { data, content } = matter(full)
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
      .use(removeTocSection)
      .use(wrapTocInDiv)
      .use(wrapTablesForResponsive)
      .use(rehypeLazyMedia)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(content)

    const tags =
      Array.isArray(data.tags) && data.tags.length > 0
        ? data.tags.map((t: unknown) => String(t))
        : typeof data.tags === 'string'
          ? data.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : []

    const html = processed.toString()
    const tocFromMarkdown = extractTocFromMarkdown(content)
    const toc = tocFromMarkdown.length > 0 ? tocFromMarkdown : extractHeadingsFromHtml(html)

    // slugはファイル名から取得（products.jsonのslugと一致させる）
    const slug = file.replace(/\.md$/, '')

    productPosts.push({
      slug,
      productSlug: data.product || slug, // frontmatterのproductフィールドを使用
      title: data.title || file,
      summary: data.summary || '',
      createdAt: data.date || null,
      tags,
      toc,
      html,
    })
  }

  productPosts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(productPosts, null, 2), 'utf8')
  console.log(`Generated ${productPosts.length} product posts -> ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
