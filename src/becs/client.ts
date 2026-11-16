export class BecsError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export async function becsRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const csrf = sessionStorage.getItem('becs_csrf') ?? ''
  const response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json', 'X-BECS-CSRF': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const result = await response.json() as T & { error?: string; message?: string; missing?: string[] }
  if (!response.ok) throw new BecsError([result.error ?? result.message ?? '処理を確認できません。', ...(result.missing ?? [])].join(' / '), response.status)
  return result
}
