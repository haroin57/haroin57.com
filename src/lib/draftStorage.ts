// 下書き保存用のlocalStorageユーティリティ
// ※ローカル編集中の一時保存用。サーバー側の下書きはD1に保存される

const DRAFT_PREFIX = 'haroin57_draft_'

export type PostDraft = {
  slug: string
  title: string
  summary: string
  tags: string
  markdown: string
  savedAt: number
  createdAt?: string
}

export type ProductDraft = {
  slug: string
  name: string
  description: string
  language: string
  tags: string
  url: string
  demo: string
  markdown: string
  savedAt: number
}

// 下書きキーを生成
function getDraftKey(type: 'post' | 'product', slug: string): string {
  return `${DRAFT_PREFIX}${type}_${slug || 'new'}`
}

// ローカル下書きを保存（編集中の一時保存用）
export function saveDraft<T extends PostDraft | ProductDraft>(
  type: 'post' | 'product',
  slug: string,
  data: Omit<T, 'savedAt'>
): void {
  try {
    const key = getDraftKey(type, slug)
    const draft = { ...data, savedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(draft))
  } catch (error) {
    console.error('Failed to save draft:', error)
  }
}

// ローカル下書きを読み込み
export function loadDraft<T extends PostDraft | ProductDraft>(
  type: 'post' | 'product',
  slug: string
): T | null {
  try {
    const key = getDraftKey(type, slug)
    const data = localStorage.getItem(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    console.error('Failed to load draft:', error)
    return null
  }
}

// ローカル下書きを削除
export function deleteDraft(type: 'post' | 'product', slug: string): void {
  try {
    const key = getDraftKey(type, slug)
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Failed to delete draft:', error)
  }
}

// 下書きの保存日時をフォーマット
export function formatDraftDate(savedAt: number | string): string {
  const date = typeof savedAt === 'string' ? new Date(savedAt) : new Date(savedAt)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
