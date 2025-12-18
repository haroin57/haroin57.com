type MermaidAPI = {
  initialize: (config: unknown) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}

let mermaidPromise: Promise<MermaidAPI> | null = null
let initialized = false

const mermaidConfig = {
  startOnLoad: false,
  theme: 'dark',
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
