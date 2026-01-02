import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { CMS_ENDPOINT } from '../../lib/endpoints'
import { loadMermaid } from '../../utils/mermaid'

// Frontmatterをパースする関数
type FrontmatterData = {
  title?: string
  summary?: string
  date?: string
  tags?: string[]
}

function parseFrontmatter(markdown: string): { data: FrontmatterData; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/
  const match = markdown.match(frontmatterRegex)

  if (!match) {
    return { data: {}, content: markdown }
  }

  const yamlContent = match[1]
  const content = markdown.slice(match[0].length)
  const data: FrontmatterData = {}

  // シンプルなYAMLパーサー
  const lines = yamlContent.split('\n')
  let currentKey: string | null = null
  let inArray = false
  const arrayValues: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 配列の項目
    if (trimmed.startsWith('- ') && inArray && currentKey) {
      arrayValues.push(trimmed.slice(2).trim())
      continue
    }

    // 配列終了
    if (inArray && currentKey && !trimmed.startsWith('-')) {
      if (currentKey === 'tags') {
        data.tags = arrayValues.slice()
      }
      arrayValues.length = 0
      inArray = false
    }

    // key: value形式
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()

      currentKey = key

      if (!value) {
        // 値が空の場合は配列の可能性
        inArray = true
        arrayValues.length = 0
      } else {
        // 値がある場合
        const cleanValue = value.replace(/^["']|["']$/g, '')
        if (key === 'title') data.title = cleanValue
        else if (key === 'summary') data.summary = cleanValue
        else if (key === 'date') data.date = cleanValue
        else if (key === 'tags') {
          // インライン配列形式: tags: [tag1, tag2]
          if (value.startsWith('[') && value.endsWith(']')) {
            data.tags = value
              .slice(1, -1)
              .split(',')
              .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          }
        }
      }
    }
  }

  // 最後の配列を処理
  if (inArray && currentKey === 'tags') {
    data.tags = arrayValues
  }

  return { data, content }
}

// Frontmatterヘッダーコンポーネント
function FrontmatterHeader({ data }: { data: FrontmatterData }) {
  if (!data.title && !data.summary && !data.date && !data.tags?.length) {
    return null
  }

  return (
    <div className="mb-6 pb-4 border-b border-[color:var(--ui-border)]">
      {data.title && <h1 className="text-2xl font-bold mb-2">{data.title}</h1>}
      {data.summary && <p className="text-base opacity-80 mb-2">{data.summary}</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm opacity-60">
        {data.date && <time>{data.date}</time>}
        {data.tags && data.tags.length > 0 && (
          <>
            {data.date && <span>•</span>}
            <div className="flex flex-wrap gap-1">
              {data.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-[color:var(--ui-surface)] rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Mermaidコードブロックをレンダリングするコンポーネント
function MermaidRenderer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const renderMermaid = async () => {
      if (!code.trim()) return
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const api = await loadMermaid()
        const { svg: renderedSvg, bindFunctions } = await api.render(id, code)
        if (!isActive) return
        setSvg(renderedSvg)
        setError(null)
        if (bindFunctions) {
          requestAnimationFrame(() => {
            const container = containerRef.current
            if (container) bindFunctions(container)
          })
        }
      } catch (err) {
        console.error('Mermaid render error:', err)
        if (!isActive) return
        setError(err instanceof Error ? err.message : 'Mermaid rendering failed')
      }
    }
    renderMermaid()
    return () => {
      isActive = false
    }
  }, [code])

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
        <strong>Mermaid Error:</strong> {error}
      </div>
    )
  }

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
}

// childrenからテキストを抽出するヘルパー関数
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children
  }
  if (typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('')
  }
  if (children && typeof children === 'object' && 'props' in children) {
    const element = children as React.ReactElement<{ children?: React.ReactNode }>
    return extractTextFromChildren(element.props.children)
  }
  return ''
}

// カスタムコードコンポーネント
function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''

  // Mermaidの場合は特別にレンダリング
  if (language === 'mermaid') {
    const code = extractTextFromChildren(children).replace(/\n$/, '')
    return <MermaidRenderer code={code} />
  }

  // それ以外は通常のコードブロック
  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

// Frontmatter付きプレビューコンポーネント
function PreviewWithFrontmatter({ source }: { source: string }) {
  const { data, content } = useMemo(() => parseFrontmatter(source), [source])

  return (
    <div className="wmde-markdown wmde-markdown-color">
      <FrontmatterHeader data={data} />
      <MDEditor.Markdown
        source={content}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeBlock,
        }}
      />
    </div>
  )
}

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  height?: number
  placeholder?: string
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

        const data = (await res.json()) as { url: string }
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
        components={{
          preview: (source) => <PreviewWithFrontmatter source={String(source)} />,
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
