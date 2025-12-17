import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

// Mermaidの初期化
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#4f46e5',
    primaryTextColor: '#f3f4f6',
    primaryBorderColor: '#6366f1',
    lineColor: '#6366f1',
    secondaryColor: '#1f2937',
    tertiaryColor: '#111827',
    background: '#0f172a',
    mainBkg: '#1e293b',
    nodeBorder: '#6366f1',
    clusterBkg: '#1e293b',
    clusterBorder: '#4f46e5',
    titleColor: '#f3f4f6',
    edgeLabelBackground: '#1e293b',
    nodeTextColor: '#f3f4f6',
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
})

interface MermaidRendererProps {
  chart: string
  className?: string
}

export function MermaidRenderer({ chart, className = '' }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current) return

      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
        const { svg: renderedSvg } = await mermaid.render(id, chart)
        setSvg(renderedSvg)
        setError(null)
      } catch (err) {
        console.error('Mermaid rendering error:', err)
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      }
    }

    renderChart()
  }, [chart])

  if (error) {
    return (
      <div className={`mermaid-error bg-red-900/30 border border-red-500/50 rounded-lg p-4 ${className}`}>
        <p className="text-red-400 text-sm">Failed to render diagram: {error}</p>
        <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">{chart}</pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-container ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// Markdownから抽出されたMermaidブロックを処理するコンポーネント
interface MermaidBlockProps {
  code: string
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  return (
    <div className="mermaid-wrapper my-6 flex justify-center">
      <MermaidRenderer
        chart={code}
        className="bg-slate-900/50 rounded-lg p-6 overflow-x-auto max-w-full"
      />
    </div>
  )
}
