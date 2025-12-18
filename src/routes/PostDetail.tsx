import { useLocation, useParams, Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState, useCallback, startTransition } from 'react'
import mermaid from 'mermaid'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'
import PrefetchLink from '../components/PrefetchLink'

// Mermaidの初期化（サイトのglass-panel UIに合わせた黒ベースのテーマ）
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    // 背景・サーフェス（透過背景、glass-panel風）
    background: 'transparent',
    mainBkg: 'rgba(0, 0, 0, 0.3)',
    secondaryBkg: 'rgba(0, 0, 0, 0.2)',
    tertiaryColor: 'rgba(0, 0, 0, 0.15)',

    // ノード・クラスター（透過度を上げて背景を見せる）
    primaryColor: 'rgba(0, 0, 0, 0.35)',
    secondaryColor: 'rgba(0, 0, 0, 0.25)',
    nodeBorder: 'rgba(255, 255, 255, 0.4)',
    clusterBkg: 'rgba(0, 0, 0, 0.2)',
    clusterBorder: 'rgba(255, 255, 255, 0.3)',

    // ボーダー・ライン（白の半透明、--ui-border相当）
    primaryBorderColor: 'rgba(255, 255, 255, 0.35)',
    lineColor: 'rgba(255, 255, 255, 0.5)',

    // テキスト（--fg, --fg-strong相当）
    primaryTextColor: '#e2e8f0',
    secondaryTextColor: '#e2e8f0',
    tertiaryTextColor: '#e2e8f0',
    titleColor: '#ffffff',
    nodeTextColor: '#e2e8f0',

    // エッジラベル
    edgeLabelBackground: 'rgba(0, 0, 0, 0.4)',

    // シーケンス図用（透過背景）
    actorBkg: 'rgba(0, 0, 0, 0.35)',
    actorBorder: 'rgba(255, 255, 255, 0.4)',
    actorTextColor: '#e2e8f0',
    actorLineColor: 'rgba(255, 255, 255, 0.35)',
    signalColor: '#e2e8f0',
    signalTextColor: '#e2e8f0',
    labelBoxBkgColor: 'rgba(0, 0, 0, 0.3)',
    labelBoxBorderColor: 'rgba(255, 255, 255, 0.3)',
    labelTextColor: '#e2e8f0',
    loopTextColor: '#e2e8f0',
    noteBkgColor: 'rgba(0, 0, 0, 0.3)',
    noteBorderColor: 'rgba(255, 255, 255, 0.3)',
    noteTextColor: '#e2e8f0',
    activationBkgColor: 'rgba(255, 255, 255, 0.08)',
    activationBorderColor: 'rgba(255, 255, 255, 0.35)',

    // 状態遷移図用
    labelColor: '#e2e8f0',
    altBackground: 'rgba(0, 0, 0, 0.15)',

    // クラス図・ER図用
    classText: '#e2e8f0',
    relationColor: 'rgba(255, 255, 255, 0.5)',
    relationLabelColor: '#e2e8f0',

    // 円グラフ用
    pie1: 'rgba(255, 255, 255, 0.7)',
    pie2: 'rgba(255, 255, 255, 0.5)',
    pie3: 'rgba(255, 255, 255, 0.35)',
    pie4: 'rgba(255, 255, 255, 0.2)',
    pie5: 'rgba(255, 255, 255, 0.1)',
    pieStrokeColor: 'rgba(0, 0, 0, 0.8)',
    pieStrokeWidth: '1px',
    pieOuterStrokeColor: 'rgba(255, 255, 255, 0.3)',
  },
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 15,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
})

type Post = { slug?: string; title?: string; summary?: string; html?: string; createdAt?: string }
// tagsはgen-postsで配列化される前提
type TaggedPost = Post & { tags?: string[] }

