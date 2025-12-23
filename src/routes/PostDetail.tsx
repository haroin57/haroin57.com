import { useLocation, useParams, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState, useCallback, startTransition } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import PrefetchLink from '../components/PrefetchLink'
import SiteFooter from '../components/SiteFooter'
import ClientOnly from '../components/ClientOnly'
import { useMermaidBlocks } from '../hooks/useMermaidBlocks'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { CMS_ENDPOINT, GOOD_ENDPOINT } from '../lib/endpoints'
import { usePageMeta } from '../hooks/usePageMeta'
import { MAIN_FONT_STYLE, MAIN_TEXT_STYLE } from '../styles/typography'

type Post = { slug?: string; title?: string; summary?: string; html?: string; createdAt?: string }
// tagsはgen-postsで配列化される前提
type TaggedPost = Post & { tags?: string[] }

const staticPosts: TaggedPost[] = Array.isArray(postsData) ? (postsData as TaggedPost[]) : []
const SERVER_APPLY_DELAY_MS = 350

function extractCodeText(codeElement: HTMLElement): string {
  const lineElements = codeElement.querySelectorAll('[data-line]')
  if (lineElements.length === 0) return codeElement.textContent ?? ''
  return Array.from(lineElements)
    .map((el) => el.textContent ?? '')
    .join('\n')
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '0'
      textarea.style.left = '0'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}

