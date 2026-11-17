import type { HabitStats } from '../types/habit'

export async function fetchHabitStats(signal?: AbortSignal): Promise<HabitStats> {
  const response = await fetch('/api/habit/stats', { method: 'GET', credentials: 'omit', cache: 'no-store', signal })
  const data = await response.json() as HabitStats & { error?: string }
  if (!response.ok) throw new Error(data.error || '活動ログの取得に失敗しました。')
  return data
}
