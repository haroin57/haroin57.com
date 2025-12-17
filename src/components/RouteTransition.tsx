import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Link, type LinkProps, type NavigateOptions, type To, useLocation, useNavigate } from 'react-router-dom'
import { RouteTransitionContext, useRouteTransition } from './RouteTransitionContext'

type TransitionPhase = 'out' | 'in'

type TransitionItem = {
  text: string
  rect: { x: number; y: number; width: number; height: number }
  font: string
  color: string
}

type TransitionState = {
  key: number
  phase: TransitionPhase
  items: TransitionItem[]
  to: To
  options?: NavigateOptions
}

const MAX_ITEMS = 40
const OUT_DURATION_MS = 650
const IN_DURATION_MS = 850

let matterModulePromise: Promise<typeof import('matter-js')> | null = null
function loadMatter() {
  if (!matterModulePromise) matterModulePromise = import('matter-js')
  return matterModulePromise
}

function getPathname(to: To): string {
  if (typeof to === 'string') return to.split('#')[0]?.split('?')[0] ?? to
  return to.pathname ?? ''
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function collectTransitionItems(maxItems: number): TransitionItem[] {
  if (typeof window === 'undefined') return []
  const root = document.querySelector('main')
  if (!root) return []

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const selector = 'h1,h2,h3,p,li,button,a'
  const elements = Array.from(root.querySelectorAll(selector))

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) return []

  const items: TransitionItem[] = []
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue
    if (el.closest('[data-transition-skip="true"]')) continue

    const rect = el.getBoundingClientRect()
    if (rect.width < 24 || rect.height < 12) continue
    if (rect.bottom < 0 || rect.top > viewportH) continue
    if (rect.right < 0 || rect.left > viewportW) continue

    const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) continue

    const computed = window.getComputedStyle(el)
    const font = computed.font || `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`
    const color = computed.color || 'rgba(255,255,255,0.95)'

    const lineRects = collectLineRects(el).filter((lineRect) => {
      if (lineRect.width < 24 || lineRect.height < 12) return false
      if (lineRect.y + lineRect.height < 0 || lineRect.y > viewportH) return false
      if (lineRect.x + lineRect.width < 0 || lineRect.x > viewportW) return false
      return true
    })

    const rects = lineRects.length
      ? lineRects
      : [{ x: rect.left, y: rect.top, width: rect.width, height: rect.height }]

    measureCtx.font = font
    const lineTexts = splitTextToFitLines(measureCtx, text, rects.map((r) => r.width))

    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i]!
      const lineText = (lineTexts[i] ?? text).trim()
      if (!lineText) continue

      items.push({
        text: lineText,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        font,
        color,
      })

      if (items.length >= maxItems) break
    }

    if (items.length >= maxItems) break
  }

  items.sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x))
  return items
}

function collectLineRects(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const rects = Array.from(range.getClientRects())

  const filtered = rects
    .filter((rect) => rect.width >= 8 && rect.height >= 8)
    .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }))
    .sort((a, b) => (a.top - b.top) || (a.left - b.left))

  const lines: Array<{ left: number; top: number; right: number; bottom: number }> = []
  const threshold = 4
  for (const rect of filtered) {
    const last = lines[lines.length - 1]
    if (!last || Math.abs(rect.top - last.top) > threshold) {
      lines.push({ ...rect })
      continue
    }

    last.left = Math.min(last.left, rect.left)
    last.right = Math.max(last.right, rect.right)
    last.top = Math.min(last.top, rect.top)
    last.bottom = Math.max(last.bottom, rect.bottom)
  }

  return lines.map((line) => ({
    x: line.left,
    y: line.top,
    width: line.right - line.left,
    height: line.bottom - line.top,
  }))
}

