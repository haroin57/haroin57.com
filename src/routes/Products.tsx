import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

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
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 mx-auto min-h-screen max-w-4xl px-4 py-10 space-y-6 sm:px-6 sm:py-12"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <header
          className="reveal flex items-center gap-4 text-lg font-semibold"
          style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
        >
          <Link to="/home" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </Link>
        </header>

        <section className="reveal space-y-4">
          <h1 className="text-2xl sm:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong)]">
            Products
          </h1>
          <p className="font-morisawa-dragothic text-base opacity-85">鋭意執筆中！</p>
        </section>
      </main>
    </div>
  )
}

export default Products
