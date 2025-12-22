// ネットワーク状態の検出ユーティリティ

type NetworkInfo = {
  effectiveType?: string
  saveData?: boolean
  downlink?: number
}

// Navigator.connection の型拡張
type NavigatorWithConnection = Navigator & {
  connection?: NetworkInfo
}

/**
 * 低速回線かどうかを判定
 * - saveData モードが有効
 * - 2G/slow-2g 接続
 * - downlink が 0.5Mbps 未満
 */
export function isSlowConnection(): boolean {
  const nav = navigator as NavigatorWithConnection
  const connection = nav.connection
  if (!connection) return false

  if (connection.saveData) return true
  if (connection.effectiveType?.includes('2g')) return true
  if (connection.downlink !== undefined && connection.downlink < 0.5) return true

  return false
}

/**
 * プリフェッチを許可するかどうか
 * 低速回線では false を返す
 */
export function shouldPrefetch(): boolean {
  return !isSlowConnection()
}

/**
 * 接続タイプに応じた遅延時間を返す
 * 高速: 0ms, 3G: 100ms, 2G: プリフェッチなし
 */
export function getPrefetchDelay(): number {
  const nav = navigator as NavigatorWithConnection
  const connection = nav.connection
  if (!connection) return 0

  if (connection.effectiveType === '3g') return 100
  if (connection.effectiveType?.includes('2g')) return Infinity // プリフェッチしない
  if (connection.saveData) return Infinity

  return 0
}