function splitTextToFitLines(ctx: CanvasRenderingContext2D, text: string, widths: number[]) {
  const out: string[] = []
  let rest = text.trim()

  for (const width of widths) {
    if (!rest) break
    const maxWidth = Math.max(48, width)

    let cut = findFittingCut(ctx, rest, maxWidth)
    if (cut <= 0) {
      out.push(truncateText(ctx, rest, maxWidth))
      rest = ''
      break
    }

    let head = rest.slice(0, cut)
    let tail = rest.slice(cut)

    if (cut < rest.length) {
      const space = head.lastIndexOf(' ')
      if (space >= 0 && space >= Math.max(0, head.length - 24)) {
        tail = head.slice(space + 1) + tail
        head = head.slice(0, space)
      }
    }

    head = head.trim()
    out.push(head)
    rest = tail.trim()
  }

  if (rest && out.length > 0) {
    const lastIndex = out.length - 1
    const maxWidth = Math.max(48, widths[lastIndex] ?? widths[0] ?? 280)
    out[lastIndex] = truncateText(ctx, `${out[lastIndex]} ${rest}`.trim(), maxWidth)
  }

  return out
}

function findFittingCut(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text.length

  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (ctx.measureText(text.slice(0, mid)).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [transition, setTransition] = useState<TransitionState | null>(null)
  const transitioningRef = useRef(false)
  const pendingNavRef = useRef<{ to: To; options?: NavigateOptions } | null>(null)
  const keyRef = useRef(0)

  useEffect(() => {
    void loadMatter()
    return () => {
      document.body.classList.remove('route-transitioning')
    }
  }, [])

  const finish = useCallback(() => {
    transitioningRef.current = false
    pendingNavRef.current = null
    setTransition(null)
    document.body.classList.remove('route-transitioning')
  }, [])

  const handleOutComplete = useCallback(() => {
    const pending = pendingNavRef.current
    if (!pending) return

    startTransition(() => {
      navigate(pending.to, pending.options)
    })

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const incoming = collectTransitionItems(MAX_ITEMS)
        setTransition((prev) => {
          if (!prev) return prev
          return { ...prev, phase: 'in', items: incoming }
        })
      })
    })
  }, [navigate])

  const handleInComplete = useCallback(() => {
    finish()
  }, [finish])

  const transitionTo = useCallback(
    (to: To, options?: NavigateOptions) => {
      if (transitioningRef.current) return false

      const targetPath = getPathname(to)
      if (targetPath && targetPath === location.pathname) {
        startTransition(() => {
          navigate(to, options)
        })
        return true
      }

      if (prefersReducedMotion()) {
        startTransition(() => {
          navigate(to, options)
        })
        return true
      }

      const outgoing = collectTransitionItems(MAX_ITEMS)

      pendingNavRef.current = { to, options }
      transitioningRef.current = true
      document.body.classList.add('route-transitioning')
      keyRef.current += 1
      setTransition({ key: keyRef.current, phase: 'out', items: outgoing, to, options })
      return true
    },
    [location.pathname, navigate]
  )

  const value = useMemo(
    () => ({
      isTransitioning: transition !== null,
      transitionTo,
    }),
    [transition, transitionTo]
  )

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}
      <MatterRouteTransitionOverlay
        active={transition !== null}
        phase={transition?.phase ?? null}
        items={transition?.items ?? []}
        sequence={transition?.key ?? 0}
        onOutComplete={handleOutComplete}
        onInComplete={handleInComplete}
      />
    </RouteTransitionContext.Provider>
  )
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey
}

export function TransitionLink({ onClick, reloadDocument, ...props }: LinkProps) {
  const { transitionTo, isTransitioning } = useRouteTransition()

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return

      if (!isPlainLeftClick(event)) return
      if (reloadDocument) return
      if (isTransitioning) {
        event.preventDefault()
        return
      }
      if (event.currentTarget.target === '_blank') return

      event.preventDefault()

      transitionTo(props.to, {
        replace: props.replace,
        state: props.state,
        preventScrollReset: props.preventScrollReset,
        relative: props.relative,
        viewTransition: props.viewTransition,
      })
    },
    [isTransitioning, onClick, props, reloadDocument, transitionTo]
  )

  return <Link {...props} reloadDocument={reloadDocument} onClick={handleClick} />
}

type OverlayProps = {
  active: boolean
  phase: TransitionPhase | null
  items: TransitionItem[]
  sequence: number
  onOutComplete: () => void
  onInComplete: () => void
}

type RuntimeBody = import('matter-js').Body & {
  __transition?: {
    font: string
    color: string
    text: string
    targetX: number
    radius: number
    delayMs: number
  }
}

