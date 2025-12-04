import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

type Post = { slug?: string; title?: string; html?: string; summary?: string; createdAt?: string; tags?: string[] }
const posts: Post[] = Array.isArray(postsData) ? (postsData as Post[]) : []

function Posts() {
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // クエリパラメータから初期タグを設定
  useEffect(() => {
    const tag = searchParams.get('tag')
    if (tag) setSelectedTag(tag)
  }, [searchParams])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((p) => (p.tags || []).forEach((t) => set.add(t)))
    return Array.from(set)
  }, [])

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return posts
    return posts.filter((p) => (p.tags || []).includes(selectedTag))
  }, [selectedTag])

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag)
    if (tag === 'all') {
      searchParams.delete('tag')
      setSearchParams(searchParams)
    } else {
      searchParams.set('tag', tag)
      setSearchParams(searchParams)
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center">
        <img
          src="/profile.png"
          alt="haroin profile"
          className="select-none"
          style={{ width: '100vw', height: '100vh', objectFit: 'cover', opacity: 'var(--overlay)' }}
        />
      </div>

      <main
        className="relative mx-auto min-h-screen max-w-4xl px-6 py-12 space-y-6 page-fade"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <header
          className="flex items-center gap-4 text-lg font-semibold"
          style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
        >
          <Link to="/" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </Link>
        </header>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
          Posts
        </h1>
        {allTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTagSelect('all')}
              className={`px-3 py-1 rounded-full border text-xs sm:text-sm transition ${
                selectedTag === 'all' ? 'border-white/70 bg-white/10' : 'border-white/20 bg-transparent'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagSelect(tag)}
                className={`px-3 py-1 rounded-full border text-xs sm:text-sm transition ${
                  selectedTag === tag ? 'border-white/70 bg-white/10' : 'border-white/20 bg-transparent'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="font-vdl-logomaru divide-y divide-white/20" style={{ borderTopWidth: '0.5px' }}>
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
                    <span key={tag} className="px-2 py-1 rounded-full border border-white/20 bg-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </main>

      <footer
        className="mt-12 border-t border-white/20 px-6 py-6 flex items-center justify-between"
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
