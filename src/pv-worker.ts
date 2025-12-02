// Minimal KV type for this Worker（追加の型パッケージなしで利用）
type KVNamespace = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<void>
}

export default {
  async fetch(_req: Request, env: { HAROIN_PV: KVNamespace }) {
    const key = 'total'
    const current = Number((await env.HAROIN_PV.get(key)) ?? '0')
    const next = Number.isFinite(current) ? current + 1 : 1
    await env.HAROIN_PV.put(key, String(next))
    return new Response(JSON.stringify({ total: next }), {
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*', // フロント直呼び用
      },
    })
  },
}
