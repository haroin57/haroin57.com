/**
 * Detect overflow on tables/code blocks and apply transform: scale() to fit.
 * Used as a fallback for iOS Safari minimum-font-size and other quirks where
 * CSS wrapping isn't enough.
 */

const FIT_SELECTOR = '.prose table, .prose pre'
const TOLERANCE_PX = 1

export function fitResponsive(root: ParentNode): void {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(FIT_SELECTOR))
  for (const el of elements) {
    fitElement(el)
  }
}

function fitElement(el: HTMLElement): void {
  // Reset any previous transform first to measure natural size
  el.style.transform = ''
  el.style.transformOrigin = ''
  el.style.width = ''
  el.style.marginBottom = ''
  // Force reflow
  void el.offsetWidth

  const parent = el.parentElement
  if (!parent) return

  // Available width is the parent (or wrapper) clientWidth minus any padding
  const parentStyle = window.getComputedStyle(parent)
  const padL = parseFloat(parentStyle.paddingLeft) || 0
  const padR = parseFloat(parentStyle.paddingRight) || 0
  const available = parent.clientWidth - padL - padR

  if (available <= 0) return

  // Measure natural width: scrollWidth captures overflowed content
  const naturalWidth = Math.max(el.scrollWidth, el.offsetWidth)

  if (naturalWidth <= available + TOLERANCE_PX) {
    // Fits, no scaling needed
    return
  }

  const scale = available / naturalWidth
  const minScale = 0.4
  if (scale < minScale) {
    // Too aggressive — keep scrollable
    el.style.overflowX = 'auto'
    return
  }

  // Apply scale via CSS transform and adjust width/margin so layout stays sane
  const naturalHeight = el.offsetHeight
  const scaledHeight = naturalHeight * scale
  const heightDelta = naturalHeight - scaledHeight

  el.style.transformOrigin = '0 0'
  el.style.transform = `scale(${scale})`
  el.style.width = `${naturalWidth}px`
  el.style.marginBottom = `${parseFloat(window.getComputedStyle(el).marginBottom) - heightDelta}px`
}

let scheduledFrame: number | null = null
function scheduleFit(root: ParentNode): void {
  if (scheduledFrame != null) cancelAnimationFrame(scheduledFrame)
  scheduledFrame = requestAnimationFrame(() => {
    scheduledFrame = null
    fitResponsive(root)
  })
}

export function watchResponsiveFit(root: ParentNode): () => void {
  const onResize = () => scheduleFit(root)
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('orientationchange', onResize, { passive: true })

  // Re-run after images/fonts load (which can change row heights)
  const observer = new MutationObserver(() => scheduleFit(root))
  observer.observe(root as Node, { childList: true, subtree: true })

  // Initial run
  scheduleFit(root)

  // Optional debug overlay
  if (typeof window !== 'undefined' && window.location.search.includes('debug=1')) {
    setTimeout(() => mountDebugOverlay(root), 1000)
  }

  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    observer.disconnect()
  }
}

function mountDebugOverlay(root: ParentNode): void {
  let overlay = document.getElementById('__resp_debug')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = '__resp_debug'
    overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(220,38,38,0.95);color:white;font-family:monospace;font-size:11px;padding:6px;line-height:1.3;max-height:50vh;overflow:auto;border-bottom:2px solid yellow;'
    document.body.appendChild(overlay)
  }
  const elements = Array.from(root.querySelectorAll<HTMLElement>(FIT_SELECTOR))
  const ua = navigator.userAgent
  const lines: string[] = []
  lines.push(`[DEBUG] vw=${window.innerWidth} doc=${document.documentElement.scrollWidth} body=${document.body.scrollWidth}`)
  lines.push(`[DEBUG] UA: ${ua.slice(0, 60)}`)
  elements.slice(0, 8).forEach((el, i) => {
    const r = el.getBoundingClientRect()
    const cs = window.getComputedStyle(el)
    const overflow = el.scrollWidth > el.offsetWidth + 1 ? ' OVERFLOW' : ''
    lines.push(
      `[${i}] ${el.tagName} w=${Math.round(r.width)} sw=${el.scrollWidth} ow=${el.offsetWidth} fs=${cs.fontSize} ws=${cs.whiteSpace} d=${cs.display}${overflow}`
    )
  })
  overlay.innerHTML = lines.map((l) => `<div>${l}</div>`).join('')
}
