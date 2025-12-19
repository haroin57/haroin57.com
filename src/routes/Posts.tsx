import { useSearchParams, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useCallback, startTransition, useState } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'
import PrefetchLink from '../components/PrefetchLink'
import { useAdminAuth } from '../contexts/AdminAuthContext'

const CMS_ENDPOINT = import.meta.env.VITE_CMS_ENDPOINT || '/api/cms'

type Post = { slug?: string; title?: string; html?: string; summary?: string; createdAt?: string; tags?: string[] }
const staticPosts: Post[] = Array.isArray(postsData) ? (postsData as Post[]) : []

function Posts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTag = searchParams.get('tag') || 'all'
  const pageRef = useRef<HTMLDivElement | null>(null)
  const { isAdmin, loginWithGoogle, logout, isLoading: authLoading } = useAdminAuth()

  // 動的に取得した記事一覧
  const [posts, setPosts] = useState<Post[]>(staticPosts)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // CMS APIから記事一覧を取得（失敗時は静的データにフォールバック）
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${CMS_ENDPOINT}/posts`)
        if (res.ok) {
          const data = (await res.json()) as { posts: Post[] }
          if (data.posts && data.posts.length > 0) {
            setPosts(data.posts)
          }
        }
      } catch {
        // API失敗時は静的データを使用
      } finally {
        setIsLoading(false)
      }
    }
    fetchPosts()
  }, [])

  // reveal要素を表示
  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [isLoading])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((p) => (p.tags || []).forEach((t) => set.add(t)))
    return Array.from(set)
  }, [posts])

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return posts
    return posts.filter((p) => (p.tags || []).includes(selectedTag))
  }, [selectedTag, posts])

  const handleTagSelect = useCallback(
    (tag: string) => {
      startTransition(() => {
        const nextParams = new URLSearchParams(searchParams)
        if (tag === 'all') {
          nextParams.delete('tag')
        } else {
          nextParams.set('tag', tag)
        }
        setSearchParams(nextParams)
      })
    },
    [searchParams, setSearchParams]
  )

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto w-full max-w-2xl space-y-6 text-left">
            <header
              className="reveal flex items-center justify-between gap-4"
              style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
            >
              <div className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
                <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                  Home
                </PrefetchLink>
              </div>
              {/* 管理者UI */}
              <div className="flex items-center gap-2">
                {authLoading ? null : isAdmin ? (
                  <>
                    <Link
                      to="/admin/posts/new"
                      className="px-3 py-1 rounded border border-green-500/50 bg-green-500/10 text-green-400 text-xs sm:text-sm font-semibold transition-colors hover:bg-green-500/20"
                    >
                      新規作成
                    </Link>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="px-3 py-1 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] text-xs sm:text-sm font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                    >
                      ログアウト
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => loginWithGoogle()}
                    className="px-3 py-1 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--fg)] text-xs sm:text-sm font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                  >
                    管理者ログイン
                  </button>
                )}
              </div>
            </header>
            <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              Posts
            </h1>
            {allTags.length > 0 ? (
              <div className="reveal flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTagSelect('all')}
                  className={`px-3 py-1 rounded-full border text-xs sm:text-sm transition-colors ${
                    selectedTag === 'all'
                      ? 'border-[color:var(--ui-border-strong)] bg-[color:var(--ui-surface-hover)]'
                      : 'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]'
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagSelect(tag)}
                    className={`px-3 py-1 rounded-full border text-xs sm:text-sm transition-colors ${
                      selectedTag === tag
                        ? 'border-[color:var(--ui-border-strong)] bg-[color:var(--ui-surface-hover)]'
                        : 'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}

            {isLoading ? (
              <div className="reveal py-8 text-center opacity-70">読み込み中...</div>
            ) : (
              <ul className="reveal font-vdl-logomaru posts-divider">
                {filtered.map((p, idx) => (
                  <li key={p.slug ?? p.title ?? idx} className="space-y-2 py-4 group">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-75">{p.createdAt}</p>
                      {isAdmin && p.slug && (
                        <Link
                          to={`/admin/posts/${p.slug}/edit`}
                          className="px-2 py-0.5 rounded border border-blue-500/50 bg-blue-500/10 text-blue-400 text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 hover:bg-blue-500/20"
                        >
                          編集
                        </Link>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-2xl text-[color:var(--fg-strong,inherit)]">
                      <PrefetchLink
                        to={p.slug ? `/posts/${p.slug}` : '/posts'}
                        className="underline-thin hover:text-accent"
                        style={{ color: 'inherit' }}
                      >
                        {p.title ?? 'Untitled'}
                      </PrefetchLink>
                    </h2>
                    {p.summary ? (
                      <p className="text-xs sm:text-base text-[color:var(--fg,inherit)] opacity-80">{p.summary}</p>
                    ) : null}
                    {p.tags && p.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-[11px] sm:text-sm">
                        {p.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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

export default Posts
