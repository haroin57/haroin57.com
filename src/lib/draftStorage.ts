// 下書き保存用のlocalStorageユーティリティ

const DRAFT_PREFIX = 'haroin57_draft_'

export type PostDraft = {
  slug: string
  title: string
  summary: string
  tags: string
  markdown: string
  savedAt: number
  createdAt?: string // 元記事の作成日（公開済みから下書きに戻した場合）
  isRevertedFromPublished?: boolean // 公開済みから戻された下書きかどうか
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

// 下書きを保存
export function saveDraft<T extends PostDraft | ProductDraft>(
  type: 'post' | 'product',
  slug: string,
  data: Omit<T, 'savedAt'>
): void {
  try {
    const key = getDraftKey(type, slug)
    const draft = { ...data, savedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(draft))
    console.log(`Draft saved: ${key}`)
  } catch (error) {
    console.error('Failed to save draft:', error)
  }
}

// 下書きを読み込み
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

// 下書きを削除
export function deleteDraft(type: 'post' | 'product', slug: string): void {
  try {
    const key = getDraftKey(type, slug)
    localStorage.removeItem(key)
    console.log(`Draft deleted: ${key}`)
  } catch (error) {
    console.error('Failed to delete draft:', error)
  }
}

// 全ての下書きを取得
export function getAllDrafts(): { posts: PostDraft[]; products: ProductDraft[] } {
  const posts: PostDraft[] = []
  const products: ProductDraft[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX)) continue

      const data = localStorage.getItem(key)
      if (!data) continue

      try {
        const parsed = JSON.parse(data)
        if (key.includes('_post_')) {
          posts.push(parsed as PostDraft)
        } else if (key.includes('_product_')) {
          products.push(parsed as ProductDraft)
        }
      } catch {
        // ignore invalid JSON
      }
    }
  } catch (error) {
    console.error('Failed to get all drafts:', error)
  }

  return { posts, products }
}

// 下書きが存在するかチェック
export function hasDraft(type: 'post' | 'product', slug: string): boolean {
  const key = getDraftKey(type, slug)
  return localStorage.getItem(key) !== null
}

// 下書きの保存日時をフォーマット
export function formatDraftDate(savedAt: number): string {
  const date = new Date(savedAt)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 公開済み記事を下書きに戻す（削除せずにローカルに保存）
export function revertPostToDraft(post: {
  slug: string
  title: string
  summary: string
  tags: string[]
  markdown: string
  createdAt: string
}): void {
  saveDraft<PostDraft>('post', `reverted_${post.slug}`, {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    tags: post.tags.join(', '),
    markdown: post.markdown,
    createdAt: post.createdAt,
    isRevertedFromPublished: true,
  })
}

// 下書き一覧を取得（詳細情報付き）
export function getPostDrafts(): PostDraft[] {
  const drafts: PostDraft[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX) || !key.includes('_post_')) continue

      const data = localStorage.getItem(key)
      if (!data) continue

      try {
        const parsed = JSON.parse(data) as PostDraft
        drafts.push(parsed)
      } catch {
        // ignore invalid JSON
      }
    }
  } catch (error) {
    console.error('Failed to get post drafts:', error)
  }

  // 保存日時の新しい順にソート
  return drafts.sort((a, b) => b.savedAt - a.savedAt)
}

// 下書きキーからslug部分を抽出
export function getDraftSlugFromKey(_type: 'post' | 'product', draft: PostDraft | ProductDraft): string {
  // revertedの場合は reverted_xxx 形式
  if ('isRevertedFromPublished' in draft && draft.isRevertedFromPublished) {
    return `reverted_${draft.slug}`
  }
  return draft.slug || 'new'
}