const posts: TaggedPost[] = Array.isArray(postsData) ? (postsData as TaggedPost[]) : []
const GOOD_ENDPOINT = import.meta.env.VITE_GOOD_ENDPOINT || '/api/good'
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
  const post = posts.find((p) => p.slug === slug)
  const location = useLocation()
  const [goodCount, setGoodCount] = useState<number>(0)
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [isVoting, setIsVoting] = useState<boolean>(false)
  const proseRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // 即座にreveal要素を表示（遅延なし）
  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    // マイクロタスクで即座に表示
    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [])

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

  // Mermaidブロックをレンダリング
  useEffect(() => {
    const proseRoot = proseRef.current
    if (!proseRoot) return

    const mermaidBlocks = proseRoot.querySelectorAll<HTMLElement>('.mermaid-block')
    if (mermaidBlocks.length === 0) return

    const renderMermaid = async () => {
      for (const block of mermaidBlocks) {
        const code = block.getAttribute('data-mermaid')
        if (!code || block.querySelector('svg')) continue

        try {
          const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
          const { svg } = await mermaid.render(id, code)
          block.innerHTML = svg
          block.classList.add('mermaid-rendered')
        } catch (err) {
          console.error('Mermaid rendering error:', err)
          block.innerHTML = `<div class="mermaid-error">Failed to render diagram</div>`
        }
      }
    }

    renderMermaid()
  }, [post?.html])

  useEffect(() => {
    const body = document.body
    body.classList.add('post-detail-page')

    const rootStyle = window.getComputedStyle(document.documentElement)
    const baseWashRaw = rootStyle.getPropertyValue('--bg-wash').trim()
    const baseWash = Number.isFinite(Number.parseFloat(baseWashRaw)) ? Number.parseFloat(baseWashRaw) : 0

    const startPx = 48
    const rangePx = 420
    const maxBlurPx = 5
    const maxExtraWash = 0.12

    let rafId = 0
    const update = () => {
      const y = window.scrollY || 0
      const t = Math.max(0, Math.min(1, (y - startPx) / rangePx))
      const blur = t * maxBlurPx
      const wash = Math.min(0.9, baseWash + t * maxExtraWash)
      const scale = 1 + blur / 140

      body.style.setProperty('--bg-blur', `${blur.toFixed(2)}px`)
      body.style.setProperty('--bg-scale', scale.toFixed(4))
      body.style.setProperty('--bg-wash', wash.toFixed(3))
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
      const durationMs = 120
      const startedAt = performance.now()

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / durationMs)
        const k = easeOutCubic(t)
        const blur = startBlur * (1 - k)
        const scale = startScale + (1 - startScale) * k
        const wash = startWash + (baseWash - startWash) * k

        body.style.setProperty('--bg-blur', `${blur.toFixed(2)}px`)
        body.style.setProperty('--bg-scale', scale.toFixed(4))
        body.style.setProperty('--bg-wash', wash.toFixed(3))

        if (t < 1) {
          window.requestAnimationFrame(tick)
          return
        }

        body.classList.remove('post-detail-page')
        body.style.removeProperty('--bg-blur')
        body.style.removeProperty('--bg-scale')
        body.style.removeProperty('--bg-wash')
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
        className="relative z-10 mx-auto min-h-screen max-w-4xl px-4 py-10 space-y-6 page-fade sm:px-6 sm:py-12"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <header
          className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
          style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
        >
          <PrefetchLink to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </PrefetchLink>
        </header>

        {!post ? (
          <p className="text-[color:var(--fg,inherit)]">Post not found.</p>
        ) : (
          <>
            <article className="reveal space-y-4 w-full">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                {post.title}
              </h1>
              {post.createdAt ? (
                <p className="text-sm sm:text-base text-[color:var(--fg,inherit)] opacity-80">{post.createdAt}</p>
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

      <footer
        className="relative z-10 mt-12 flex items-center justify-between border-t border-[color:var(--ui-border)] px-4 py-6 sm:px-6"
        style={{ color: 'var(--fg)', fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
      >
        <div className="text-xs sm:text-sm opacity-70 flex items-center gap-3">
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