function MatterRouteTransitionOverlay({ active, phase, items, sequence, onOutComplete, onInComplete }: OverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!active || !phase) return

    let cancelled = false
    let disposed = false
    let rafId = 0
    let cleanupResize: (() => void) | null = null

    let Matter: typeof import('matter-js') | null = null
    let engine: import('matter-js').Engine | null = null
    let bodies: RuntimeBody[] = []
    let baselineYs: number[] = []
    let baselineBodies: import('matter-js').Body[] = []
    let boundaryBodies: import('matter-js').Body[] = []

    const dispose = () => {
      if (disposed) return
      disposed = true
      cancelled = true
      if (rafId) window.cancelAnimationFrame(rafId)
      cleanupResize?.()
      cleanupResize = null

      if (Matter && engine) {
        Matter.Composite.clear(engine.world, false)
        Matter.Engine.clear(engine)
      }
    }

    const run = async () => {
      Matter = await loadMatter()
      if (cancelled) return

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      let dpr = Math.min(2, window.devicePixelRatio || 1)
      let width = window.innerWidth
      let height = window.innerHeight

      const resizeCanvas = () => {
        dpr = Math.min(2, window.devicePixelRatio || 1)
        width = window.innerWidth
        height = window.innerHeight
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      const { Engine, Composite, Bodies, Body } = Matter
      engine = Engine.create({ enableSleeping: true })
      engine.gravity.y = 1.05

      const padY = 8
      const maxBodies = 220
      const collisionGroup = -1

      const removeBodies = (list: import('matter-js').Body[]) => {
        if (!engine) return
        for (const body of list) Composite.remove(engine.world, body)
      }

      const computeBaselines = () => {
        const ys = items
          .map((item) => Math.round(item.rect.y + item.rect.height + padY))
          .filter((y) => y >= 0 && y <= height)
          .sort((a, b) => a - b)

        const merged: number[] = []
        const threshold = 10
        for (const y of ys) {
          const last = merged[merged.length - 1]
          if (merged.length === 0 || Math.abs(y - last) > threshold) merged.push(y)
        }
        return merged
      }

      const rebuildStatics = () => {
        if (!engine) return

        removeBodies(boundaryBodies)
        removeBodies(baselineBodies)

        const wall = 240
        const floor = Bodies.rectangle(width / 2, height + wall / 2, width * 4, wall, { isStatic: true })
        boundaryBodies = [floor]

        baselineYs = computeBaselines()
        baselineBodies = baselineYs.map((y) =>
          Bodies.rectangle(width / 2, y + 5, width * 4, 10, { isStatic: true, friction: 1, restitution: 0 })
        )

        Composite.add(engine.world, [...boundaryBodies, ...baselineBodies])
      }

      const handleResize = () => {
        resizeCanvas()
        rebuildStatics()
      }

      resizeCanvas()
      rebuildStatics()
      window.addEventListener('resize', handleResize)
      cleanupResize = () => window.removeEventListener('resize', handleResize)

      const closestBaseline = (y: number) => {
        if (baselineYs.length === 0) return y
        let best = baselineYs[0]!
        let bestDist = Math.abs(best - y)
        for (let i = 1; i < baselineYs.length; i += 1) {
          const cand = baselineYs[i]!
          const dist = Math.abs(cand - y)
          if (dist < bestDist) {
            best = cand
            bestDist = dist
          }
        }
        return best
      }

      bodies = []
      for (const item of items) {
        if (bodies.length >= maxBodies) break
        const lineText = item.text
        if (!lineText) continue

        ctx.font = item.font

        const measuredLineWidth = Math.max(1, ctx.measureText(lineText).width)
        const scaleX = item.rect.width > 0 ? item.rect.width / measuredLineWidth : 1
        const lineHeight = Math.max(12, item.rect.height)
        const radius = clamp(lineHeight * 0.56 + 2, 10, 26)

        const baselineCandidate = Math.round(item.rect.y + item.rect.height + padY)
        const baselineY = closestBaseline(baselineCandidate)
        const cy = baselineY - radius - 1

        let xCursor = item.rect.x
        let prevW = 0
        let prefix = ''

        for (const ch of Array.from(lineText)) {
          prefix += ch
          const nextW = ctx.measureText(prefix).width
          const chW = (nextW - prevW) * scaleX
          prevW = nextW

          const cx = xCursor + chW / 2
          xCursor += chW

          if (!ch.trim()) continue
          if (bodies.length >= maxBodies) break

          const index = bodies.length
          const delayMs = Math.min(320, index * 4)
          const startX = phase === 'in' ? -radius * 2 - 80 - index * 6 : cx

          const body = Bodies.circle(startX, cy, radius, {
            friction: 0.98,
            restitution: 0,
            frictionAir: 0.16,
            density: 0.0016,
            collisionFilter: { group: collisionGroup },
          }) as RuntimeBody

          body.__transition = { font: item.font, color: item.color, text: ch, targetX: cx, radius, delayMs }
          Body.setVelocity(body, { x: 0, y: 0 })
          bodies.push(body)
        }
      }

      Composite.add(engine.world, bodies)

      const durationMs = phase === 'out' ? OUT_DURATION_MS : IN_DURATION_MS
      const startedAt = performance.now()
      let lastTime = startedAt

      const drawBody = (body: RuntimeBody) => {
        const meta = body.__transition
        if (!meta) return

        ctx.save()
        ctx.translate(body.position.x, body.position.y)
        ctx.rotate(body.angle)

        const r = body.circleRadius ?? meta.radius

        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, -r + 3)
        ctx.lineTo(0, -Math.max(6, r * 0.45))
        ctx.stroke()

        ctx.rotate(-body.angle)
        ctx.font = meta.font
        ctx.fillStyle = meta.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const mw = ctx.measureText(meta.text).width
        const maxW = Math.max(10, r * 1.4)
        if (mw > maxW) {
          const s = maxW / mw
          ctx.save()
          ctx.scale(s, s)
          ctx.fillText(meta.text, 0, 1)
          ctx.restore()
        } else {
          ctx.fillText(meta.text, 0, 1)
        }

        ctx.restore()
      }

      const step = (now: number) => {
        if (cancelled) return

        const dt = Math.min(32, Math.max(8, now - lastTime))
        lastTime = now

        if (!engine) return
        Engine.update(engine, dt)

        const elapsed = now - startedAt
        for (const body of bodies) {
          const meta = body.__transition
          if (!meta) continue

          if (elapsed < meta.delayMs) continue

          const targetX = phase === 'out' ? width + 360 + meta.radius * 3 : meta.targetX
          const dx = targetX - body.position.x

          const desiredVx = phase === 'out'
            ? 12
            : Math.abs(dx) < 2
              ? 0
              : clamp(dx * 0.18, -10, 10)

          const dv = desiredVx - body.velocity.x
          const maxForce = 0.012 * body.mass
          const motor = clamp(dv * 0.00055 * body.mass, -maxForce, maxForce)
          Body.applyForce(body, body.position, { x: motor, y: 0 })

          const r = Math.max(10, meta.radius)
          const desiredOmega = clamp(body.velocity.x / r * 0.06, -0.6, 0.6)
          Body.setAngularVelocity(body, desiredOmega)
        }

        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = 'rgba(0,0,0,0.22)'
        ctx.fillRect(0, 0, width, height)
        for (const body of bodies) drawBody(body)

        if (now - startedAt >= durationMs) {
          dispose()
          if (phase === 'out') onOutComplete()
          else onInComplete()
          return
        }

        rafId = window.requestAnimationFrame(step)
      }

      rafId = window.requestAnimationFrame(step)
    }

    run()

    return () => {
      dispose()
    }
  }, [active, phase, items, sequence, onInComplete, onOutComplete])

  return (
    <div key={sequence} aria-hidden="true" className={`route-transition${active ? ' is-active' : ''}`}>
      <canvas ref={canvasRef} className="route-transition__canvas" />
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '…'
  const max = Math.max(0, maxWidth - ctx.measureText(ellipsis).width)
  let out = text
  while (out.length > 0 && ctx.measureText(out).width > max) {
    out = out.slice(0, -1)
  }
  return `${out}${ellipsis}`
}
