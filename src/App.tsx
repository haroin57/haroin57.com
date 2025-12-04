import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import postsData from './data/posts.json' with { type: 'json' }
import AccessCounter from './components/AccessCounter'

type Interest = { title: string; text: string }
type PostMeta = { slug?: string; title?: string; createdAt?: string }

const interests: Interest[] = [
  { title: 'Go, Java, Typescript', text: 'Distributed computing, microservices, and Web development.' },
  { title: 'Frameworks', text: 'React, Next.js, Tailwind CSS' },
  { title: 'Linux', text: 'Virtual machines, shell scripting' },
  { title: 'Desktop music', text: 'Creating music using digital audio workstations.' },
  { title: 'Bike touring', text: 'Exploring new places and enjoying nature on two wheels.' },
  { title: 'PaaS', text: 'Cloudflare, Vercel, AWS' },
]

const allPosts: PostMeta[] = Array.isArray(postsData) ? (postsData as PostMeta[]) : []
const latestPosts: PostMeta[] = [...allPosts]
  .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  .slice(0, 5)

function App() {
  const [openInterests, setOpenInterests] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const navigate = useNavigate()

  const handlePostsClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setLeaving(true)
    setTimeout(() => navigate('/posts'), 180)
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
        className={`relative mx-auto min-h-screen max-w-4xl px-6 pb-20 pt-8 ${leaving ? 'page-exit' : 'page-fade'}`}
        style={{ fontFamily: `"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif`, color: 'var(--fg)' }}
      >
        <header className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <nav
            className="flex items-center gap-6 text-lg font-semibold"
            style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
          >
            <Link to="/" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
              Home
            </Link>
          </nav>
        </header>

        <section className="relative space-y-8">
          <div className="space-y-5">
            <h1 className="text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong)] md:text-4xl">
              haroin57 web
            </h1>
            <p className="text-base sm:text-lg leading-relaxed">
              I&apos;m haroin, an engineering student belonging to Shinshu University, interested in distributed systems, web
              development, and desktop music.
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setOpenInterests((v) => !v)}
              aria-expanded={openInterests}
              className="group relative inline-flex h-12 w-30 items-center justify-center overflow-hidden rounded-md border border-white/20 bg-transparent px-5 py-2 text-lg font-semibold"
              style={{ color: 'var(--fg)' }}
            >
              <div className="translate-y-0 opacity-100 transition duration-500 ease-in-out md:group-hover:-translate-y-[150%] md:group-hover:opacity-0">
                Interests
              </div>
              <div className="absolute translate-y-0 opacity-100 transition duration-500 ease-in-out md:translate-y-[150%] md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 transition-transform duration-300"
                  style={{ transform: openInterests ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <path
                    d="M7.5 2C7.77614 2 8 2.22386 8 2.5L8 11.2929L11.1464 8.14645C11.3417 7.95118 11.6583 7.95118 11.8536 8.14645C12.0488 8.34171 12.0488 8.65829 11.8536 8.85355L7.85355 12.8536C7.75979 12.9473 7.63261 13 7.5 13C7.36739 13 7.24021 12.9473 7.14645 12.8536L3.14645 8.85355C2.95118 8.65829 2.95118 8.34171 3.14645 8.14645C3.34171 7.95118 3.65829 7.95118 3.85355 8.14645L7 11.2929L7 2.5C7 2.22386 7.22386 2 7.5 2Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>
          </div>
          <div className={`glass-panel collapse ${openInterests ? 'open' : 'closed'}`}>
            <ul className="list-disc space-y-4 pl-6 text-base">
              {interests.map((item) => (
                <li key={item.title}>
                  <div className="text-lg font-medium">{item.title}</div>
                  <div className="mt-1 text-sm opacity-90">{item.text}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <div className="flex items-center justify-between">
            <Link
              to="/posts"
              onClick={handlePostsClick}
              className="relative inline-flex h-12 w-30 items-center justify-center overflow-hidden rounded border border-white/20 bg-transparent px-5 py-2.5 text-lg font-semibold transition-all duration-300 hover:bg-white/10"
              style={{ color: 'var(--fg)' }}
            >
              <span className="relative">Posts (ja)</span>
            </Link>
          </div>
          <div className="text-base font-medhium text-[color:var(--fg-strong)] px-1">Latest Posts</div>
          <div className="glass-panel">
            <ul className="list-disc space-y-3 pl-6 text-base font-vdl-logomaru">
              {latestPosts.map((post) => (
                <li key={post.slug ?? post.title}>
                  <Link
                    to={post.slug ? `/posts/${post.slug}` : '/posts'}
                    className="text-base underline-thin hover:text-accent"
                    style={{ color: 'var(--fg)' }}
                  >
                    {post.title ?? 'Untitled'}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <Link
              to="/products"
              className="relative inline-flex h-12 w-30 items-center justify-center overflow-hidden rounded border border-white/20 bg-transparent px-5 py-2.5 text-lg font-semibold transition-all duration-300 hover:bg-white/10"
              style={{ color: 'var(--fg)' }}
            >
              <span className="relative">Products</span>
            </Link>
          </div>
        </section>
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

export default App
