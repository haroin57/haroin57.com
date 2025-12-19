import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AccessCounter from '../components/AccessCounter'
import PrefetchLink from '../components/PrefetchLink'

// スレッド型
type Thread = {
  id: string
  title: string
  createdAt: string
  createdBy: string
  postCount: number
  lastPostAt: string
}

const BBS_ENDPOINT = import.meta.env.VITE_BBS_ENDPOINT || '/api/bbs'

function BBSList() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState('')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // reveal要素を即座に表示（データ取得後も再実行）
  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [isLoading, threads])

  // ページタイトル設定
  useEffect(() => {
    document.title = 'BBS | haroin57'
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

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto min-h-screen max-w-4xl px-4 py-10 space-y-6 page-fade sm:px-6 sm:py-12"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <header
          className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
          style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
        >
          <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </PrefetchLink>
        </header>

        <article className="reveal space-y-4 w-full">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              haroin57 BBSスレッド
            </h1>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold text-sm transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
            >
              {showCreateForm ? 'キャンセル' : 'スレッドを立てる'}
            </button>
          </div>

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
                  <Link
                    key={thread.id}
                    to={`/bbs/${thread.id}`}
                    className="block p-3 rounded border border-transparent hover:border-[color:var(--ui-border)] hover:bg-[color:var(--ui-surface-hover)] transition-colors"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
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

      <footer
        className="relative z-10 mt-12 flex items-center justify-between border-t border-[color:var(--ui-border)] px-4 py-6 sm:px-6"
        style={{ color: 'var(--fg)', fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
      >
        <div className="text-xs sm:text-sm opacity-70 flex items-center gap-3">
          <AccessCounter />
          <span>© haroin</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://x.com/haroin57" target="_blank" rel="noreferrer" className="hover:opacity-100 opacity-80">
            <img src="/X_logo.svg" alt="X profile" className="footer-logo" />
          </a>
          <a href="https://github.com/haroin57" target="_blank" rel="noreferrer" className="hover:opacity-100 opacity-80">
            <img src="/github.svg" alt="GitHub profile" className="footer-logo" />
          </a>
        </div>
      </footer>
    </div>
  )
}

export default BBSList
