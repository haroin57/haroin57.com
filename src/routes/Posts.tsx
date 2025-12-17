import { useSearchParams, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useCallback, startTransition } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

type Post = { slug?: string; title?: string; html?: string; summary?: string; createdAt?: string; tags?: string[] }
const posts: Post[] = Array.isArray(postsData) ? (postsData as Post[]) : []

function Posts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTag = searchParams.get('tag') || 'all'
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      targets.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px 50px 0px' }
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((p) => (p.tags || []).forEach((t) => set.add(t)))
    return Array.from(set)
  }, [])

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return posts
    return posts.filter((p) => (p.tags || []).includes(selectedTag))
  }, [selectedTag])

  const handleTagSelect = useCallback((tag: string) => {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams)
      if (tag === 'all') {
        nextParams.delete('tag')
      } else {
        nextParams.set('tag', tag)
      }
      setSearchParams(nextParams)
    })
  }, [searchParams, setSearchParams])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto w-full max-w-2xl space-y-6 text-left">
            <header
              className="reveal flex items-center gap-4 text-lg font-semibold"
              style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
            >
              <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Home
              </Link>
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

            <ul className="reveal font-vdl-logomaru posts-divider">
              {filtered.map((p, idx) => (
                <li key={p.slug ?? p.title ?? idx} className="space-y-2 py-4">
                  <p className="text-xs text-[color:var(--fg,inherit)] opacity-75">{p.createdAt}</p>
                  <h2 className="text-lg sm:text-xl text-[color:var(--fg-strong,inherit)]">
                    <Link
                      to={p.slug ? `/posts/${p.slug}` : '/posts'}
                      className="underline-thin hover:text-accent"
                      style={{ color: 'inherit' }}
                    >
                      {p.title ?? 'Untitled'}
                    </Link>
                  </h2>
                  {p.summary ? (
                    <p className="text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-80">{p.summary}</p>
                  ) : null}
                  {p.tags && p.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
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
          </div>
        </div>
      </main>

      <footer
        className="relative z-10 mt-12 flex items-center justify-between border-t border-[color:var(--ui-border)] px-4 py-6 sm:px-6"
        style={{ color: 'var(--fg)', fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
      >
        <div className="text-xs opacity-70 flex items-center gap-3">
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
