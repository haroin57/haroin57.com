import { useEffect, useRef, useState } from 'react'

const API_ENDPOINT = '/api/pv'
const CACHE_KEY = 'haroin-pv-last'

function AccessCounter() {
  const cached = typeof window !== 'undefined' ? Number(localStorage.getItem(CACHE_KEY) ?? '0') : 0
  const [count, setCount] = useState<number | null>(Number.isFinite(cached) && cached > 0 ? cached : null)
  const didSend = useRef(false)

  useEffect(() => {
    if (didSend.current) return
    didSend.current = true

    const controller = new AbortController()

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { total?: number }
        if (typeof data.total === 'number') {
          setCount(data.total)
          try {
            localStorage.setItem(CACHE_KEY, String(data.total))
          } catch {
            /* ignore */
          }
        } else {
          throw new Error('invalid payload')
        }
      })
      .catch(() => {
        setCount((prev) => (prev && prev > 0 ? prev : null))
      })

    return () => controller.abort()
  }, [])

  return <span>Access: {count ?? '...'} </span>
}

export default AccessCounter