function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  // 静的データから初期値を取得（フォールバック用）
  const staticPost = staticPosts.find((p) => p.slug === slug)
  const [post, setPost] = useState<TaggedPost | null>(staticPost ?? null)
  const [isLoading, setIsLoading] = useState(!staticPost)
  const location = useLocation()
  const [goodCount, setGoodCount] = useState<number>(0)
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [isVoting, setIsVoting] = useState<boolean>(false)
  const proseRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)

  // CMS APIから記事データを取得
  useEffect(() => {
    if (!slug) return
    let mounted = true

    const fetchPost = async () => {
      try {
        const res = await fetch(`${CMS_ENDPOINT}/posts/${slug}`)
        if (!res.ok) {
          if (mounted) setIsLoading(false)
          return
        }
        const data = (await res.json()) as { post?: TaggedPost }
        if (!mounted) return
        if (data.post) {
          setPost(data.post)
        }
      } catch {
        // API失敗時は静的データを使用
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    fetchPost()
    return () => {
      mounted = false
    }
  }, [slug])

  useScrollToTop()

  // 即座にreveal要素を表示（遅延なし）
  // postが変更されたときにも再実行
  useReveal(pageRef, [post])
  // Mermaidブロックをレンダリング
  useMermaidBlocks(proseRef, [post?.html])

  const siteOrigin = (import.meta.env.VITE_SITE_ORIGIN || 'https://haroin57.com').replace(/\/$/, '')

  const shareUrl = useMemo(() => {
    return `${siteOrigin}${location.pathname}`
  }, [location.pathname, siteOrigin])

  // 記事のメタタグを動的に設定
  const descSource = useMemo(() => {
    if (!post) return ''
    return post.summary
      ? post.summary
      : post.html
        ? post.html.replace(/<[^>]+>/g, '').slice(0, 120) || 'haroin57 web'
        : 'haroin57 web'
  }, [post])

  usePageMeta(
    post
      ? {
          title: `${post.title ?? 'Post'} | haroin57 web`,
          description: descSource,
          ogTitle: post.title ?? 'haroin57 web',
          ogDescription: descSource,
          ogUrl: shareUrl,
          twitterTitle: post.title ?? 'haroin57 web',
          twitterDescription: descSource,
        }
      : {}
  )

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
      } catch {
        // ignore fetch errors
      }
    }
    fetchCount()
    return () => {
      mounted = false
    }
  }, [slug])

  useEffect(() => {
    const proseRoot = proseRef.current
    if (!proseRoot) return

    const timeouts = new Map<HTMLButtonElement, number>()
    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest?.('button.mdn-code-copy') as HTMLButtonElement | null
      if (!button) return

      const figure = button.closest('figure[data-rehype-pretty-code-figure]') as HTMLElement | null
      const code = figure?.querySelector('pre > code') as HTMLElement | null
      if (!code) return

      const codeText = extractCodeText(code).trimEnd()
      if (!codeText) return

      const ok = await writeToClipboard(codeText)
      if (!ok) return

      const prev = timeouts.get(button)
      if (prev) window.clearTimeout(prev)
      button.classList.add('is-copied')
      button.textContent = 'Copied'

      const timer = window.setTimeout(() => {
        button.classList.remove('is-copied')
        button.textContent = 'Copy'
        timeouts.delete(button)
      }, 1200)

      timeouts.set(button, timer)
    }

    proseRoot.addEventListener('click', onClick)
    return () => {
      proseRoot.removeEventListener('click', onClick)
      for (const timer of timeouts.values()) {
        window.clearTimeout(timer)
      }
      timeouts.clear()
    }
  }, [post?.html])

  useEffect(() => {
    const body = document.body
    body.classList.add('post-detail-page')

    const rootStyle = window.getComputedStyle(document.documentElement)
    const baseWashRaw = rootStyle.getPropertyValue('--bg-wash').trim()
    const baseWash = Number.isFinite(Number.parseFloat(baseWashRaw)) ? Number.parseFloat(baseWashRaw) : 0

    const startPx = 48
    const rangePx = 420
    const maxBlurPx = 12
    const maxExtraWash = 0.2
    const minOpacity = 0.65

    let rafId = 0
    const update = () => {
      const y = window.scrollY || 0
      const t = Math.max(0, Math.min(1, (y - startPx) / rangePx))
      const blur = t * maxBlurPx
      const wash = Math.min(0.6, baseWash + t * maxExtraWash)
      const scale = 1 + blur / 140
      const opacity = 1 - t * (1 - minOpacity)

      body.style.setProperty('--bg-blur', `${blur.toFixed(2)}px`)
      body.style.setProperty('--bg-scale', scale.toFixed(4))
      body.style.setProperty('--bg-wash', wash.toFixed(3))
      body.style.setProperty('--bg-opacity', opacity.toFixed(3))
    }

    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        update()
      })
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) window.cancelAnimationFrame(rafId)

      const parseNumber = (value: string, fallback: number) => {
        const n = Number.parseFloat(value)
        return Number.isFinite(n) ? n : fallback
      }

      const startBlur = parseNumber(body.style.getPropertyValue('--bg-blur'), 0)
      const startScale = parseNumber(body.style.getPropertyValue('--bg-scale'), 1)
      const startWash = parseNumber(body.style.getPropertyValue('--bg-wash'), baseWash)
      const startOpacity = parseNumber(body.style.getPropertyValue('--bg-opacity'), 1)
      const durationMs = 120
      const startedAt = performance.now()

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / durationMs)
        const k = easeOutCubic(t)
        const blur = startBlur * (1 - k)
        const scale = startScale + (1 - startScale) * k
        const wash = startWash + (baseWash - startWash) * k
        const opacity = startOpacity + (1 - startOpacity) * k

        body.style.setProperty('--bg-blur', `${blur.toFixed(2)}px`)
        body.style.setProperty('--bg-scale', scale.toFixed(4))
        body.style.setProperty('--bg-wash', wash.toFixed(3))
        body.style.setProperty('--bg-opacity', opacity.toFixed(3))

        if (t < 1) {
          window.requestAnimationFrame(tick)
          return
        }

        body.classList.remove('post-detail-page')
        body.style.removeProperty('--bg-blur')
        body.style.removeProperty('--bg-scale')
        body.style.removeProperty('--bg-wash')
        body.style.removeProperty('--bg-opacity')
      }

      window.requestAnimationFrame(tick)
    }
  }, [])

  const handleGood = useCallback(async () => {
    if (!slug || isVoting) return
    const action = hasVoted ? 'unvote' : 'vote'
    const prevCount = goodCount
    const prevVoted = hasVoted
    const optimistic = action === 'vote' ? prevCount + 1 : Math.max(0, prevCount - 1)

    // 楽観的更新をstartTransitionでラップ
    startTransition(() => {
      setGoodCount(optimistic)
      setHasVoted(!prevVoted)
    })
    setIsVoting(true)

    try {
      const res = await fetch(GOOD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action }),
      })
      const data = (await res.json()) as { total?: number; voted?: boolean }
      if (res.ok) {
        // サーバー応答の適用をわずかに遅らせ、楽観的な表示を維持する
        await new Promise((resolve) => setTimeout(resolve, SERVER_APPLY_DELAY_MS))
        const total = typeof data.total === 'number' ? data.total : optimistic
        const voted = typeof data.voted === 'boolean' ? data.voted : action === 'vote'
        startTransition(() => {
          setGoodCount(total)
          setHasVoted(voted)
        })
        window.localStorage.setItem(`good-count-${slug}`, String(total))
        if (voted) window.localStorage.setItem(`good-voted-${slug}`, '1')
        else window.localStorage.removeItem(`good-voted-${slug}`)
      } else {
        // revert on failure
        startTransition(() => {
          setGoodCount(prevCount)
          setHasVoted(prevVoted)
        })
      }
    } catch {
      // revert on error
      startTransition(() => {
        setGoodCount(prevCount)
        setHasVoted(prevVoted)
      })
    } finally {
      setIsVoting(false)
    }
  }, [slug, isVoting, hasVoted, goodCount])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto min-h-screen max-w-4xl px-4 pt-16 pb-10 space-y-6 page-fade sm:px-6 sm:pt-20 sm:pb-12"
        style={MAIN_TEXT_STYLE}
      >
        <header
          className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
          style={MAIN_FONT_STYLE}
        >
          <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </PrefetchLink>
          <span className="opacity-50">/</span>
          <PrefetchLink to="/posts" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Posts
          </PrefetchLink>
        </header>

        {isLoading ? (
          <p className="text-[color:var(--fg,inherit)]">Loading...</p>
        ) : !post ? (
          <p className="text-[color:var(--fg,inherit)]">Post not found.</p>
        ) : (
          <>
            <article className="reveal space-y-4 w-full">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                {post.title}
              </h1>
              {post.createdAt ? (
                <p className="text-sm sm:text-base text-[color:var(--fg,inherit)] opacity-80">
                  {post.createdAt.split('T')[0]}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {post.tags && post.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-[11px] sm:text-sm">
                    {post.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/posts?tag=${encodeURIComponent(tag)}`}
                        className="px-2 py-1 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              {post.html ? (
                <div
                  ref={proseRef}
                  className="prose prose-invert font-medium font-a-otf-gothic text-sm sm:text-[19px] w-full"
                  style={{ color: 'var(--fg-strong)' }}
                  dangerouslySetInnerHTML={{ __html: post.html }}
                />
              ) : null}
            </article>
            <ClientOnly>
              <section className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={handleGood}
                  disabled={isVoting}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm sm:text-base font-semibold transition border ${
                    hasVoted
                      ? 'border-[color:var(--ui-border-strong)] bg-[color:var(--ui-surface)] hover:bg-[color:var(--ui-surface-hover)]'
                      : 'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]'
                  }`}
                  style={{ color: 'var(--fg)' }}
                >
                  <img src="/good.svg" alt="Good" className="good-icon h-5 w-5" />
                  <span className="tracking-wide">{`${hasVoted ? 'Good!' : 'Good'} ${goodCount}`}</span>
                </button>
              </section>
            </ClientOnly>
            {shareUrl ? (
              <section className="mt-4 flex justify-center">
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title ?? '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] text-sm sm:text-base"
                  aria-label="Share on X"
                  style={{ color: 'var(--fg)' }}
                >
                  <span>Share on</span>
                  <img src="/X_logo.svg" alt="X" className="x-share-icon h-4 w-4" />
                </a>
              </section>
            ) : null}
            <section className="mt-6 flex justify-start">
              <Link
                to="/posts"
                className="font-morisawa-dragothic underline-thin hover:text-accent text-base sm:text-lg"
                style={{ color: 'var(--fg)' }}
              >
                ← Posts一覧へ
              </Link>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

export default PostDetail
