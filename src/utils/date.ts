/**
 * 日付ユーティリティ関数
 */

/**
 * 日付を相対表記に変換（例: "3 days ago"）
 */
export function formatRelativeDate(dateStr: string): string {
  // 日付のみを比較（時間は無視）してタイムゾーン問題を回避
  const datePart = dateStr.split('T')[0] // "2025-12-24" 形式
  const [year, month, day] = datePart.split('-').map(Number)
  const targetDate = new Date(year, month - 1, day) // ローカルタイムで作成

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = today.getTime() - targetDate.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 0) return 'Today' // 未来の日付は「Today」として扱う
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

/**
 * ISO日付を表示用フォーマットに変換（例: "2025/01/02 12:30"）
 */
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

/**
 * ISO日付を日付のみのフォーマットに変換（例: "2025-01-02"）
 */
export function formatDateOnly(isoDate: string): string {
  return isoDate.split('T')[0]
}
