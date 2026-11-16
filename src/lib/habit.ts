export async function habitRequest<T>(path: string, token?: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/habit/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal,
  })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || '記録の取得・保存に失敗しました。')
  return data
}
export const habitButton = 'min-h-12 rounded-lg border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-3 text-left hover:bg-[color:var(--ui-surface-hover)] disabled:opacity-50 touch-manipulation'
export const habitInput = 'w-full rounded-lg border border-[color:var(--ui-border)] bg-black/50 p-3 text-[color:var(--fg)]'
