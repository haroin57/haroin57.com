import { useMemo, useCallback, useState, useSyncExternalStore, type MouseEvent } from 'react'
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

function TableOfContents({ toc, html }: TableOfContentsProps) {
  const [hoveredId, setHoveredId] = useState<string>('')

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

  // PC版のみ：右サイドバーに小さく目次を表示
  // position: fixedが親のbackdrop-filterで壊れるため、Portalでbody直下にレンダリング
  const tocElement = (
    <aside className="toc-sidebar">
      <h2 className="toc-sidebar-title">目次</h2>
      <nav>
        <ul className="toc-list">
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={`toc-item toc-item--level-${heading.level}${activeId === heading.id ? ' toc-item--active' : ''}`}
              onMouseEnter={() => setHoveredId(heading.id)}
              onMouseLeave={() => setHoveredId('')}
            >
              <a
                href={`#${heading.id}`}
                onClick={(event) => handleClick(event, heading.id)}
                className="toc-link"
                aria-current={scrollActiveId === heading.id ? 'location' : undefined}
                onFocus={() => setHoveredId(heading.id)}
                onBlur={() => setHoveredId('')}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )

  if (typeof document === 'undefined') return null
  return createPortal(tocElement, document.body)
}

export default TableOfContents
