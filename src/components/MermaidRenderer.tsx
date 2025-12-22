import { useEffect, useRef, useState } from 'react'
import { loadMermaid } from '../utils/mermaid'

interface MermaidRendererProps {
  chart: string
  className?: string
}

export function MermaidRenderer({ chart, className = '' }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const renderChart = async () => {
      if (!containerRef.current) return

      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
        const api = await loadMermaid()
        const { svg: renderedSvg, bindFunctions } = await api.render(id, chart)
        if (!isActive) return
        setSvg(renderedSvg)
        setError(null)
        if (bindFunctions) {
          requestAnimationFrame(() => {
            const container = containerRef.current
            if (container) bindFunctions(container)
          })
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err)
        if (!isActive) return
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      }
    }

    renderChart()
    return () => {
      isActive = false
    }
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
