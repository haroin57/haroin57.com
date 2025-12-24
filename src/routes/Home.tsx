import { useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PrefetchLink from '../components/PrefetchLink'
import ArrowRightIcon from '../components/icons/ArrowRightIcon'
import SiteFooter from '../components/SiteFooter'
import { usePageMeta } from '../hooks/usePageMeta'
import { useReveal } from '../hooks/useReveal'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { MAIN_TEXT_STYLE } from '../styles/typography'
import postsData from '../data/posts.json' with { type: 'json' }
import productsData from '../data/products.json' with { type: 'json' }
import { manualChangelog } from '../data/changelog'

type TimelineItem = {
  type: 'post' | 'product' | 'photo' | 'about' | 'site'
  slug?: string
  title: string
  date: string
  summary?: string
  link?: string
  /** 更新の場合true、新規作成の場合false/undefined */
  isUpdate?: boolean
}

/** ナビゲーションアイコンのタイプ */
type NavIconType = TimelineItem['type'] | 'bbs'

type NavItem = {
  to: string
  label: string
  type: NavIconType
}

const navItems: NavItem[] = [
  { to: '/about', label: 'About', type: 'about' },
  { to: '/posts', label: 'Posts', type: 'post' },
  { to: '/products', label: 'Products', type: 'product' },
  { to: '/photos', label: 'Photos', type: 'photo' },
  { to: '/bbs', label: 'BBS', type: 'bbs' },
]

/** 日付を相対表記に変換（例: "3 days ago"） */
function formatRelativeDate(dateStr: string): string {
  // 日付のみを比較（時間は無視）してタイムゾーン問題を回避
  const datePart = dateStr.split('T')[0] // "2025-12-24" 形式
  const [year, month, day] = datePart.split('-').map(Number)
  const targetDate = new Date(year, month - 1, day) // ローカルタイムで作成

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = today.getTime() - targetDate.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 0) return 'Today' // 未来の日付は「Today」として扱う
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

/** タイプごとのラベル */
function getTypeLabel(type: TimelineItem['type']): string {
  switch (type) {
    case 'post':
      return 'Post'
    case 'product':
      return 'Product'
    case 'photo':
      return 'Photo'
    case 'about':
      return 'About'
    case 'site':
      return 'Site'
    default:
      return 'Update'
  }
}

/** ナビゲーション・タイムラインアイコン */
function NavIcon({ type, className = "w-4 h-4" }: { type: NavIconType; className?: string }) {
  switch (type) {
    case 'post':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      )
    case 'product':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      )
    case 'photo':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      )
    case 'about':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      )
    case 'bbs':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      )
    case 'site':
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      )
  }
}

