import { useRef, type ReactNode } from 'react'
import BackButton from './BackButton'
import SiteFooter from './SiteFooter'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { MAIN_TEXT_STYLE } from '../styles/typography'

type PageLayoutProps = {
  children: ReactNode
  showBackButton?: boolean
  backTo?: string
}

function PageLayout({ children, showBackButton = true, backTo = '/home' }: PageLayoutProps) {
  const pageRef = useRef<HTMLDivElement | null>(null)

  useScrollToTop()
  useReveal(pageRef)

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        {showBackButton && <BackButton to={backTo} />}

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-10 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="flex flex-1 flex-col py-10">
            <div className="mx-auto w-full max-w-2xl">
              {children}
            </div>
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  )
}

export default PageLayout
