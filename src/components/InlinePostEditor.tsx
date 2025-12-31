import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { CMS_ENDPOINT } from '../lib/endpoints'
import { loadMermaid } from '../utils/mermaid'

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

type InlinePostEditorProps = {
  markdown: string
  slug: string
  idToken: string | null
  onSave: (newMarkdown: string, newHtml: string) => void
  onClose: () => void
}

export default function InlinePostEditor({
  markdown,
  slug,
  idToken,
  onSave,
  onClose,
}: InlinePostEditorProps) {
  const [value, setValue] = useState(markdown)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
          setValue((prev) => prev + markdownImage)
        }
      }
    },
    [handleImageUpload]
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
            setValue((prev) => prev + markdownImage)
          }
        }
      }
    },
    [handleImageUpload]
  )

  // 保存処理
  const handleSave = useCallback(async () => {
    if (!idToken) {
      setError('ログインが必要です')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // APIでMarkdownを更新してHTMLを取得
      const res = await fetch(`${CMS_ENDPOINT}/posts/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          markdown: value,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存に失敗しました')
      }

      const data = (await res.json()) as { post: { html: string; markdown: string } }
      onSave(data.post.markdown, data.post.html)
    } catch (err) {
      console.error('Save failed:', err)
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [idToken, slug, value, onSave])

  // Escキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      // Ctrl/Cmd + S で保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, handleSave])

  // 変更があるかチェック
  const hasChanges = useMemo(() => value !== markdown, [value, markdown])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--ui-surface)] border-b border-[color:var(--ui-border)]">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[color:var(--fg-strong)]">
            記事を編集中
          </h2>
          {hasChanges && (
            <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
              未保存の変更があります
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm text-red-400">{error}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] hover:bg-[color:var(--ui-surface-hover)] transition-colors"
            style={{ color: 'var(--fg)' }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2 text-sm rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white font-medium"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* エディタ本体 */}
      <div
        ref={editorRef}
        className="flex-1 overflow-hidden"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onPaste={handlePaste}
        data-color-mode="dark"
      >
        {isUploading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="text-white font-semibold">アップロード中...</div>
          </div>
        )}
        <MDEditor
          value={value}
          onChange={(val) => setValue(val || '')}
          height="100%"
          preview="live"
          visibleDragbar={false}
          textareaProps={{
            placeholder: 'Markdownを入力...',
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
            preview: (source) => (
              <div className="wmde-markdown wmde-markdown-color p-4">
                <MDEditor.Markdown
                  source={String(source)}
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code: CodeBlock,
                  }}
                />
              </div>
            ),
          }}
          style={{
            height: '100%',
          }}
        />
      </div>

      {/* フッター */}
      <div className="px-4 py-2 bg-[color:var(--ui-surface)] border-t border-[color:var(--ui-border)] text-xs text-[color:var(--fg)] opacity-60">
        <span>Ctrl/Cmd + S で保存 • Esc でキャンセル • 画像はドラッグ&ドロップまたはペーストでアップロード</span>
      </div>
    </div>
  )
}