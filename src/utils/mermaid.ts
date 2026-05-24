type MermaidRenderResult = {
  svg: string
  bindFunctions?: (element: Element) => void
}

type MermaidAPI = {
  initialize: (config: unknown) => void
  render: (id: string, code: string) => Promise<MermaidRenderResult>
}

let mermaidPromise: Promise<MermaidAPI> | null = null
let initialized = false

const mermaidConfig = {
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  themeVariables: {
    background: 'transparent',
    mainBkg: 'rgba(0, 0, 0, 0.3)',
    secondaryBkg: 'rgba(0, 0, 0, 0.2)',
    tertiaryColor: 'rgba(0, 0, 0, 0.15)',
    primaryColor: 'rgba(0, 0, 0, 0.35)',
    secondaryColor: 'rgba(0, 0, 0, 0.25)',
    nodeBorder: 'rgba(255, 255, 255, 0.4)',
    clusterBkg: 'rgba(0, 0, 0, 0.2)',
    clusterBorder: 'rgba(255, 255, 255, 0.3)',
    primaryBorderColor: 'rgba(255, 255, 255, 0.35)',
    lineColor: 'rgba(255, 255, 255, 0.5)',
    primaryTextColor: '#e2e8f0',
    secondaryTextColor: '#e2e8f0',
    tertiaryTextColor: '#e2e8f0',
    titleColor: '#ffffff',
    nodeTextColor: '#e2e8f0',
    edgeLabelBackground: 'rgba(0, 0, 0, 0.4)',
    actorBkg: 'rgba(0, 0, 0, 0.35)',
    actorBorder: 'rgba(255, 255, 255, 0.4)',
    actorTextColor: '#e2e8f0',
    actorLineColor: 'rgba(255, 255, 255, 0.35)',
    signalColor: '#e2e8f0',
    signalTextColor: '#e2e8f0',
    labelBoxBkgColor: 'rgba(0, 0, 0, 0.3)',
    labelBoxBorderColor: 'rgba(255, 255, 255, 0.3)',
    labelTextColor: '#e2e8f0',
    loopTextColor: '#e2e8f0',
    noteBkgColor: 'rgba(0, 0, 0, 0.3)',
    noteBorderColor: 'rgba(255, 255, 255, 0.3)',
    noteTextColor: '#e2e8f0',
    activationBkgColor: 'rgba(255, 255, 255, 0.08)',
    activationBorderColor: 'rgba(255, 255, 255, 0.35)',
    labelColor: '#e2e8f0',
    altBackground: 'rgba(0, 0, 0, 0.15)',
    classText: '#e2e8f0',
    relationColor: 'rgba(255, 255, 255, 0.5)',
    relationLabelColor: '#e2e8f0',
    pie1: 'rgba(255, 255, 255, 0.7)',
    pie2: 'rgba(255, 255, 255, 0.5)',
    pie3: 'rgba(255, 255, 255, 0.35)',
    pie4: 'rgba(255, 255, 255, 0.2)',
    pie5: 'rgba(255, 255, 255, 0.1)',
    pieStrokeColor: 'rgba(0, 0, 0, 0.8)',
    pieStrokeWidth: '1px',
    pieOuterStrokeColor: 'rgba(255, 255, 255, 0.3)',
  },
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 15,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
} as const

const normalizeMermaidCode = (code: string) => code.replace(/\r\n?/g, '\n')

const setMermaidError = (block: HTMLElement) => {
  block.innerHTML = `<div class="mermaid-error">Failed to render diagram</div>`
}

export async function loadMermaid(): Promise<MermaidAPI> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const anyMod = mod as unknown as { default?: MermaidAPI }
      return anyMod.default ?? (mod as unknown as MermaidAPI)
    })
  }
  const api = await mermaidPromise
  if (!initialized) {
    api.initialize(mermaidConfig)
    initialized = true
  }
  return api
}

export async function renderMermaidBlocks(root: ParentNode): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block'))
  if (blocks.length === 0) return

  let api: MermaidAPI
  try {
    api = await loadMermaid()
  } catch {
    blocks.forEach(setMermaidError)
    return
  }

  for (const block of blocks) {
    const code = block.getAttribute('data-mermaid')
    if (!code || block.querySelector('svg')) continue

    const normalizedCode = normalizeMermaidCode(code)
    if (!normalizedCode.trim()) continue

    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
      const { svg, bindFunctions } = await api.render(id, normalizedCode)
      block.innerHTML = svg
      block.classList.add('mermaid-rendered')
      bindFunctions?.(block)
      attachZoomToggle(block)
    } catch {
      setMermaidError(block)
    }
  }
}

function attachZoomToggle(block: HTMLElement): void {
  if (block.querySelector('.mermaid-zoom-toggle')) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'mermaid-zoom-toggle'
  btn.textContent = '拡大'
  btn.setAttribute('aria-label', '拡大表示')
  btn.addEventListener('click', () => openMermaidModal(block))
  block.appendChild(btn)
}

let modalEl: HTMLDivElement | null = null

