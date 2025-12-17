import { useCallback, useEffect, useRef, useState } from 'react'
import postsData from '../data/posts.json' with { type: 'json' }
import AccessCounter from '../components/AccessCounter'
import { TransitionLink } from '../components/RouteTransition'
import { useRouteTransition } from '../components/RouteTransitionContext'

type Interest = { title: string; text: string }
type PostMeta = { slug?: string; title?: string; createdAt?: string }

const UP_SCROLL_THRESHOLD = 280

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

function Home() {
  const [openInterests, setOpenInterests] = useState(false)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const leavingRef = useRef(false)
  const accumulatorRef = useRef(0)
  const touchLastYRef = useRef<number | null>(null)
  const { isTransitioning, transitionTo } = useRouteTransition()

  const navigateToLanding = useCallback(() => {
    if (leavingRef.current) return
    if (isTransitioning) return
    const started = transitionTo('/')
    if (!started) return
    leavingRef.current = true
  }, [isTransitioning, transitionTo])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const isAtTop = () => (window.scrollY || 0) <= 2

    const onWheel = (e: WheelEvent) => {
      if (leavingRef.current) return
      if (!isAtTop()) {
        accumulatorRef.current = 0
        return
      }

      const dy = e.deltaY
      if (!Number.isFinite(dy) || dy === 0) return

      if (dy < 0) {
        accumulatorRef.current += -dy
        if (accumulatorRef.current >= UP_SCROLL_THRESHOLD) {
          navigateToLanding()
        }
        return
      }

      accumulatorRef.current = 0
    }

    const onTouchStart = (e: TouchEvent) => {
      if (leavingRef.current) return
      if (e.touches.length !== 1) return
      touchLastYRef.current = e.touches[0]?.clientY ?? null
      accumulatorRef.current = 0
    }

    const onTouchMove = (e: TouchEvent) => {
      if (leavingRef.current) return
      if (touchLastYRef.current === null) return
      if (e.touches.length !== 1) return
      if (!isAtTop()) return

      const y = e.touches[0]?.clientY
      if (typeof y !== 'number') return

      const dy = y - touchLastYRef.current
      touchLastYRef.current = y
      if (!Number.isFinite(dy) || dy === 0) return

      if (dy > 0) {
        accumulatorRef.current += dy
        if (accumulatorRef.current >= UP_SCROLL_THRESHOLD) {
          navigateToLanding()
        }
        return
      }

      accumulatorRef.current = 0
    }

    const reset = () => {
      touchLastYRef.current = null
      accumulatorRef.current = 0
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', reset, { passive: true })
    window.addEventListener('touchcancel', reset, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', reset)
      window.removeEventListener('touchcancel', reset)
    }
  }, [navigateToLanding])

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
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center">
        <picture>
          <source media="(prefers-color-scheme: light)" srcSet="/background.png" />
          <img
            src="/profile.png"
            alt=""
            className="select-none"
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'cover',
              opacity: 'var(--overlay)',
              filter: 'blur(var(--bg-blur, 0px))',
              transform: 'scale(var(--bg-scale, 1))',
              transformOrigin: 'center',
            }}
          />
        </picture>
      </div>

      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={{ fontFamily: `"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif`, color: 'var(--fg)' }}
      >
        <button
          type="button"
          onClick={navigateToLanding}
          className="group fixed left-1/2 top-6 z-20 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-neutral-950 font-medium text-neutral-200 transition-all duration-300 hover:w-32"
        >
          <div className="inline-flex whitespace-nowrap opacity-0 transition-all duration-200 group-hover:-translate-x-3 group-hover:opacity-100">
            Back
          </div>
          <div className="absolute right-3.5">
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 -rotate-90 transition-transform duration-200 group-hover:-translate-y-0.5"
            >
              <path
                d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </button>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
                Contents
              </h1>

              <ul className="posts-divider mt-6">
                <li className="space-y-4 py-6">
                  <section className="space-y-4">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setOpenInterests((v) => !v)}
                        aria-expanded={openInterests}
                        className="reveal group relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded-md border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-lg"
                        style={{ color: 'var(--fg)' }}
                      >
                        <div className="translate-y-0 opacity-100 transition duration-500 ease-in-out md:group-hover:-translate-y-[150%] md:group-hover:opacity-0">
                          Interests
                        </div>
                        <div className="absolute translate-y-full opacity-0 transition duration-500 ease-in-out md:translate-y-[150%] md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
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
                      <div className="p-4 sm:p-6">
                        <ul className="list-disc space-y-4 pl-5 text-base">
                          {interests.map((item) => (
                            <li key={item.title}>
                              <div className="text-lg font-medium">{item.title}</div>
                              <div className="mt-1 text-sm opacity-90">{item.text}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </li>

                <li className="space-y-3 py-6">
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <TransitionLink
                        to="/posts"
                        className="reveal relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2.5 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-lg"
                        style={{ color: 'var(--fg)', transitionDelay: '0ms' }}
                      >
                        <span className="relative">Posts (ja)</span>
                      </TransitionLink>
                    </div>
                    <div
                      className="reveal px-1 text-base font-medhium text-[color:var(--fg-strong)]"
                      style={{ transitionDelay: '110ms' }}
                    >
                      Latest Posts
                    </div>
                    <div className="reveal glass-panel" style={{ transitionDelay: '190ms' }}>
                      <div className="p-4 sm:p-6">
                        <ul className="list-disc space-y-3 pl-5 text-base font-vdl-logomaru">
                          {latestPosts.map((post, idx) => (
                            <li
                              key={post.slug ?? post.title ?? idx}
                              className="reveal"
                              style={{ transitionDelay: `${260 + idx * 70}ms` }}
                            >
                              <TransitionLink
                                to={post.slug ? `/posts/${post.slug}` : '/posts'}
                                className="text-base underline-thin hover:text-accent"
                                style={{ color: 'var(--fg)' }}
                              >
                                {post.title ?? 'Untitled'}
                              </TransitionLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </li>

                <li className="space-y-3 py-6">
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <TransitionLink
                        to="/products"
                        className="reveal relative inline-flex h-11 min-w-[7.5rem] items-center justify-center overflow-hidden rounded border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2.5 text-base font-semibold transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-surface-hover)] sm:h-12 sm:px-5 sm:text-lg"
                        style={{ color: 'var(--fg)', transitionDelay: '0ms' }}
                      >
                        <span className="relative">Products</span>
                      </TransitionLink>
                    </div>
                  </section>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <footer
          className="relative z-10 mt-12 flex items-center justify-between border-t border-[color:var(--ui-border)] px-4 py-6 sm:px-6"
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
      </main>
    </div>
  )
}

export default Home
