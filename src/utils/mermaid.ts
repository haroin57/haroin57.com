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
  securityLevel: 'loose',
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
    } catch {
      setMermaidError(block)
    }
  }
}
