import { Link, useNavigate, useParams } from 'react-router-dom'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

type Post = { slug?: string; title?: string; html?: string; createdAt?: string }
// tagsはgen-postsで配列化される前提
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type TaggedPost = Post & { tags?: string[] }

const posts: TaggedPost[] = Array.isArray(postsData) ? (postsData as TaggedPost[]) : []

function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
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
          className="flex items-center gap-4 text-lg font-semibold"
          style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="group relative inline-flex h-10 items-center overflow-hidden bg-transparent px-1 text-lg font-semibold underline-thin text-[color:var(--fg)]"
          >
            <span className="transition duration-200 group-hover:-translate-x-full group-hover:opacity-0">Back</span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 translate-x-full transition duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 rotate-180"
              >
                <path
                  d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </button>
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
                  className="prose prose-invert max-w-none font-morisawa-dragothic text-base sm:text-[15px]"
                  style={{ fontWeight: 500, color: 'var(--fg-strong)' }}
                  dangerouslySetInnerHTML={{ __html: post.html }}
                />
              ) : null}
            </article>
            {sortedPosts.length > 0 ? (
              <section className="mt-12 space-y-3">
                <h2 className="text-xl font-semibold text-[color:var(--fg-strong,inherit)]">More posts</h2>
                <ul className="font-vdl-logomaru list-disc space-y-2 pl-5 text-sm sm:text-[15px]">
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
