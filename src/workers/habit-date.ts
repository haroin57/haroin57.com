/** JST 04:00 is UTC 19:00 of the preceding calendar day. */
export function habitTargetDate(now = new Date()): string {
  return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
export function shiftHabitDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
export function habitStreak(dates: string[], today: string): number {
  const achieved = new Set(dates)
  let date = achieved.has(today) ? today : shiftHabitDate(today, -1)
  let count = 0
  while (achieved.has(date)) {
    count++
    date = shiftHabitDate(date, -1)
  }
  return count
}
