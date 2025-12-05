import { Link, useLocation, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

type Post = { slug?: string; title?: string; summary?: string; html?: string; createdAt?: string }
// tagsはgen-postsで配列化される前提
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type TaggedPost = Post & { tags?: string[] }

const posts: TaggedPost[] = Array.isArray(postsData) ? (postsData as TaggedPost[]) : []
const GOOD_ENDPOINT = import.meta.env.VITE_GOOD_ENDPOINT || '/api/good'

function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const post = posts.find((p) => p.slug === slug)
  const location = useLocation()
  const [goodCount, setGoodCount] = useState<number>(0)
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [isVoting, setIsVoting] = useState<boolean>(false)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}${location.pathname}`
  }, [location.pathname])

  useEffect(() => {
    if (!post) return
    const title = `${post.title ?? 'Post'} | haroin57`
    document.title = title

    const ensureMeta = (key: 'name' | 'property', value: string) => {
      let el = document.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(key, value)
        document.head.appendChild(el)
      }
      return el
    }

    const descSource = post.summary
      ? post.summary
      : post.html
        ? post.html.replace(/<[^>]+>/g, '').slice(0, 120) || 'haroin57 web'
        : 'haroin57 web'

    ensureMeta('name', 'description').setAttribute('content', descSource)
    ensureMeta('property', 'og:title').setAttribute('content', post.title ?? 'haroin57 web')
    ensureMeta('property', 'og:description').setAttribute('content', descSource)
    ensureMeta('property', 'og:url').setAttribute('content', shareUrl)
    ensureMeta('name', 'twitter:title').setAttribute('content', post.title ?? 'haroin57 web')
    ensureMeta('name', 'twitter:description').setAttribute('content', descSource)
    ensureMeta('name', 'twitter:card').setAttribute('content', 'summary_large_image')
    ensureMeta('name', 'twitter:url').setAttribute('content', shareUrl)
  }, [post, shareUrl])

  useEffect(() => {
    if (!slug) return
    let mounted = true
    const savedVote = typeof window !== 'undefined' && window.localStorage.getItem(`good-voted-${slug}`) === '1'
    const fetchCount = async () => {
      try {
        const res = await fetch(GOOD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, action: 'get' }),
        })
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as { total?: number; voted?: boolean }
        if (!mounted) return
        setGoodCount(typeof data.total === 'number' ? data.total : 0)
        setHasVoted(savedVote || Boolean(data.voted))
        if (!savedVote && data.voted) {
          window.localStorage.setItem(`good-voted-${slug}`, '1')
          if (typeof data.total === 'number') {
            window.localStorage.setItem(`good-count-${slug}`, String(data.total))
          }
        }
      } catch (e) {
        // ignore fetch errors
      }
    }
    fetchCount()
    return () => {
      mounted = false
    }
  }, [slug])

  const handleGood = async () => {
    if (!slug || isVoting) return
    const action = hasVoted ? 'unvote' : 'vote'
    const prevCount = goodCount
    const prevVoted = hasVoted
    const optimistic = action === 'vote' ? prevCount + 1 : Math.max(0, prevCount - 1)
    setGoodCount(optimistic)
    setHasVoted(!prevVoted)
    setIsVoting(true)
    try {
      const res = await fetch(GOOD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action }),
      })
      const data = (await res.json()) as { total?: number; voted?: boolean }
      if (res.ok) {
        const total = typeof data.total === 'number' ? data.total : optimistic
        const voted = typeof data.voted === 'boolean' ? data.voted : action === 'vote'
        setGoodCount(total)
        setHasVoted(voted)
        window.localStorage.setItem(`good-count-${slug}`, String(total))
        if (voted) window.localStorage.setItem(`good-voted-${slug}`, '1')
        else window.localStorage.removeItem(`good-voted-${slug}`)
      } else {
        // revert on failure
        setGoodCount(prevCount)
        setHasVoted(prevVoted)
      }
    } catch (e) {
      // revert on error
      setGoodCount(prevCount)
      setHasVoted(prevVoted)
    } finally {
      setIsVoting(false)
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
              <div className="flex flex-wrap items-center gap-3">
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
                {shareUrl ? (
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title ?? '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-white/20 bg-white/5 hover:border-white/60 transition text-[12px]"
                    aria-label="Share on X"
                  >
                    <img src="/X_logo.svg" alt="X" className="h-4 w-4" />
                    <span>Share</span>
                  </a>
                ) : null}
              </div>
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
            <section className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={handleGood}
                disabled={isVoting}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition border ${
                  hasVoted
                    ? 'border-white/20 bg-white/10 text-[color:var(--fg)]'
                    : 'border-white/40 bg-white/10 hover:border-white/80 hover:bg-white/20'
                }`}
                style={{ color: 'var(--fg)' }}
              >
                <img src="/good.svg" alt="Good" className="good-icon h-5 w-5" />
                <span className="tracking-wide">{`${hasVoted ? 'Good!' : 'Good'} ${goodCount}`}</span>
              </button>
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
          <span>c haroin</span>
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
