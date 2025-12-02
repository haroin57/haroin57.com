import { Link, useParams } from 'react-router-dom'
import postsData from '../data/posts.json' with { type: 'json' }

type Post = { slug?: string; title?: string; html?: string; createdAt?: string }

const posts: Post[] = Array.isArray(postsData) ? (postsData as Post[]) : []

function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const post = posts.find((p) => p.slug === slug)
  const sortedPosts = [...posts].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

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

        {!post ? (
          <p className="text-[color:var(--fg,inherit)]">Post not found.</p>
        ) : (
          <>
            <article className="space-y-4">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                {post.title}
              </h1>
              {post.createdAt ? (
                <p className="text-sm text-[color:var(--fg,inherit)] opacity-80">{post.createdAt}</p>
              ) : null}
              {post.html ? (
                <div
                  className="prose prose-invert max-w-none font-morisawa-dragothic"
                  style={{ fontWeight: 500, color: 'var(--fg-strong)' }}
                  dangerouslySetInnerHTML={{ __html: post.html }}
                />
              ) : null}
            </article>
            {sortedPosts.length > 0 ? (
              <section className="mt-12 space-y-3">
                <h2 className="text-xl font-semibold text-[color:var(--fg-strong,inherit)]">More posts</h2>
                <ul className="font-vdl-logomaru list-disc space-y-2 pl-5">
                  {sortedPosts.map((p) => (
                    <li key={p.slug ?? p.title}>
                      <Link
                        to={p.slug ? `/posts/${p.slug}` : '/posts'}
                        className="underline-thin hover:text-accent"
                        style={{ color: 'var(--fg)' }}
                      >
                        {p.title ?? 'Untitled'}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
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

export default PostDetail
