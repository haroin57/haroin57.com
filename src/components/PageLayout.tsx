import { useEffect, useRef, type ReactNode } from 'react'
import AccessCounter from './AccessCounter'
import BackButton from './BackButton'

type PageLayoutProps = {
  children: ReactNode
  showBackButton?: boolean
  backTo?: string
}

function PageLayout({ children, showBackButton = true, backTo = '/home' }: PageLayoutProps) {
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    queueMicrotask(() => {
      targets.forEach((el) => el.classList.add('is-visible'))
    })
  }, [])

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={{ fontFamily: `"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif`, color: 'var(--fg)' }}
      >
        {showBackButton && <BackButton to={backTo} />}

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="flex flex-1 flex-col py-10">
            <div className="mx-auto w-full max-w-2xl">
              {children}
            </div>
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

export default PageLayout
