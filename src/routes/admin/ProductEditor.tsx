import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import MarkdownEditor from '../../components/admin/MarkdownEditor'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { saveDraft, loadDraft, deleteDraft, formatDraftDate, type ProductDraft } from '../../lib/draftStorage'
import { CMS_ENDPOINT } from '../../lib/endpoints'
import { MAIN_TEXT_STYLE } from '../../styles/typography'

type ProductData = {
  slug: string
  name: string
  description: string
  language: string
  tags: string[]
  url: string
  demo?: string
  markdown?: string
  html?: string
  createdAt: string
  updatedAt: string
}

// MarkdownをHTMLに変換
async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown)
  return String(result)
}

export default function ProductEditor() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAdmin, idToken, loginWithGoogle, isLoading: authLoading, registerBeforeLogout } = useAdminAuth()
  const pageRef = useRef<HTMLDivElement>(null)

  const isNewProduct = !slug || slug === 'new'

  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    language: '',
    tags: '',
    url: '',
    demo: '',
  })
  const [markdown, setMarkdown] = useState('')
  const [isLoading, setIsLoading] = useState(!isNewProduct)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftInfo, setDraftInfo] = useState<{ savedAt: number } | null>(null)
  const [showDraftNotice, setShowDraftNotice] = useState(false)

  // 現在のデータを下書きとして保存
  const saveCurrentDraft = useCallback(() => {
    if (!formData.slug && !formData.name && !markdown) return // 空の場合は保存しない

    saveDraft<ProductDraft>('product', slug || 'new', {
      slug: formData.slug,
      name: formData.name,
      description: formData.description,
      language: formData.language,
      tags: formData.tags,
      url: formData.url,
      demo: formData.demo,
      markdown,
    })
    setDraftInfo({ savedAt: Date.now() })
  }, [formData, markdown, slug])

  // ログアウト前に下書きを保存
  useEffect(() => {
    const unregister = registerBeforeLogout(() => {
      saveCurrentDraft()
    })
    return unregister
  }, [registerBeforeLogout, saveCurrentDraft])

  // 既存プロダクトの読み込み + 下書きチェック
  useEffect(() => {
    const fetchAndCheckDraft = async () => {
      // 下書きをチェック
      const draft = loadDraft<ProductDraft>('product', slug || 'new')

      if (isNewProduct) {
        // 新規作成の場合、下書きがあれば復元
        if (draft) {
          setFormData({
            slug: draft.slug,
            name: draft.name,
            description: draft.description,
            language: draft.language,
            tags: draft.tags,
            url: draft.url,
            demo: draft.demo,
          })
          setMarkdown(draft.markdown)
          setDraftInfo({ savedAt: draft.savedAt })
          setShowDraftNotice(true)
        }
        return
      }

      // 既存プロダクトの読み込み
      try {
        setIsLoading(true)
        const res = await fetch(`${CMS_ENDPOINT}/products/${slug}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('プロダクトが見つかりません')
            return
          }
          throw new Error('Failed to fetch product')
        }
        const data = await res.json() as { product: ProductData }

        // 下書きがあり、サーバーより新しい場合は復元確認
        if (draft && draft.savedAt > new Date(data.product.updatedAt).getTime()) {
          setFormData({
            slug: draft.slug,
            name: draft.name,
            description: draft.description,
            language: draft.language,
            tags: draft.tags,
            url: draft.url,
            demo: draft.demo,
          })
          setMarkdown(draft.markdown)
          setDraftInfo({ savedAt: draft.savedAt })
          setShowDraftNotice(true)
        } else {
          setFormData({
            slug: data.product.slug,
            name: data.product.name,
            description: data.product.description,
            language: data.product.language,
            tags: data.product.tags.join(', '),
            url: data.product.url,
            demo: data.product.demo || '',
          })
          setMarkdown(data.product.markdown || '')
        }
      } catch (err) {
        console.error('Failed to fetch product:', err)
        setError('プロダクトの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAndCheckDraft()
  }, [slug, isNewProduct])

  // ページタイトル
  useEffect(() => {
    document.title = isNewProduct
      ? '新規プロダクト作成 | Admin | haroin57'
      : `プロダクト編集: ${formData.name} | Admin | haroin57`
  }, [isNewProduct, formData.name])

  // 保存処理
  const handleSave = useCallback(async () => {
    if (!idToken) {
      alert('ログインが必要です')
      return
    }

    if (!formData.slug || !formData.name || !formData.description || !formData.language || !formData.url) {
      alert('スラッグ、名前、説明、言語、URLは必須です')
      return
    }

    setIsSaving(true)
    try {
      const html = markdown ? await markdownToHtml(markdown) : undefined
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const body = {
        slug: formData.slug,
        name: formData.name,
        description: formData.description,
        language: formData.language,
        tags,
        url: formData.url,
        demo: formData.demo || undefined,
        markdown: markdown || undefined,
        html,
      }

      const method = isNewProduct ? 'POST' : 'PUT'
      const url = isNewProduct ? `${CMS_ENDPOINT}/products` : `${CMS_ENDPOINT}/products/${slug}`

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json() as { product?: ProductData; error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product')
      }

      // 保存成功したら下書きを削除
      deleteDraft('product', slug || 'new')
      setDraftInfo(null)
      setShowDraftNotice(false)

      alert('保存しました')

      if (isNewProduct && data.product) {
        navigate(`/admin/products/${data.product.slug}/edit`, { replace: true })
      }
    } catch (err) {
      console.error('Failed to save product:', err)
      alert(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [idToken, formData, markdown, isNewProduct, slug, navigate])

  // 下書きを破棄
  const discardDraft = useCallback(() => {
    deleteDraft('product', slug || 'new')
    setDraftInfo(null)
    setShowDraftNotice(false)
    // ページをリロードして元のデータを読み込む
    window.location.reload()
  }, [slug])

  // 削除処理
  const handleDelete = useCallback(async () => {
    if (!idToken || isNewProduct) return
    if (!window.confirm('このプロダクトを削除しますか？この操作は取り消せません。')) return

    setIsSaving(true)
    try {
      const res = await fetch(`${CMS_ENDPOINT}/products/${slug}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to delete product')
      }

      alert('削除しました')
      navigate('/products')
    } catch (err) {
      console.error('Failed to delete product:', err)
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [idToken, isNewProduct, slug, navigate])

  // 認証待ち
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--fg)' }}>
        読み込み中...
      </div>
    )
  }

  // 未ログイン
  if (!isAdmin) {
    return (
      <div
        ref={pageRef}
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ color: 'var(--fg)' }}
      >
        <p>管理者ログインが必要です</p>
        <button
          type="button"
          onClick={() => loginWithGoogle()}
          className="px-6 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
        >
          Googleでログイン
        </button>
        <Link to="/products" className="text-sm underline opacity-70 hover:opacity-100">
          プロダクト一覧に戻る
        </Link>
      </div>
    )
  }

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 py-10 space-y-6 page-fade sm:px-6 sm:py-12"
        style={MAIN_TEXT_STYLE}
      >
        {/* ヘッダー */}
        <header className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
          <Link to="/products" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Products
          </Link>
          <span className="opacity-50">/</span>
          <span>{isNewProduct ? '新規作成' : '編集'}</span>
        </header>

        {/* 下書き復元通知 */}
        {showDraftNotice && draftInfo && (
          <div className="glass-panel p-4 border-l-4 border-yellow-500/50 bg-yellow-500/5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="text-yellow-400 font-semibold">下書きから復元しました</span>
                <span className="opacity-70 ml-2">
                  ({formatDraftDate(draftInfo.savedAt)})
                </span>
              </div>
              <button
                type="button"
                onClick={discardDraft}
                className="text-xs px-3 py-1 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] hover:border-[color:var(--ui-border-strong)]"
              >
                下書きを破棄
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center opacity-70">読み込み中...</div>
        ) : error ? (
          <div className="py-8 text-center text-red-400">{error}</div>
        ) : (
          <div className="space-y-6">
            {/* メタデータフォーム */}
            <div className="glass-panel p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-slug" className="block text-sm opacity-80 mb-1">
                    スラッグ（URL）
                  </label>
                  <input
                    id="product-slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    disabled={!isNewProduct}
                    placeholder="my-product-slug"
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="product-name" className="block text-sm opacity-80 mb-1">
                    名前
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="プロダクト名"
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="product-description" className="block text-sm opacity-80 mb-1">
                  説明
                </label>
                <input
                  id="product-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="プロダクトの説明"
                  className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-language" className="block text-sm opacity-80 mb-1">
                    言語
                  </label>
                  <input
                    id="product-language"
                    type="text"
                    value={formData.language}
                    onChange={(e) => setFormData((prev) => ({ ...prev, language: e.target.value }))}
                    placeholder="TypeScript, Python, etc."
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
                <div>
                  <label htmlFor="product-tags" className="block text-sm opacity-80 mb-1">
                    タグ（カンマ区切り）
                  </label>
                  <input
                    id="product-tags"
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="React, Node.js, etc."
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-url" className="block text-sm opacity-80 mb-1">
                    GitHub URL
                  </label>
                  <input
                    id="product-url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="https://github.com/..."
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
                <div>
                  <label htmlFor="product-demo" className="block text-sm opacity-80 mb-1">
                    Demo URL（任意）
                  </label>
                  <input
                    id="product-demo"
                    type="url"
                    value={formData.demo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, demo: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
              </div>
            </div>

            {/* Markdownエディタ */}
            <div className="glass-panel p-4">
              <label className="block text-sm opacity-80 mb-2">詳細説明（Markdown、任意）</label>
              <MarkdownEditor value={markdown} onChange={setMarkdown} height={400} />
            </div>

            {/* アクションボタン */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {!isNewProduct && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="px-4 py-2 rounded border border-red-500/50 bg-red-500/10 text-red-400 font-semibold transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    削除
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveCurrentDraft}
                  className="px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] text-sm transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                >
                  下書き保存
                </button>
                {draftInfo && !showDraftNotice && (
                  <span className="text-xs opacity-50">
                    保存済み: {formatDraftDate(draftInfo.savedAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/products"
                  className="px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                >
                  キャンセル
                </Link>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    isSaving ||
                    !formData.slug ||
                    !formData.name ||
                    !formData.description ||
                    !formData.language ||
                    !formData.url
                  }
                  className="px-6 py-2 rounded border border-green-500/50 bg-green-500/10 text-green-400 font-semibold transition-colors hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
