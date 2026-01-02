import { useMemo, useCallback, useState, useEffect, useSyncExternalStore, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

export type TocItem = {
  id: string
  text: string
  level: number
}

type TableOfContentsProps = {
  toc?: TocItem[]
  html?: string
}

/** モバイル判定用フック */
function useIsMobile(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const handler = () => onStoreChange()
    mediaQuery.addEventListener('change', handler)
    window.addEventListener('resize', handler)
    return () => {
      mediaQuery.removeEventListener('change', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  const getSnapshot = useCallback(() => {
    return window.matchMedia('(max-width: 900px)').matches
  }, [])

  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** HTMLから見出しを抽出（フォールバック用） */
function extractHeadingsFromHtml(html: string): TocItem[] {
  const items: TocItem[] = []
  const regex = /<h([234])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = match[3].replace(/<[^>]+>/g, '').trim()
    if (text && text !== '目次') {
      items.push({ id, text, level })
    }
  }

  return items
}

/** スクロール位置をuseSyncExternalStoreで購読 */
function useScrollActiveId(headings: TocItem[]): string {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener('scroll', onStoreChange, { passive: true })
    return () => window.removeEventListener('scroll', onStoreChange)
  }, [])

  const getSnapshot = useCallback(() => {
    if (headings.length === 0) return ''

    const scrollTop = window.scrollY
    const offset = 100

    if (scrollTop < offset) {
      return headings[0].id
    }

    let currentHeading = headings[0].id
    for (const heading of headings) {
      const element = document.getElementById(heading.id)
      if (element) {
        const rect = element.getBoundingClientRect()
        const elementTop = rect.top + scrollTop
        if (elementTop <= scrollTop + offset) {
          currentHeading = heading.id
        } else {
          break
        }
      }
    }
    return currentHeading
  }, [headings])

  const getServerSnapshot = useCallback(() => {
    if (headings.length === 0) return ''
    return headings[0].id
  }, [headings])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** モバイル用: Zenn風の固定ヘッダー目次 */
function MobileToc({
  headings,
  activeId,
  scrollActiveId,
  onItemClick,
}: {
  headings: TocItem[]
  activeId: string
  scrollActiveId: string
  onItemClick: (event: MouseEvent<HTMLAnchorElement>, id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string>('')

  // bodyにクラスを付与してページ上部の余白を確保
  useEffect(() => {
    document.body.classList.add('has-toc')
    return () => {
      document.body.classList.remove('has-toc')
    }
  }, [])

  // 現在のセクション名を取得
  const currentSection = useMemo(() => {
    const current = headings.find((h) => h.id === scrollActiveId)
    return current?.text || headings[0]?.text || '目次'
  }, [headings, scrollActiveId])

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.toc-mobile-header')) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  // 目次項目クリック時
  const handleItemClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, id: string) => {
      onItemClick(event, id)
      setIsOpen(false)
    },
    [onItemClick]
  )

  return (
    <div className="toc-mobile-header">
      {/* 固定ヘッダーバー */}
      <button
        type="button"
        className="toc-mobile-bar"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="toc-mobile-dropdown"
      >
        <svg
          className={`toc-mobile-chevron${isOpen ? ' toc-mobile-chevron--open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="toc-mobile-current">{currentSection}</span>
      </button>

      {/* ドロップダウン目次 */}
      <div
        id="toc-mobile-dropdown"
        className={`toc-mobile-dropdown${isOpen ? ' toc-mobile-dropdown--open' : ''}`}
      >
        <nav>
          <ul className="toc-list toc-mobile-list">
            {headings.map((heading) => (
              <li
                key={heading.id}
                className={`toc-item toc-item--level-${heading.level}${
                  (hoveredId || activeId) === heading.id ? ' toc-item--active' : ''
                }`}
                onMouseEnter={() => setHoveredId(heading.id)}
                onMouseLeave={() => setHoveredId('')}
              >
                <a
                  href={`#${heading.id}`}
                  onClick={(event) => handleItemClick(event, heading.id)}
                  className="toc-link"
                  aria-current={scrollActiveId === heading.id ? 'location' : undefined}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

/** PC用: サイドバー目次 */
function DesktopToc({
  headings,
  activeId,
  scrollActiveId,
  onItemClick,
  onHover,
}: {
  headings: TocItem[]
  activeId: string
  scrollActiveId: string
  onItemClick: (event: MouseEvent<HTMLAnchorElement>, id: string) => void
  onHover: (id: string) => void
}) {
  return (
    <aside className="toc-sidebar">
      <h2 className="toc-sidebar-title">目次</h2>
      <nav>
        <ul className="toc-list">
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={`toc-item toc-item--level-${heading.level}${activeId === heading.id ? ' toc-item--active' : ''}`}
              onMouseEnter={() => onHover(heading.id)}
              onMouseLeave={() => onHover('')}
            >
              <a
                href={`#${heading.id}`}
                onClick={(event) => onItemClick(event, heading.id)}
                className="toc-link"
                aria-current={scrollActiveId === heading.id ? 'location' : undefined}
                onFocus={() => onHover(heading.id)}
                onBlur={() => onHover('')}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

function TableOfContents({ toc, html }: TableOfContentsProps) {
  const [hoveredId, setHoveredId] = useState<string>('')
  const isMobile = useIsMobile()

  // tocが渡された場合はそれを使用、なければhtmlから抽出
  const headings = useMemo(() => {
    if (toc && toc.length > 0) return toc
    if (html) return extractHeadingsFromHtml(html)
    return []
  }, [toc, html])

  const scrollActiveId = useScrollActiveId(headings)
  const activeId = hoveredId || scrollActiveId

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    try {
      window.history.pushState(null, '', `#${id}`)
    } catch {
      // ignore
    }
  }, [])

  if (headings.length === 0) {
    return null
  }

  if (typeof document === 'undefined') return null

  // モバイル: 画面上部に固定表示
  if (isMobile) {
    return createPortal(
      <MobileToc
        headings={headings}
        activeId={activeId}
        scrollActiveId={scrollActiveId}
        onItemClick={handleClick}
      />,
      document.body
    )
  }

  // PC: 右サイドバーに固定表示
  return createPortal(
    <DesktopToc
      headings={headings}
      activeId={activeId}
      scrollActiveId={scrollActiveId}
      onItemClick={handleClick}
      onHover={setHoveredId}
    />,
    document.body
  )
}

export default TableOfContents
