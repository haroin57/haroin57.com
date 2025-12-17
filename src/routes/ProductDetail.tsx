import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import mermaid from 'mermaid'
import productsData from '../data/products.json' with { type: 'json' }
import productPostsData from '../data/product-posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

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

type TechStackItem = {
  category: string
  items: string[]
}

type ProductContent = {
  overview: string
  features: string[]
  techStack: TechStackItem[]
}

type Product = {
  slug: string
  name: string
  description: string
  language: string
  tags?: string[]
  url: string
  demo?: string
  content?: ProductContent
}

type ProductPost = {
  slug: string
  productSlug: string
  title: string
  summary: string
  createdAt: string | null
  tags: string[]
  html: string
}

const products: Product[] = Array.isArray(productsData) ? (productsData as Product[]) : []
const productPosts: ProductPost[] = Array.isArray(productPostsData) ? (productPostsData as ProductPost[]) : []

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
}

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

function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const product = products.find((p) => p.slug === slug)
  const productPost = productPosts.find((p) => p.productSlug === slug)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const proseRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!product) return
    document.title = `${product.name} | Products | haroin57`
  }, [product])

  // スクロール時の背景ぼかしエフェクト
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

  // コードブロックのコピーボタン用イベントハンドラ
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
  }, [productPost?.html])

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
  }, [productPost?.html])

  return (
    <div ref={pageRef} className="relative">
      <main
        className="relative z-10 min-h-screen flex flex-col"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 space-y-6 sm:px-6 sm:py-12">
            <header
              className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
              style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
            >
              <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Home
              </Link>
              <span className="opacity-50">/</span>
              <Link to="/products" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Products
              </Link>
            </header>

            {!product ? (
              <p className="text-[color:var(--fg,inherit)]">Product not found.</p>
            ) : (
              <article className="space-y-8">
                <section className="reveal space-y-4">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                      {product.name}
                    </h1>
                    <span className="flex items-center gap-1.5 text-sm sm:text-base">
                      <span
                        className="h-3 w-3 sm:h-4 sm:w-4 rounded-full"
                        style={{ backgroundColor: languageColors[product.language] || '#6e7681' }}
                      />
                      {product.language}
                    </span>
                  </div>

                  <p className="text-base sm:text-lg opacity-85">{product.description}</p>

                  {product.tags && product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-xs sm:text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-sm sm:text-base font-medium transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="opacity-80 sm:w-5 sm:h-5"
                      >
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                      View on GitHub
                    </a>
                    {product.demo && (
                      <a
                        href={product.demo}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-sm sm:text-base font-medium transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)]"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="opacity-80 sm:w-5 sm:h-5"
                        >
                          <path
                            d="M3 2C2.44772 2 2 2.44772 2 3V12C2 12.5523 2.44772 13 3 13H12C12.5523 13 13 12.5523 13 12V8.5C13 8.22386 12.7761 8 12.5 8C12.2239 8 12 8.22386 12 8.5V12H3V3H6.5C6.77614 3 7 2.77614 7 2.5C7 2.22386 6.77614 2 6.5 2H3ZM12.8536 2.14645C12.9015 2.19439 12.9377 2.24964 12.9621 2.30861C12.9861 2.36669 12.9996 2.4303 13 2.497L13 2.5V2.50049V5.5C13 5.77614 12.7761 6 12.5 6C12.2239 6 12 5.77614 12 5.5V3.70711L6.85355 8.85355C6.65829 9.04882 6.34171 9.04882 6.14645 8.85355C5.95118 8.65829 5.95118 8.34171 6.14645 8.14645L11.2929 3H9.5C9.22386 3 9 2.77614 9 2.5C9 2.22386 9.22386 2 9.5 2H12.4999H12.5C12.5678 2 12.6324 2.01349 12.6914 2.03794C12.7504 2.06234 12.8056 2.09851 12.8536 2.14645Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          />
                        </svg>
                        Live Demo
                      </a>
                    )}
                  </div>
                </section>

                {/* Markdown記事がある場合はそれを表示、なければJSON contentを表示 */}
                {productPost?.html ? (
                  <section className="reveal space-y-4">
                    <div
                      ref={proseRef}
                      className="prose prose-invert font-medium font-a-otf-gothic text-sm sm:text-[19px] w-full"
                      style={{ color: 'var(--fg-strong)' }}
                      dangerouslySetInnerHTML={{ __html: productPost.html }}
                    />
                  </section>
                ) : product.content && (
                  <>
                    <section className="reveal space-y-3">
                      <h2 className="text-lg sm:text-2xl font-semibold text-[color:var(--fg-strong)]">
                        Overview
                      </h2>
                      <div className="glass-panel p-4 sm:p-6">
                        <p className="text-sm sm:text-lg leading-relaxed font-a-otf-gothic">
                          {product.content.overview}
                        </p>
                      </div>
                    </section>

                    <section className="reveal space-y-3">
                      <h2 className="text-lg sm:text-2xl font-semibold text-[color:var(--fg-strong)]">
                        Features
                      </h2>
                      <div className="glass-panel p-4 sm:p-6">
                        <ul className="space-y-2 text-sm sm:text-lg font-a-otf-gothic">
                          {product.content.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-1.5 sm:mt-2 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-current opacity-60 shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>

                    <section className="reveal space-y-3">
                      <h2 className="text-lg sm:text-2xl font-semibold text-[color:var(--fg-strong)]">
                        Tech Stack
                      </h2>
                      <div className="glass-panel p-4 sm:p-6">
                        <div className="space-y-4">
                          {product.content.techStack.map((stack) => (
                            <div key={stack.category}>
                              <h3 className="text-xs sm:text-sm uppercase tracking-wider opacity-70 mb-2">
                                {stack.category}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {stack.items.map((item) => (
                                  <span
                                    key={item}
                                    className="px-3 py-1.5 rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-sm sm:text-base"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </>
                )}

                <section className="reveal pt-4">
                  <Link
                    to="/products"
                    className="font-morisawa-dragothic underline-thin hover:text-accent text-base sm:text-lg"
                    style={{ color: 'var(--fg)' }}
                  >
                    ← Products一覧へ
                  </Link>
                </section>
              </article>
            )}
        </div>

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
      </main>
    </div>
  )
}

export default ProductDetail
