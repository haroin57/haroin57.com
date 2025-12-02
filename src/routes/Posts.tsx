import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }

type Post = { slug?: string; title?: string; html?: string; summary?: string; createdAt?: string }
const posts: Post[] = Array.isArray(postsData) ? (postsData as Post[]) : []

function Posts() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

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
          className="flex items-center gap-6 text-lg font-semibold"
          style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
        >
          <Link to="/" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </Link>
        </header>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
          Posts
        </h1>
        <ul className="space-y-6 font-vdl-logomaru">
          {posts.map((p, idx) => (
            <li key={p.slug ?? p.title ?? idx} className="space-y-1">
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
            </li>
          ))}
        </ul>
      </main>

      <footer
        className="mt-12 border-t border-white/20 px-6 py-6 flex items-center justify-between"
        style={{ color: 'var(--fg)', fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
      >
        <div className="text-xs opacity-70">© haroin</div>
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
