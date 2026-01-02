import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams} from 'react-router-dom'
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import { useAdminAuth } from '../hooks/useAdminAuth'
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

// 投稿型
type Post = {
  id: number
  name: string
  date: string
  userId: string
  content: string
}

// アンカーリンク（>>数字）をパース
function parseContent(content: string): React.ReactNode[] {
  const parts = content.split(/(&gt;&gt;\d+|>>\d+)/g)
  return parts.map((part, index) => {
    const anchorMatch = part.match(/(?:&gt;&gt;|>>)(\d+)/)
    if (anchorMatch) {
      const targetId = anchorMatch[1]
      return (
        <a
          key={index}
          href={`#post-${targetId}`}
          className="text-blue-400 hover:text-blue-300 hover:underline"
          onClick={(e) => {
            e.preventDefault()
            const target = document.getElementById(`post-${targetId}`)
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' })
              target.classList.add('bbs-highlight')
              setTimeout(() => target.classList.remove('bbs-highlight'), 2000)
            }
          }}
        >
          {`>>${targetId}`}
        </a>
      )
    }
    // 改行を<br>に変換
    return part.split('\n').map((line, lineIndex, arr) => (
      <span key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < arr.length - 1 && <br />}
      </span>
    ))
  })
}

function BBSThread() {
  const { threadId } = useParams<{ threadId: string }>()
  const [thread, setThread] = useState<Thread | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const { isAdmin, idToken } = useAdminAuth()

  // スレッドページのメタタグ
  usePageMeta(
    thread
      ? {
          title: `${thread.title} | BBS | haroin57 web`,
          description: `${thread.title} - 掲示板スレッド`,
          ogTitle: `${thread.title} | BBS | haroin57 web`,
          ogDescription: `${thread.title} - 掲示板スレッド`,
        }
      : {
          title: 'BBS | haroin57 web',
          description: '掲示板スレッド',
          ogTitle: 'BBS | haroin57 web',
          ogDescription: '掲示板スレッド',
      }
  )

  useScrollToTop()

  // reveal要素を即座に表示（データ取得後も再実行）
  useReveal(pageRef, isLoading)

  // スレッド取得
  const fetchThread = useCallback(async () => {
    if (!threadId) return

    try {
      setIsLoading(true)
      const res = await fetch(`${BBS_ENDPOINT}/threads/${threadId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('スレッドが見つかりません')
        } else {
          throw new Error('Failed to fetch thread')
        }
        return
      }
      const data = (await res.json()) as { thread: Thread; posts: Post[] }
      setThread(data.thread)
      setPosts(data.posts || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch thread:', err)
      setError('スレッドの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    fetchThread()
  }, [fetchThread])

  // ページタイトル設定
  useEffect(() => {
    if (thread) {
      document.title = `${thread.title} | BBS`
    } else {
      document.title = 'BBS'
    }
  }, [thread])

  // 投稿送信
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!content.trim() || isSubmitting || !threadId) return

      setIsSubmitting(true)

      try {
        const res = await fetch(`${BBS_ENDPOINT}/threads/${threadId}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim() || '名無しさん',
            content: content.trim(),
          }),
        })

        const data = (await res.json()) as { post?: Post; thread?: Thread; error?: string }

        if (!res.ok || !data.post || !data.thread) {
          throw new Error(data.error || 'Failed to add post')
        }

        // 新しい投稿を追加
        setPosts((prev) => [...prev, data.post!])
        setThread(data.thread!)
        setContent('')

        // 投稿後、新しい投稿までスクロール
        setTimeout(() => {
          const newPostElement = document.getElementById(`post-${data.post!.id}`)
          if (newPostElement) {
            newPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      } catch (err) {
        console.error('Failed to add post:', err)
        alert(err instanceof Error ? err.message : '投稿に失敗しました')
      } finally {
        setIsSubmitting(false)
      }
    },
    [content, isSubmitting, name, threadId]
  )

  // 投稿削除（管理者用）
  const handleDeletePost = useCallback(
    async (postId: number) => {
      if (!idToken || !threadId || deletingPostId) return
      if (!window.confirm(`レス${postId}を削除しますか？`)) return

      setDeletingPostId(postId)
      try {
        const res = await fetch(`${BBS_ENDPOINT}/threads/${threadId}/posts/${postId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        if (!res.ok) {
          const data = await res.json() as { error?: string }
          throw new Error(data.error || 'Failed to delete post')
        }

        // 削除された投稿を「削除済み」表示に更新
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, name: '削除済み', content: 'この投稿は削除されました' }
              : p
          )
        )
      } catch (err) {
        console.error('Failed to delete post:', err)
        alert(err instanceof Error ? err.message : '投稿の削除に失敗しました')
      } finally {
        setDeletingPostId(null)
      }
    },
    [idToken, threadId, deletingPostId]
  )

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <header
              className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
              style={MAIN_FONT_STYLE}
            >
              <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Home
              </PrefetchLink>
              <span className="opacity-50">/</span>
              <PrefetchLink to="/bbs" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                BBS
              </PrefetchLink>
            </header>

        {isLoading ? (
          <div className="reveal text-[color:var(--fg)] opacity-70 py-8 text-center">読み込み中...</div>
        ) : error ? (
          <div className="reveal space-y-4">
            <p className="text-red-400 py-8 text-center">{error}</p>
            <div className="flex justify-center">
              <PrefetchLink
                to="/bbs"
                className="px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
              >
                スレッド一覧に戻る
              </PrefetchLink>
            </div>
          </div>
        ) : thread ? (
          <article className="reveal space-y-4 w-full">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              {thread.title}
            </h1>

            {/* スレッド情報 */}
            <div className="glass-panel p-4 text-sm opacity-80">
              <span className="text-[color:var(--fg)]">
                1-{posts.length} / {posts.length}レス
              </span>
            </div>

            {/* 投稿一覧 */}
            <div className="space-y-1">
              {posts.map((post) => (
                <div
                  key={post.id}
                  id={`post-${post.id}`}
                  className="bbs-post glass-panel p-4 transition-colors duration-300 group relative"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm mb-2">
                    <span className="font-bold text-[color:var(--fg-strong)]">{post.id}</span>
                    <span className="text-green-400 font-semibold">{post.name}</span>
                    <span className="text-[color:var(--fg)] opacity-70">{post.date}</span>
                    <span className="text-red-400 opacity-80">ID:{post.userId}</span>
                    {isAdmin && post.name !== '削除済み' && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPostId === post.id}
                        className="ml-auto px-2 py-0.5 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {deletingPostId === post.id ? '削除中...' : '削除'}
                      </button>
                    )}
                  </div>
                  <div className="text-sm sm:text-base text-[color:var(--fg)] whitespace-pre-wrap break-words pl-4">
                    {parseContent(post.content)}
                  </div>
                </div>
              ))}
            </div>

            {/* 書き込みフォーム */}
            <div className="glass-panel p-4 mt-6">
              <h2 className="text-lg font-semibold text-[color:var(--fg-strong)] mb-4">書き込み</h2>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-shrink-0">
                    <label htmlFor="bbs-name" className="block text-sm text-[color:var(--fg)] opacity-80 mb-1">
                      名前
                    </label>
                    <input
                      id="bbs-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="名無しさん"
                      maxLength={50}
                      className="w-full sm:w-48 px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="bbs-content" className="block text-sm text-[color:var(--fg)] opacity-80 mb-1">
                    本文
                  </label>
                  <textarea
                    id="bbs-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="書き込む内容を入力..."
                    rows={4}
                    maxLength={2000}
                    className="w-full px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] placeholder:opacity-50 focus:outline-none focus:border-[color:var(--ui-border-strong)] resize-vertical"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!content.trim() || isSubmitting}
                    className="px-6 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? '送信中...' : '書き込む'}
                  </button>
                </div>
              </form>
            </div>

            {/* 戻るリンク */}
            <section className="mt-6 flex justify-start">
              <PrefetchLink
                to="/bbs"
                className="font-morisawa-dragothic underline-thin hover:text-accent text-base sm:text-lg"
                style={{ color: 'var(--fg)' }}
              >
                ← スレッド一覧へ
              </PrefetchLink>
            </section>
          </article>
        ) : null}
          </div>
        </div>

        <SiteFooter />
      </main>

      <style>{`
        .bbs-highlight {
          box-shadow: inset 3px 0 0 var(--ui-border-strong);
          background-color: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
    </div>
  )
}

export default BBSThread
