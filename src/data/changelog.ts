/**
 * サイト更新ログデータ
 *
 * Posts と Products は自動的にタイムラインに追加されます。
 * Photos や About などの更新は、このファイルで手動で管理します。
 */

export type ChangelogEntry = {
  /** 更新タイプ */
  type: 'photo' | 'about' | 'site'
  /** 表示タイトル */
  title: string
  /** 更新日（YYYY-MM-DD形式） */
  date: string
  /** 説明文（オプション） */
  summary?: string
  /** リンク先（オプション） */
  link?: string
}

/**
 * 手動で追加する更新ログ
 * 新しい更新を追加する場合は、配列の先頭に追加してください
 */
export const manualChangelog: ChangelogEntry[] = [
  {
    type: 'about',
    title: 'Aboutページを更新',
    date: '2025-12-20',
    summary: 'プロフィール情報を更新しました',
    link: '/about',
  },
  {
    type: 'photo',
    title: '過去に撮影した写真を追加',
    date: '2025-12-10',
    summary: '過去に撮影した写真を追加',
    link: '/photos',
  },
  {
    type: 'site',
    title: 'サイトを公開',
    date: '2025-12-01',
    summary: 'haroin57.com を公開しました',
    link: '/',
  },
]
