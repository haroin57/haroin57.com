export const habitFields = ['squat_count', 'pushup_sets', 'abs_sets', 'bike_minutes', 'english_count', 'drawing_done', 'screenshot_count', 'work_focus_done', 'circuit_done', 'shadowing_done'] as const
export type HabitField = typeof habitFields[number]
export type HabitLog = Record<HabitField, number> & {
  id: number
  target_date: string
  memo: string
  drawing_image_url: string | null
  tweeted: number
  created_at: string
  updated_at: string
}
export type HabitTodo = { id: number; target_date: string; priority: number; title: string; is_completed: number }
export type HabitStats = {
  days: { date: string; score: number }[]
  totals: { total_squat: number; total_bike_minutes: number; total_english: number; drawing_days: number }
  streak_days: number
  logs: HabitLog[]
}
