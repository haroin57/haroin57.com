import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { BBS_ENDPOINT } from '../lib/endpoints'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

// スレッド型
type Thread = {
  id: string
  title: string
  createdAt: string
  createdBy: string
  postCount: number
  lastPostAt: string
}

function BBSList() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState('')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const { isAdmin, idToken, loginWithGoogle, logout } = useAdminAuth()

  // BBSページのメタタグ
  usePageMeta({
    title: 'BBS | haroin57 web',
    description: '自由に書き込める掲示板',
    ogTitle: 'BBS | haroin57 web',
    ogDescription: '自由に書き込める掲示板',
  })

  useScrollToTop()

  // reveal要素を即座に表示（データ取得後も再実行）
  useReveal(pageRef, [isLoading, threads])

  // ページタイトル設定
  useEffect(() => {
    document.title = 'BBS'
  }, [])

  // スレッド一覧取得
  const fetchThreads = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`${BBS_ENDPOINT}/threads`)
      if (!res.ok) throw new Error('Failed to fetch threads')
      const data = await res.json() as { threads: Thread[] }
      setThreads(data.threads || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch threads:', err)
      setError('スレッド一覧の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  // スレッド作成
  const handleCreateThread = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim() || !content.trim() || isSubmitting) return

      setIsSubmitting(true)
      try {
        const res = await fetch(`${BBS_ENDPOINT}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            name: name.trim() || '名無しさん',
            content: content.trim(),
          }),
        })

        const data = await res.json() as { thread?: Thread; error?: string }

        if (!res.ok || !data.thread) {
          throw new Error(data.error || 'Failed to create thread')
        }

        // 新スレッドをリストに追加
        setThreads((prev) => [data.thread!, ...prev])
        setTitle('')
        setName('')
        setContent('')
        setShowCreateForm(false)
      } catch (err) {
        console.error('Failed to create thread:', err)
        alert(err instanceof Error ? err.message : 'スレッドの作成に失敗しました')
      } finally {
        setIsSubmitting(false)
      }
    },
    [title, name, content, isSubmitting]
  )

  // 日時表示フォーマット
  const formatDisplayDate = (isoDate: string) => {
    const date = new Date(isoDate)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  }

  // 管理者ログイン（Google）
  const handleLogin = useCallback(async () => {
    if (isLoggingIn) return

    setIsLoggingIn(true)
    setLoginError(null)

    const success = await loginWithGoogle()
    if (!success) {
      setLoginError('管理者アカウントではありません')
    }
    setIsLoggingIn(false)
  }, [isLoggingIn, loginWithGoogle])

  // スレッド削除
  const handleDeleteThread = useCallback(
    async (threadId: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!idToken || deletingThreadId) return
      if (!window.confirm('このスレッドを削除しますか？この操作は取り消せません。')) return

      setDeletingThreadId(threadId)
      try {
        const res = await fetch(`${BBS_ENDPOINT}/threads/${threadId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        if (!res.ok) {
          const data = await res.json() as { error?: string }
          throw new Error(data.error || 'Failed to delete thread')
        }

        setThreads((prev) => prev.filter((t) => t.id !== threadId))
      } catch (err) {
        console.error('Failed to delete thread:', err)
        alert(err instanceof Error ? err.message : 'スレッドの削除に失敗しました')
      } finally {
        setDeletingThreadId(null)
      }
    },
    [idToken, deletingThreadId]
  )

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto min-h-screen max-w-4xl px-4 pt-16 pb-10 space-y-6 page-fade sm:px-6 sm:pt-20 sm:pb-12"
        style={MAIN_TEXT_STYLE}
      >
        <header
          className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
          style={MAIN_FONT_STYLE}
        >
          <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </PrefetchLink>
        </header>

        <article className="reveal space-y-4 w-full">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              haroin57 BBSスレッド
            </h1>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-2 rounded border border-red-500/50 bg-red-500/10 text-red-400 font-semibold text-xs transition-colors hover:bg-red-500/20"
                >
                  管理者ログアウト
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] opacity-60 font-semibold text-xs transition-colors hover:opacity-100 disabled:opacity-50"
                >
                  {isLoggingIn ? 'ログイン中...' : '管理者'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold text-sm transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
              >
                {showCreateForm ? 'キャンセル' : 'スレッドを立てる'}
              </button>
            </div>
          </div>

          {/* ログインエラー表示 */}
          {loginError && (
            <div className="glass-panel p-3 border border-red-500/50 bg-red-500/10">
              <p className="text-red-400 text-sm">{loginError}</p>
            </div>
          )}

          {/* スレッド作成フォーム */}
          {showCreateForm && (
            <div className="glass-panel p-4">
              <h2 className="text-lg font-semibold text-[color:var(--fg-strong)] mb-4">新規スレッド作成</h2>
              <form onSubmit={handleCreateThread} className="space-y-4">
                <div>
                  <label htmlFor="thread-title" className="block text-sm text-[color:var(--fg)] opacity-80 mb-1">
                    スレッドタイトル
                  </label>
                  <input
                    id="thread-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="スレッドのタイトル（必須）"
                    maxLength={100}
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
                <div>
                  <label htmlFor="thread-name" className="block text-sm text-[color:var(--fg)] opacity-80 mb-1">
                    名前
                  </label>
                  <input
                    id="thread-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="名無しさん"
                    maxLength={50}
                    className="w-full sm:w-48 px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                  />
                </div>
                <div>
                  <label htmlFor="thread-content" className="block text-sm text-[color:var(--fg)] opacity-80 mb-1">
                    本文（1レス目）
                  </label>
                  <textarea
                    id="thread-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="スレッドの最初の投稿内容（必須）"
                    rows={4}
                    maxLength={2000}
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)] resize-vertical"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!title.trim() || !content.trim() || isSubmitting}
                    className="px-6 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? '作成中...' : 'スレッドを作成'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* スレッド一覧 */}
          <div className="glass-panel p-4">
            {isLoading ? (
              <p className="text-[color:var(--fg)] opacity-70 py-4 text-center">読み込み中...</p>
            ) : error ? (
              <p className="text-red-400 py-4 text-center">{error}</p>
            ) : threads.length === 0 ? (
              <p className="text-[color:var(--fg)] opacity-70 py-4 text-center">
                スレッドがありません。最初のスレッドを立ててください。
              </p>
            ) : (
              <div className="space-y-2">
                {threads.map((thread, index) => (
                  <div key={thread.id} className="relative group">
                    <Link
                      to={`/bbs/${thread.id}`}
                      className="block p-3 rounded border border-transparent hover:border-[color:var(--ui-border)] hover:bg-[color:var(--ui-surface-hover)] transition-colors"
                    >
                      <div className="flex items-baseline gap-2 flex-wrap pr-16">
                        <span className="text-[color:var(--fg)] opacity-60 text-sm">{index + 1}:</span>
                        <span className="text-[color:var(--fg-strong)] font-semibold">{thread.title}</span>
                        <span className="text-[color:var(--fg)] opacity-60 text-sm">({thread.postCount})</span>
                      </div>
                      <div className="text-sm text-[color:var(--fg)] opacity-60 mt-1">
                        作成: {thread.createdBy} - {formatDisplayDate(thread.createdAt)}
                        {thread.lastPostAt !== thread.createdAt && (
                          <span className="ml-3">最終投稿: {formatDisplayDate(thread.lastPostAt)}</span>
                        )}
                      </div>
                    </Link>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteThread(thread.id, e)}
                        disabled={deletingThreadId === thread.id}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {deletingThreadId === thread.id ? '削除中...' : '削除'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 戻るリンク */}
          <section className="mt-6 flex justify-start">
            <Link
              to="/home"
              className="font-morisawa-dragothic underline-thin hover:text-accent text-base sm:text-lg"
              style={{ color: 'var(--fg)' }}
            >
              ← Homeへ
            </Link>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

export default BBSList
