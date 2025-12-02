import { useEffect, useRef, useState } from 'react'

// サーバーで集計するPVカウンター
// 期待するエンドポイント: POST { } -> { total: number }
// .envなどで VITE_PV_ENDPOINT を指定できるようにしています。
const API_ENDPOINT = import.meta.env.VITE_PV_ENDPOINT || '/api/pv'

function AccessCounter() {
  const [count, setCount] = useState<number | null>(null)
  const didSend = useRef(false)

  useEffect(() => {
    if (didSend.current) return
    didSend.current = true

    const controller = new AbortController()

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // bodyは空でもOK
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { total?: number }
        if (typeof data.total === 'number') {
          setCount(data.total)
        } else {
          throw new Error('invalid payload')
        }
      })
      .catch(() => {
        // 失敗時は非表示ではなく「...」のままにする
        setCount(null)
      })

    return () => controller.abort()
  }, [])

  return <span>Access: {count ?? '...'} </span>
}

export default AccessCounter
