import { Link, useParams } from 'react-router-dom'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

type Post = { slug?: string; title?: string; html?: string; createdAt?: string }
// tagsはgen-postsで配列化される前提
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type TaggedPost = Post & { tags?: string[] }

const posts: TaggedPost[] = Array.isArray(postsData) ? (postsData as TaggedPost[]) : []

function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const post = posts.find((p) => p.slug === slug)

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

        {!post ? (
          <p className="text-[color:var(--fg,inherit)]">Post not found.</p>
        ) : (
          <>
            <article className="space-y-4 w-full">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                {post.title}
              </h1>
              {post.createdAt ? (
                <p className="text-sm text-[color:var(--fg,inherit)] opacity-80">{post.createdAt}</p>
              ) : null}
              {post.tags && post.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/posts?tag=${encodeURIComponent(tag)}`}
                      className="px-2 py-1 rounded-full border border-white/20 bg-white/5 hover:border-white/60 transition"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              ) : null}
              {post.html ? (
                <div
                  className="prose prose-invert font-medium font-a-otf-gothic text-sm sm:text-[15px] w-full"
                  style={{ color: 'var(--fg-strong)' }}
                  dangerouslySetInnerHTML={{ __html: post.html }}
                />
              ) : null}
            </article>
            <section className="mt-12">
              <Link
                to="/posts"
                className="font-morisawa-dragothic underline-thin hover:text-accent text-base sm:text-[15px]"
                style={{ color: 'var(--fg)' }}
              >
                ← Posts一覧へ
              </Link>
            </section>
          </>
        )}
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

export default PostDetail
