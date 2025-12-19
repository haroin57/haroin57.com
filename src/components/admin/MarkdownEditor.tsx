import { useState, useCallback, useRef, useMemo } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import rehypeHighlight from 'rehype-highlight'
import { visit, SKIP } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

const CMS_ENDPOINT = import.meta.env.VITE_CMS_ENDPOINT || '/api/cms'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  height?: number
  placeholder?: string
}

// 型定義
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
  python: 'Python',
  py: 'Python',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  cs: 'C#',
  sql: 'SQL',
  mermaid: 'Mermaid',
}

const formatCodeLanguageLabel = (lang: string): string => {
  const normalized = lang.trim().toLowerCase()
  if (!normalized) return 'CODE'
  return CODE_LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase()
}

// 目次を生成して挿入するプラグイン
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

// 目次をdivで囲む
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

// テーブルをレスポンシブラッパーで囲む
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

// MDNスタイルのアドモニション
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

// MDN定義リスト
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

// MDNコードブロック処理
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

// コードブロックにヘッダーを追加
const rehypeMdnCodeHeaders = () => {
  const normalizeClassName = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)
    if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
    if (value == null) return []
    return [String(value)].filter(Boolean)
  }

  return (tree: HastRoot) => {
    visit(tree, 'element', (node: HastElement) => {
      if (node.tagName !== 'pre') return
      const props = (node.properties ?? {}) as Record<string, unknown>

      // codeタグを取得
      const codeEl = node.children?.find(
        (child) => child.type === 'element' && (child as HastElement).tagName === 'code'
      ) as HastElement | undefined
      if (!codeEl) return

      const codeProps = (codeEl.properties ?? {}) as Record<string, unknown>
      const codeClassName = normalizeClassName(codeProps.className)

      // 言語を取得
      let language = ''
      for (const cls of codeClassName) {
        if (cls.startsWith('language-')) {
          language = cls.replace('language-', '')
          break
        }
        if (cls.startsWith('hljs-')) {
          language = cls.replace('hljs-', '')
          break
        }
      }

      const label = formatCodeLanguageLabel(language)

      // preをfigureで包む
      const className = normalizeClassName(props.className)
      if (!className.includes('mdn-code')) className.unshift('mdn-code')

      // figureに変換
      const figure: HastElement = {
        type: 'element',
        tagName: 'figure',
        properties: { className },
        children: [
          {
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
          },
          node,
        ],
      }

      // 親ノードでnodeをfigureに置き換える
      Object.assign(node, figure)
    })
  }
}

// Markdownを処理してHTMLを生成
async function processMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(injectToc)
    .use(mdnAdmonitions)
    .use(mdnDefinitionLists)
    .use(mdnCodeBlocks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeMdnCodeHeaders)
    .use(rehypeRaw)
    .use(wrapTocInDiv)
    .use(wrapTablesForResponsive)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown)

  return String(result)
}

// カスタムプレビューコンポーネント
function CustomPreview({ source }: { source: string }) {
  const [html, setHtml] = useState('')

  useMemo(() => {
    processMarkdown(source).then(setHtml)
  }, [source])

  return (
    <div
      className="markdown-body post-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function MarkdownEditor({ value, onChange, height = 500, placeholder }: MarkdownEditorProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { idToken } = useAdminAuth()
  const editorRef = useRef<HTMLDivElement>(null)

  // 画像アップロード処理
  const handleImageUpload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!idToken) {
        alert('ログインが必要です')
        return null
      }

      if (!file.type.startsWith('image/')) {
        alert('画像ファイルのみアップロードできます')
        return null
      }

      setIsUploading(true)
      try {
        const res = await fetch(`${CMS_ENDPOINT}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            Authorization: `Bearer ${idToken}`,
          },
          body: await file.arrayBuffer(),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Upload failed')
        }

        const data = await res.json() as { url: string }
        return data.url
      } catch (err) {
        console.error('Image upload failed:', err)
        alert(err instanceof Error ? err.message : '画像のアップロードに失敗しました')
        return null
      } finally {
        setIsUploading(false)
      }
    },
    [idToken]
  )

  // ドラッグ&ドロップ処理
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))

      if (imageFiles.length === 0) return

      for (const file of imageFiles) {
        const url = await handleImageUpload(file)
        if (url) {
          const markdownImage = `![${file.name}](${url})\n`
          onChange(value + markdownImage)
        }
      }
    },
    [handleImageUpload, onChange, value]
  )

  // ペースト処理（画像をペーストした場合）
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items)
      const imageItem = items.find((item) => item.type.startsWith('image/'))

      if (imageItem) {
        e.preventDefault()
        const file = imageItem.getAsFile()
        if (file) {
          const url = await handleImageUpload(file)
          if (url) {
            const markdownImage = `![image](${url})`
            onChange(value + markdownImage)
          }
        }
      }
    },
    [handleImageUpload, onChange, value]
  )

  return (
    <div
      ref={editorRef}
      className="relative"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onPaste={handlePaste}
      data-color-mode="dark"
    >
      {isUploading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded">
          <div className="text-white font-semibold">アップロード中...</div>
        </div>
      )}
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview="live"
        textareaProps={{
          placeholder: placeholder || 'Markdownを入力...',
        }}
        commands={[
          commands.bold,
          commands.italic,
          commands.strikethrough,
          commands.hr,
          commands.title,
          commands.divider,
          commands.link,
          commands.quote,
          commands.code,
          commands.codeBlock,
          commands.image,
          commands.divider,
          commands.unorderedListCommand,
          commands.orderedListCommand,
          commands.checkedListCommand,
        ]}
        previewOptions={{
          components: {
            // カスタムプレビューを使用
          },
        }}
        components={{
          preview: (source) => <CustomPreview source={source as unknown as string} />,
        }}
        style={{
          backgroundColor: 'var(--ui-surface)',
          borderRadius: '0.5rem',
        }}
      />
      <p className="mt-2 text-xs text-[color:var(--fg)] opacity-60">
        画像はドラッグ&ドロップまたはペーストでアップロードできます
      </p>
    </div>
  )
}
