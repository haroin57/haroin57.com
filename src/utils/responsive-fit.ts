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

  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    observer.disconnect()
  }
}
