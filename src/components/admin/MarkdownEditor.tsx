import { useState, useCallback, useRef } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

const CMS_ENDPOINT = import.meta.env.VITE_CMS_ENDPOINT || '/api/cms'

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
