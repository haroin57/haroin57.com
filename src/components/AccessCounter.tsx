import { useEffect, useRef, useState } from 'react'

function AccessCounter() {
  const [count, setCount] = useState<number | null>(null)
  const incremented = useRef(false)

  useEffect(() => {
    if (incremented.current) return
    incremented.current = true
    try {
      const current = Number(localStorage.getItem('haroin-visit-count') ?? '0')
      const next = Number.isFinite(current) ? current + 1 : 1
      localStorage.setItem('haroin-visit-count', String(next))
      setCount(next)
    } catch {
      // localStorage が使えない環境では無視
    }
  }, [])

  return <span>Access: {count ?? '...'}</span>
}

export default AccessCounter
