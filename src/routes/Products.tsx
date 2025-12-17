import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import productsData from '../data/products.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'

type Product = {
  slug: string
  name: string
  description: string
  language: string
  tags?: string[]
  url: string
  demo?: string
}

const products: Product[] = Array.isArray(productsData) ? (productsData as Product[]) : []

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
}

function Products() {
  const pageRef = useRef<HTMLDivElement | null>(null)

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

  return (
    <div ref={pageRef} className="relative">
      <main
        className="relative z-10 min-h-screen flex flex-col"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto w-full max-w-2xl space-y-6 text-left">
            <header
              className="reveal flex items-center gap-4 text-lg sm:text-xl font-semibold"
              style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
            >
              <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
                Home
              </Link>
            </header>

            <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              Products
            </h1>

            <ul className="reveal space-y-4">
              {products.map((product) => (
                <li key={product.slug}>
                  <Link
                    to={`/products/${product.slug}`}
                    className="glass-panel block p-4 sm:p-6 transition-colors hover:bg-[color:var(--ui-surface-hover)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-2xl font-semibold text-[color:var(--fg-strong)]">
                            {product.name}
                          </h2>
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 opacity-60"
                          >
                            <path
                              d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                              fill="currentColor"
                              fillRule="evenodd"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <p className="text-sm sm:text-base opacity-80">{product.description}</p>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: languageColors[product.language] || '#6e7681' }}
                            />
                            {product.language}
                          </span>
                          {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {product.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[10px] sm:text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {product.demo && (
                      <div className="mt-3 pt-3 border-t border-[color:var(--ui-border)]">
                        <span className="text-xs sm:text-sm opacity-70">Demo: </span>
                        <span className="text-xs sm:text-sm underline-thin">{product.demo}</span>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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

export default Products