function openMermaidModal(block: HTMLElement): void {
  const svg = block.querySelector('svg')
  if (!svg) return

  closeMermaidModal()

  const overlay = document.createElement('div')
  overlay.className = 'mermaid-modal-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')

  const inner = document.createElement('div')
  inner.className = 'mermaid-modal-inner'

  // Clone SVG so original stays untouched
  const svgClone = svg.cloneNode(true) as SVGElement
  svgClone.removeAttribute('style')
  // Use viewBox-based scaling and remove explicit width/height
  svgClone.removeAttribute('width')
  svgClone.removeAttribute('height')
  inner.appendChild(svgClone)

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'mermaid-modal-close'
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', '閉じる')
  closeBtn.addEventListener('click', closeMermaidModal)

  const hint = document.createElement('div')
  hint.className = 'mermaid-modal-hint'
  hint.textContent = 'ピンチでズーム、ドラッグで移動'

  overlay.appendChild(inner)
  overlay.appendChild(closeBtn)
  overlay.appendChild(hint)

  // Click on overlay (not inner) closes
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMermaidModal()
  })

  // ESC key closes
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMermaidModal()
  }
  document.addEventListener('keydown', escHandler)
  overlay.dataset.escHandler = '1'
  ;(overlay as any).__escHandler = escHandler

  document.body.appendChild(overlay)
  document.body.style.overflow = 'hidden'
  modalEl = overlay

  attachPanZoom(inner, svgClone)
}

function closeMermaidModal(): void {
  if (!modalEl) return
  const handler = (modalEl as any).__escHandler
  if (handler) document.removeEventListener('keydown', handler)
  modalEl.remove()
  modalEl = null
  document.body.style.overflow = ''
}

function attachPanZoom(container: HTMLElement, svg: SVGElement): void {
  let scale = 1
  let tx = 0
  let ty = 0

  // Get SVG natural dimensions from viewBox or rect
  const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? null
  const naturalWidth = viewBox && viewBox.length === 4 ? viewBox[2] : svg.getBoundingClientRect().width
  const naturalHeight = viewBox && viewBox.length === 4 ? viewBox[3] : svg.getBoundingClientRect().height

  // Initial fit to container
  const containerRect = container.getBoundingClientRect()
  const baseFit = Math.min(containerRect.width * 0.9 / naturalWidth, containerRect.height * 0.8 / naturalHeight)
  const baseWidth = naturalWidth * baseFit
  const baseHeight = naturalHeight * baseFit

  // SVG is centered initially
  tx = (containerRect.width - baseWidth) / 2
  ty = (containerRect.height - baseHeight) / 2

  // Pointer tracking
  const pointers = new Map<number, { x: number; y: number }>()
  let lastDist: number | null = null
  let panLastX = 0
  let panLastY = 0
  let panning = false

  const applyTransform = () => {
    // SVG width/height attributes for vector-quality rendering
    svg.setAttribute('width', String(baseWidth * scale))
    svg.setAttribute('height', String(baseHeight * scale))
    svg.style.position = 'absolute'
    svg.style.left = '0'
    svg.style.top = '0'
    svg.style.maxWidth = 'none'
    svg.style.maxHeight = 'none'
    svg.style.transformOrigin = '0 0'
    // Only translate via transform (sharp positioning)
    svg.style.transform = `translate(${tx}px, ${ty}px)`
  }
  applyTransform()

  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  container.addEventListener('pointerdown', (e) => {
    container.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1) {
      panning = true
      panLastX = e.clientX
      panLastY = e.clientY
    } else if (pointers.size === 2) {
      lastDist = pinchDistance()
      panning = false
    }
  })

  container.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const newDist = pinchDistance()
      if (lastDist) {
        const factor = newDist / lastDist
        // Zoom around pinch midpoint
        const mid = pinchMidpoint()
        const rect = container.getBoundingClientRect()
        const cx = mid.x - rect.left
        const cy = mid.y - rect.top
        const newScale = Math.max(0.5, Math.min(8, scale * factor))
        const actualFactor = newScale / scale
        tx = cx - (cx - tx) * actualFactor
        ty = cy - (cy - ty) * actualFactor
        scale = newScale
        applyTransform()
      }
      lastDist = newDist
    } else if (pointers.size === 1 && panning) {
      tx += e.clientX - panLastX
      ty += e.clientY - panLastY
      panLastX = e.clientX
      panLastY = e.clientY
      applyTransform()
    }
  })

  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) lastDist = null
    if (pointers.size === 0) panning = false
    if (pointers.size === 1) {
      // Continue panning with remaining pointer
      const remaining = pointers.values().next().value
      if (remaining) {
        panLastX = remaining.x
        panLastY = remaining.y
        panning = true
      }
    }
  }

  container.addEventListener('pointerup', endPointer)
  container.addEventListener('pointercancel', endPointer)

  // Wheel zoom for desktop
  container.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const delta = -e.deltaY * 0.002
      const factor = Math.exp(delta)
      const newScale = Math.max(0.5, Math.min(8, scale * factor))
      const actualFactor = newScale / scale
      tx = cx - (cx - tx) * actualFactor
      ty = cy - (cy - ty) * actualFactor
      scale = newScale
      applyTransform()
    },
    { passive: false }
  )

  // Double-tap to reset
  let lastTap = 0
  container.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return
    const now = Date.now()
    if (now - lastTap < 300) {
      scale = 1
      tx = 0
      ty = 0
      applyTransform()
    }
    lastTap = now
  })

  function pinchDistance(): number {
    const p = Array.from(pointers.values())
    if (p.length < 2) return 0
    const dx = p[0].x - p[1].x
    const dy = p[0].y - p[1].y
    return Math.hypot(dx, dy)
  }

  function pinchMidpoint(): { x: number; y: number } {
    const p = Array.from(pointers.values())
    return {
      x: (p[0].x + p[1].x) / 2,
      y: (p[0].y + p[1].y) / 2,
    }
  }
}
