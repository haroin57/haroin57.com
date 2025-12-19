/**
 * 写真データ定義ファイル
 *
 * 新しい写真を追加する場合は、以下のフォーマットで追加してください：
 *
 * {
 *   src: '/画像ファイルパス.webp',  // public/以下の画像パス
 *   title: '写真タイトル',           // 日本語タイトル
 *   location: '撮影場所',            // 例: '長野', '東京'
 *   date: 'YYYY-MM-DD',              // 撮影日（ISO形式）
 *   camera: 'カメラ種類',            // 例: 'ミラーレス', 'コンパクト'
 *   lens: 'レンズ情報',              // 例: '35mm 単焦点'
 *   exposure: '露出情報',            // 例: 'f2.0 1/80 ISO 800'
 *   note: '写真の説明文',            // 短い説明
 *   ratio: 'landscape',              // 'portrait' | 'landscape' | 'square'
 *   tone: '#f59e0b',                 // アクセントカラー（HEX形式）
 * }
 */

export type PhotoRatio = 'portrait' | 'landscape' | 'square'

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
  /** アスペクト比: 'portrait'(4:5), 'landscape'(4:3), 'square'(1:1) */
  ratio: PhotoRatio
  /** アクセントカラー（HEX形式） */
  tone: string
}

/**
 * 写真データ一覧
 * 新しい写真を追加する場合は、配列の先頭または末尾に追加してください
 */
export const photos: Photo[] = [
  // 例:
  // {
  //   src: '/example.webp',
  //   title: '写真タイトル',
  //   location: '場所',
  //   date: '2024-01-01',
  //   camera: 'ミラーレス',
  //   lens: '35mm 単焦点',
  //   exposure: 'f2.0 1/80 ISO 800',
  //   note: '写真の説明文',
  //   ratio: 'landscape',
  //   tone: '#f59e0b',
  // },
]

/**
 * 写真タグ一覧
 * ヘッダーに表示するタグを追加できます
 */
export const shotTags: string[] = [
  // 例: '夜の走り', '雨の反射', '駅の静けさ'
]
