import { useSearchParams} from 'react-router-dom'
import PrefetchLink from '../components/PrefetchLink'
import { useMemo, useRef, useCallback, startTransition } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import SiteFooter from '../components/SiteFooter'
import { useFetch } from '../hooks/useFetch'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { CMS_ENDPOINT } from '../lib/endpoints'
import { usePageMeta } from '../hooks/usePageMeta'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

type Post = {
  slug?: string
  title?: string
  html?: string
  summary?: string
  createdAt?: string
  updatedAt?: string | null
  tags?: string[]
  status?: 'draft' | 'published'
}

const staticPosts: Post[] = Array.isArray(postsData) ? (postsData as Post[]) : []

function Posts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTag = searchParams.get('tag') || 'all'
  const pageRef = useRef<HTMLDivElement | null>(null)

  // Postsページのメタタグ
  usePageMeta({
    title: 'Posts | haroin57 web',
    description: 'haroinのブログ記事一覧',
    ogTitle: 'Posts | haroin57 web',
    ogDescription: 'haroinのブログ記事一覧',
  })

  useScrollToTop()

  // CMS APIから記事一覧を取得（失敗時は静的データにフォールバック）
  // SSRハイドレーション時は静的データを使用し、初回APIフェッチをスキップ
  type PostsResponse = { posts: Post[] }
  const fetchOptions = useMemo(() => ({
    fallback: staticPosts,
    transform: (data: PostsResponse) => data.posts?.length > 0 ? data.posts : staticPosts,
    skipInitialFetch: true,
  }), [])
  const { data: posts, isLoading } = useFetch<Post[], PostsResponse>(
    `${CMS_ENDPOINT}/posts`,
    fetchOptions
  )

  // reveal要素を表示
  useReveal(pageRef, isLoading)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((p) => (p.tags || []).forEach((t) => set.add(t)))
    return Array.from(set)
  }, [posts])

  // 日付でソートされた投稿一覧
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA // 新しい順
    })
  }, [posts])

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return sortedPosts
    return sortedPosts.filter((p) => (p.tags || []).includes(selectedTag))
  }, [selectedTag, sortedPosts])

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
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="mx-auto w-full max-w-5xl space-y-6 text-left">
            <header
              className="reveal flex items-center justify-between gap-4"
              style={MAIN_FONT_STYLE}
            >
              <div className="flex items-center gap-4 text-lg sm:text-xl font-semibold">
                <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                  Home
                </PrefetchLink>
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
                      <p className="text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-75">{p.createdAt?.split('T')[0]}</p>
                    </div>
                    <h2 className="text-base sm:text-xl text-[color:var(--fg-strong,inherit)]">
                      <PrefetchLink
                        to={p.slug ? `/posts/${p.slug}` : '/posts'}
                        className="underline-thin hover:text-accent"
                        style={{ color: 'inherit' }}
                      >
                        {p.title ?? 'Untitled'}
                      </PrefetchLink>
                    </h2>
                    {p.summary ? (
                      <p className="text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-80">{p.summary}</p>
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

      <SiteFooter />
    </div>
  )
}

export default Posts
