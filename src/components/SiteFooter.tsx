import AccessCounter from './AccessCounter'
import { MAIN_TEXT_STYLE } from '../styles/typography'

function SiteFooter() {
  return (
    <footer
      className="relative z-10 mt-12 flex items-center justify-between border-t border-[color:var(--ui-border)] px-4 py-6 sm:px-6"
      style={MAIN_TEXT_STYLE}
    >
      <div className="text-xs sm:text-sm opacity-70 flex items-center gap-3">
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
  )
}

export default SiteFooter
