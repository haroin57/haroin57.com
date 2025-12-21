import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import MarkdownEditor from '../../components/admin/MarkdownEditor'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { saveDraft, loadDraft, deleteDraft, formatDraftDate, revertPostToDraft, type PostDraft } from '../../lib/draftStorage'

const CMS_ENDPOINT = import.meta.env.VITE_CMS_ENDPOINT || '/api/cms'

type PostData = {
  slug: string
  title: string
  summary: string
  markdown: string
  html: string
  tags: string[]
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

export default function PostEditor() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const draftKey = searchParams.get('draft') // URLから下書きキーを取得
  const navigate = useNavigate()
  const { isAdmin, idToken, loginWithGoogle, isLoading: authLoading, registerBeforeLogout } = useAdminAuth()
  const pageRef = useRef<HTMLDivElement>(null)

  const isNewPost = !slug || slug === 'new'

  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    summary: '',
    tags: '',
  })
  const [markdown, setMarkdown] = useState('')
  const [isLoading, setIsLoading] = useState(!isNewPost)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftInfo, setDraftInfo] = useState<{ savedAt: number } | null>(null)
  const [showDraftNotice, setShowDraftNotice] = useState(false)

  // 現在のデータを下書きとして保存
  const saveCurrentDraft = useCallback(() => {
    if (!formData.slug && !formData.title && !markdown) return // 空の場合は保存しない

    const targetKey = draftKey || slug || 'new'
    saveDraft<PostDraft>('post', targetKey, {
      slug: formData.slug,
      title: formData.title,
      summary: formData.summary,
      tags: formData.tags,
      markdown,
    })
    setDraftInfo({ savedAt: Date.now() })
  }, [formData, markdown, slug, draftKey])

  // ログアウト前に下書きを保存
  useEffect(() => {
    const unregister = registerBeforeLogout(() => {
      saveCurrentDraft()
    })
    return unregister
  }, [registerBeforeLogout, saveCurrentDraft])

  // 既存記事の読み込み + 下書きチェック
  useEffect(() => {
    const fetchAndCheckDraft = async () => {
      // URLパラメータから下書きキーが指定されている場合は優先的に読み込む
      const targetDraftKey = draftKey || (slug || 'new')
      const draft = loadDraft<PostDraft>('post', targetDraftKey)

      if (isNewPost) {
        // 新規作成の場合、下書きがあれば復元
        if (draft) {
          setFormData({
            slug: draft.slug,
            title: draft.title,
            summary: draft.summary,
            tags: draft.tags,
          })
          setMarkdown(draft.markdown)
          setDraftInfo({ savedAt: draft.savedAt })
          setShowDraftNotice(true)
        }
        return
      }

      // 既存記事の読み込み
      try {
        setIsLoading(true)
        const res = await fetch(`${CMS_ENDPOINT}/posts/${slug}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('記事が見つかりません')
            return
          }
          throw new Error('Failed to fetch post')
        }
        const data = await res.json() as { post: PostData }

        // 下書きがあり、サーバーより新しい場合は復元確認
        if (draft && draft.savedAt > new Date(data.post.updatedAt).getTime()) {
          setFormData({
            slug: draft.slug,
            title: draft.title,
            summary: draft.summary,
            tags: draft.tags,
          })
          setMarkdown(draft.markdown)
          setDraftInfo({ savedAt: draft.savedAt })
          setShowDraftNotice(true)
        } else {
          setFormData({
            slug: data.post.slug,
            title: data.post.title,
            summary: data.post.summary,
            tags: data.post.tags.join(', '),
          })
          setMarkdown(data.post.markdown)
        }
      } catch (err) {
        console.error('Failed to fetch post:', err)
        setError('記事の取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAndCheckDraft()
  }, [slug, isNewPost, draftKey])

  // ページタイトル
  useEffect(() => {
    document.title = isNewPost ? '新規記事作成 | Admin | haroin57' : `記事編集: ${formData.title} | Admin | haroin57`
  }, [isNewPost, formData.title])

  // 保存処理
  const handleSave = useCallback(async () => {
    if (!idToken) {
      alert('ログインが必要です')
      return
    }

    if (!formData.slug || !formData.title || !markdown) {
      alert('スラッグ、タイトル、本文は必須です')
      return
    }

    setIsSaving(true)
    try {
      const html = await markdownToHtml(markdown)
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const body = {
        slug: formData.slug,
        title: formData.title,
        summary: formData.summary,
        markdown,
        html,
        tags,
      }

      const method = isNewPost ? 'POST' : 'PUT'
      const url = isNewPost ? `${CMS_ENDPOINT}/posts` : `${CMS_ENDPOINT}/posts/${slug}`

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json() as { post?: PostData; error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save post')
      }

      // 保存成功したら下書きを削除
      const targetKey = draftKey || slug || 'new'
      deleteDraft('post', targetKey)
      setDraftInfo(null)
      setShowDraftNotice(false)

      alert('保存しました')

      if (isNewPost && data.post) {
        navigate(`/admin/posts/${data.post.slug}/edit`, { replace: true })
      }
    } catch (err) {
      console.error('Failed to save post:', err)
      alert(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [idToken, formData, markdown, isNewPost, slug, navigate, draftKey])

  // 下書きを破棄
  const discardDraft = useCallback(() => {
    const targetKey = draftKey || slug || 'new'
    deleteDraft('post', targetKey)
    setDraftInfo(null)
    setShowDraftNotice(false)
    // ページをリロードして元のデータを読み込む
    window.location.reload()
  }, [slug, draftKey])

  // 削除処理
  const handleDelete = useCallback(async () => {
    if (!idToken || isNewPost) return
    if (!window.confirm('この記事を削除しますか？この操作は取り消せません。')) return

    setIsSaving(true)
    try {
      const res = await fetch(`${CMS_ENDPOINT}/posts/${slug}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to delete post')
      }

      alert('削除しました')
      navigate('/posts')
    } catch (err) {
      console.error('Failed to delete post:', err)
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [idToken, isNewPost, slug, navigate])

  // 下書きに戻す処理（公開済み記事をローカル下書きとして保存し、サーバーから削除）
  const handleRevertToDraft = useCallback(async () => {
    if (!idToken || isNewPost) return
    if (!window.confirm('この記事を下書きに戻しますか？\n公開されている記事は削除され、ローカルの下書きとして保存されます。')) return

    setIsSaving(true)
    try {
      // まず現在のデータを下書きとして保存
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      revertPostToDraft({
        slug: formData.slug,
        title: formData.title,
        summary: formData.summary,
        tags,
        markdown,
        createdAt: new Date().toISOString().split('T')[0], // 現在の日付
      })

      // サーバーから削除
      const res = await fetch(`${CMS_ENDPOINT}/posts/${slug}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to delete post from server')
      }

      alert('下書きに戻しました。投稿一覧の下書きセクションから再編集・再投稿できます。')
      navigate('/posts')
    } catch (err) {
      console.error('Failed to revert to draft:', err)
      alert(err instanceof Error ? err.message : '下書きへの変換に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [idToken, isNewPost, slug, formData, markdown, navigate])

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
        <Link to="/posts" className="text-sm underline opacity-70 hover:opacity-100">
          記事一覧に戻る
        </Link>
      </div>
    )
  }

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 py-10 space-y-6 page-fade sm:px-6 sm:py-12"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        {/* ヘッダー */}
        <header className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
          <Link to="/posts" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Posts
          </Link>
          <span className="opacity-50">/</span>
          <span>{isNewPost ? '新規作成' : '編集'}</span>
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
                  <label htmlFor="post-slug" className="block text-sm opacity-80 mb-1">
                    スラッグ（URL）
                  </label>
                  <input
                    id="post-slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    disabled={!isNewPost}
                    placeholder="my-post-slug"
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="post-title" className="block text-sm opacity-80 mb-1">
                    タイトル
                  </label>
                  <input
                    id="post-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="記事のタイトル"
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="post-summary" className="block text-sm opacity-80 mb-1">
                  概要
                </label>
                <input
                  id="post-summary"
                  type="text"
                  value={formData.summary}
                  onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                  placeholder="記事の概要（一覧に表示されます）"
                  className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                />
              </div>
              <div>
                <label htmlFor="post-tags" className="block text-sm opacity-80 mb-1">
                  タグ（カンマ区切り）
                </label>
                <input
                  id="post-tags"
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3"
                  className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                />
              </div>
            </div>

            {/* Markdownエディタ */}
            <div className="glass-panel p-4">
              <label className="block text-sm opacity-80 mb-2">本文（Markdown）</label>
              <MarkdownEditor value={markdown} onChange={setMarkdown} height={500} />
            </div>

            {/* アクションボタン */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {!isNewPost && (
                  <>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving}
                      className="px-4 py-2 rounded border border-red-500/50 bg-red-500/10 text-red-400 font-semibold transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      削除
                    </button>
                    <button
                      type="button"
                      onClick={handleRevertToDraft}
                      disabled={isSaving}
                      className="px-4 py-2 rounded border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 font-semibold transition-colors hover:bg-yellow-500/20 disabled:opacity-50"
                    >
                      下書きに戻す
                    </button>
                  </>
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
                  to="/posts"
                  className="px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                >
                  キャンセル
                </Link>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !formData.slug || !formData.title || !markdown}
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
