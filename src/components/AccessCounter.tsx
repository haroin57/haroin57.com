import { useEffect, useRef, useState } from 'react'

const API_ENDPOINT = '/api/pv'
const CACHE_KEY = 'haroin-pv-last'
const SESSION_KEY = 'haroin-pv-counted'

function AccessCounter() {
  const cached = typeof window !== 'undefined' ? Number(localStorage.getItem(CACHE_KEY) ?? '') : NaN
  const [count, setCount] = useState<number | null>(Number.isFinite(cached) ? cached : null)
  const didSend = useRef(false)

  useEffect(() => {
    if (didSend.current) return
    didSend.current = true

    // セッション内で既にカウント済みかチェック
    const alreadyCounted = sessionStorage.getItem(SESSION_KEY) === '1'

    const controller = new AbortController()

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipCount: alreadyCounted }),
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
            // セッション内でカウント済みとしてマーク
            sessionStorage.setItem(SESSION_KEY, '1')
          } catch {
            /* ignore */
          }
        } else {
          throw new Error('invalid payload')
        }
      })
      .catch((err) => {
        console.error('PV API error:', err)
        setCount((prev) => (prev && prev > 0 ? prev : null))
      })

    return () => controller.abort()
  }, [])

  return <span>Access: {count ?? '...'} </span>
}

export default AccessCounter
