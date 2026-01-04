/**
 * デバイス判定ユーティリティ
 * モバイルデバイスや低性能デバイスの判定を共通化
 */

/**
 * モバイルデバイスかどうかを判定
 * User-Agentとスクリーンサイズで判定
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  const isSmallScreen = window.innerWidth < 768
  return isMobile || isSmallScreen
}

/**
 * 低性能デバイスかどうかを判定
 * CPU並列度とメモリ量で判定（モバイルでも最近のデバイスは高性能）
 */
export const isLowPerformanceDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  // CPU 2コア以下は確実に低性能
  const veryLowConcurrency = (navigator.hardwareConcurrency || 4) <= 2
  // メモリ2GB未満は確実に低性能（deviceMemoryがない場合は判定しない）
  const veryLowMemory = (navigator as { deviceMemory?: number }).deviceMemory !== undefined && (navigator as { deviceMemory?: number }).deviceMemory! < 2
  return veryLowConcurrency || veryLowMemory
}

/**
 * デバイスに応じた最適なレンダースケールを計算
 */
export const getOptimalRenderScale = (): number => {
  if (typeof window === 'undefined') return 1

  const dpr = window.devicePixelRatio || 1
  const screenArea = window.innerWidth * window.innerHeight
  const isLowPerf = isLowPerformanceDevice()

  // 低性能デバイスでは大幅に軽量化
  if (isLowPerf) {
    return 0.5
  }

  // 高解像度・大画面デバイスではフルスケール
  if (dpr >= 2 && screenArea > 1000000) {
    return 1.0
  } else if (dpr >= 2 || screenArea > 800000) {
    return 0.9
  } else if (screenArea > 400000) {
    return 0.75
  }
  return 0.6
}

/**
 * デバイスに応じた目標FPSを取得
 */
export const getTargetFPS = (): number => {
  if (typeof window === 'undefined') return 60
  return isLowPerformanceDevice() ? 30 : 60
}
