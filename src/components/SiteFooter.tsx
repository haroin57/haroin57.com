import AccessCounter from './AccessCounter'
import ClientOnly from './ClientOnly'
import { GitHubIcon, XLogoIcon } from './SvgIcons'
import { MAIN_TEXT_STYLE } from '../styles/typography'

function SiteFooter() {
  return (
    <footer
      className="relative z-10 mt-12 flex items-center justify-between border-t border-[color:var(--ui-border)] px-4 py-6 sm:px-6"
      style={MAIN_TEXT_STYLE}
    >
      <div className="text-xs sm:text-sm opacity-70 flex items-center gap-3">
        <ClientOnly>
          <AccessCounter />
        </ClientOnly>
        <span>© haroin</span>
      </div>
      <div className="flex items-center gap-4">
        <a
          href="https://x.com/haroin57"
          target="_blank"
          rel="noreferrer"
          className="hover:opacity-100 opacity-80"
          aria-label="X profile"
        >
          <XLogoIcon className="footer-logo" aria-hidden="true" focusable="false" />
        </a>
        <a
          href="https://github.com/haroin57"
          target="_blank"
          rel="noreferrer"
          className="hover:opacity-100 opacity-80"
          aria-label="GitHub profile"
        >
          <GitHubIcon className="footer-logo" aria-hidden="true" focusable="false" />
        </a>
      </div>
    </footer>
  )
}

export default SiteFooter
