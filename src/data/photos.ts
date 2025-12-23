/**
 * 写真データ定義ファイル
 *
 * 新しい写真を追加する場合は、以下のフォーマットで追加してください：
 *
 * {
 *   src: '/Photo/画像ファイル名.webp',  // public/以下の画像パス
 *   title: '写真タイトル',               // 日本語タイトル
 *   location: '撮影場所',                // 例: '長野', '東京'
 *   date: 'YYYY-MM-DD',                  // 撮影日（ISO形式）
 *   camera: 'カメラ種類',                // 例: 'ミラーレス', 'コンパクト'
 *   lens: 'レンズ情報',                  // 例: '35mm 単焦点'
 *   exposure: '露出情報',                // 例: 'f2.0 1/80 ISO 800'
 *   note: '写真の説明文',                // 短い説明
 * }
 */

export type Photo = {
  /** 画像ファイルパス（public/からの相対パス） */
  src: string
  /** 写真タイトル */
  title: string
  /** 撮影場所 */
  location: string
  /** 撮影日（YYYY-MM-DD形式） */
  date: string
  /** カメラ種類 */
  camera: string
  /** レンズ情報 */
  lens: string
  /** 露出情報（F値, シャッタースピード, ISO） */
  exposure: string
  /** 写真の説明文 */
  note: string
}

/**
 * 写真データ一覧
 * 新しい写真を追加する場合は、配列の先頭または末尾に追加してください
 */
export const photos: Photo[] = [
  {
    src: '/Photo/星置の滝.webp',
    title: '星置の滝',
    location: '',
    date: '',
    camera: '',
    lens: '',
    exposure: '',
    note: '',
  },
  {
    src: '/Photo/美ヶ原.webp',
    title: '美ヶ原',
    location: '',
    date: '',
    camera: '',
    lens: '',
    exposure: '',
    note: '',
  },
  {
    src: '/Photo/松本城.webp',
    title: '松本城',
    location: '',
    date: '',
    camera: '',
    lens: '',
    exposure: '',
    note: '',
  },
  {
    src: '/Photo/奈良井宿.webp',
    title: '奈良井宿',
    location: '',
    date: '',
    camera: '',
    lens: '',
    exposure: '',
    note: '',
  },
  {
    src: '/Photo/折り紙.webp',
    title: '折り紙',
    location: '',
    date: '',
    camera: '',
    lens: '',
    exposure: '',
    note: '',
  },
  {
    src: '/Photo/プロフィール - コピー.webp',
    title: 'プロフィール',
    location: '',
    date: '',
    camera: '',
    lens: '',
    exposure: '',
    note: '',
  },
]

/**
 * 写真タグ一覧
 * ヘッダーに表示するタグを追加できます
 */
export const shotTags: string[] = [
  // 例: '夜の走り', '雨の反射', '駅の静けさ'
]
