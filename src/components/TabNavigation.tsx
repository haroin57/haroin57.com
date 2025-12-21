import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import PrefetchLink from './PrefetchLink'

type TabItem = {
  path: string
  label: string
  matchPattern: RegExp
}

const tabs: TabItem[] = [
  { path: '/home', label: 'Home', matchPattern: /^\/(home)?$/ },
  { path: '/posts', label: 'Posts', matchPattern: /^\/posts/ },
  { path: '/products', label: 'Products', matchPattern: /^\/products/ },
  { path: '/photos', label: 'Photos', matchPattern: /^\/photos/ },
  { path: '/bbs', label: 'BBS', matchPattern: /^\/bbs/ },
]

function TabNavigation() {
  const location = useLocation()

  const activeTab = useMemo(() => {
    for (const tab of tabs) {
      if (tab.matchPattern.test(location.pathname)) {
        return tab.path
      }
    }
    return null
  }, [location.pathname])

  // ランディングページや管理画面では表示しない
  const shouldShow = useMemo(() => {
    if (location.pathname === '/') return false
    if (location.pathname.startsWith('/admin')) return false
    return true
  }, [location.pathname])

  if (!shouldShow) return null

  return (
    <nav
      className="fixed left-1/2 top-4 z-40 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-1.5 py-1 shadow-lg backdrop-blur-sm sm:gap-2 sm:px-2"
      style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path
        return (
          <PrefetchLink
            key={tab.path}
            to={tab.path}
            className={`relative px-2.5 py-1.5 text-xs font-medium transition-colors rounded-full sm:px-3.5 sm:py-2 sm:text-sm ${
              isActive
                ? 'bg-[color:var(--ui-surface-hover)] text-[color:var(--fg-strong)]'
                : 'text-[color:var(--fg)] opacity-70 hover:opacity-100 hover:bg-[color:var(--ui-surface-hover)]'
            }`}
          >
            {tab.label}
          </PrefetchLink>
        )
      })}
    </nav>
  )
}

export default TabNavigation