function Home() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  usePageMeta()
  useScrollToTop()
  useReveal(pageRef)

  // タイムラインデータを作成（Posts + Products を日付順にソート）
  // updatedAtがある場合は「更新」、ない場合は「新規」としてcreatedAtを使用
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = []

    // Posts を追加（status: 'published'のみ、draftはJSONに含まれない前提）
    for (const post of postsData as Array<{
      slug?: string
      title?: string
      createdAt?: string
      updatedAt?: string | null
      summary?: string
    }>) {
      if (post.slug && post.title && post.createdAt) {
        // updatedAtがあり、createdAtと異なる場合は「更新」として表示
        const hasUpdate = !!(post.updatedAt && post.updatedAt !== post.createdAt)
        items.push({
          type: 'post',
          slug: post.slug,
          title: post.title,
          date: hasUpdate ? post.updatedAt! : post.createdAt,
          summary: post.summary,
          isUpdate: hasUpdate || undefined,
        })
      }
    }

    // Products を追加（同様にupdatedAt対応）
    for (const product of productsData as Array<{
      slug?: string
      name?: string
      createdAt?: string
      updatedAt?: string | null
      description?: string
    }>) {
      if (product.slug && product.name && product.createdAt) {
        const hasUpdate = !!(product.updatedAt && product.updatedAt !== product.createdAt)
        items.push({
          type: 'product',
          slug: product.slug,
          title: product.name,
          date: hasUpdate ? product.updatedAt! : product.createdAt,
          summary: product.description,
          isUpdate: hasUpdate || undefined,
        })
      }
    }

    // 手動changelog を追加
    for (const entry of manualChangelog) {
      items.push({
        type: entry.type,
        title: entry.title,
        date: entry.date,
        summary: entry.summary,
        link: entry.link,
      })
    }

    // 日付でソート（新しい順）
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  // 年ごとにグループ化
  const groupedByYear = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {}
    for (const item of timelineItems) {
      const year = new Date(item.date).getFullYear().toString()
      if (!groups[year]) {
        groups[year] = []
      }
      groups[year].push(item)
    }
    return groups
  }, [timelineItems])

  const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a))

  // リンク先を取得
  const getItemLink = (item: TimelineItem): string => {
    if (item.link) return item.link
    if (item.type === 'post' && item.slug) return `/posts/${item.slug}`
    if (item.type === 'product' && item.slug) return `/products/${item.slug}`
    return '#'
  }

  return (
    <div ref={pageRef} className="relative overflow-hidden">
      {/* 戻るボタン */}
      <button
        type="button"
        onClick={handleBack}
        className="group fixed left-1/2 top-6 z-30 -translate-x-1/2 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full font-medium text-neutral-200 active:scale-95 transition-transform"
        style={{ backgroundColor: 'var(--nav-button-bg)' }}
      >
        <div className="transition-transform duration-300 group-hover:-translate-y-[300%]">
          <ArrowRightIcon className="h-5 w-5 -rotate-90" />
        </div>
        <div className="absolute translate-y-[300%] transition-transform duration-300 group-hover:translate-y-0">
          <ArrowRightIcon className="h-5 w-5 -rotate-90" />
        </div>
      </button>

      <main
        className="relative z-10 min-h-screen flex flex-col page-fade"
        style={MAIN_TEXT_STYLE}
      >
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="mx-auto w-full max-w-2xl space-y-8">
            {/* Contents見出し */}
            <h1 className="reveal text-xl sm:text-2xl md:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong,inherit)]">
              Contents
            </h1>

            {/* ナビゲーションボタン - 中央配置 */}
            <nav className="reveal flex flex-wrap items-start justify-center gap-4 sm:gap-8 pt-6">
              {navItems.map((item) => (
                <PrefetchLink
                  key={item.to}
                  to={item.to}
                  className="group flex flex-col items-center gap-1.5 sm:gap-2"
                >
                  <div
                    className="relative flex items-center justify-center overflow-hidden rounded-full border border-white/20 transition-all duration-300 group-hover:border-white/40 group-hover:scale-105 group-active:scale-95 text-[#d3d3d3] w-14 h-14 sm:w-20 sm:h-20"
                    style={{
                      backgroundColor: 'transparent',
                    }}
                  >
                    <div className="transition-transform duration-500 group-hover:scale-110">
                      <NavIcon type={item.type} className="w-6 h-6 sm:w-9 sm:h-9" />
                    </div>
                    <div className="absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:bg-black/0" />
                  </div>
                  <span className="text-[10px] sm:text-sm font-medium text-[color:var(--fg)] opacity-70 transition-opacity duration-300 group-hover:opacity-100">
                    {item.label}
                  </span>
                </PrefetchLink>
              ))}
            </nav>

            {/* タイムライン */}
            {timelineItems.length > 0 && (
              <section className="reveal space-y-3 !mt-8">
                <h2 className="text-base sm:text-lg font-ab-countryroad font-medium text-[color:var(--fg-strong,inherit)] opacity-70">
                  サイト更新ログ
                </h2>

                <div className="space-y-4">
                  {years.map((year) => (
                    <div key={year} className="space-y-2">
                      <h3 className="text-[10px] font-semibold text-[color:var(--fg)] opacity-40">
                        {year}
                      </h3>

                      <div className="relative">
                        {/* タイムラインの縦線 */}
                        <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-white/10" />

                        <ul className="space-y-2">
                          {groupedByYear[year].map((item, index) => (
                            <li key={`${item.type}-${item.slug || item.title}-${index}`} className="relative pl-5 group">
                              {/* タイムラインのドット */}
                              <div className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full border border-white/20 bg-neutral-950 flex items-center justify-center transition-colors group-hover:border-white/40">
                                <div className="w-1 h-1 rounded-full bg-white/40 group-hover:bg-white/60 transition-colors" />
                              </div>

                              <PrefetchLink
                                to={getItemLink(item)}
                                className="block space-y-0.5 transition-opacity hover:opacity-80"
                              >
                                <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--fg)] opacity-40">
                                  <span>{getTypeLabel(item.type)}</span>
                                  {item.isUpdate && (
                                    <>
                                      <span>·</span>
                                      <span className="text-teal-400/70">Updated</span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span>{formatRelativeDate(item.date)}</span>
                                </div>
                                <h4 className="text-xs sm:text-sm font-medium text-[color:var(--fg-strong,inherit)] opacity-80 group-hover:text-[color:var(--accent,inherit)] group-hover:opacity-100 transition-colors">
                                  {item.title}
                                </h4>
                              </PrefetchLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  )
}

export default Home
