import { useEffect } from 'react'

// モバイルデバイスかどうかを判定（Android含む低性能デバイス検出）
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  // User-Agentでモバイル判定
  const ua = navigator.userAgent.toLowerCase()
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  // 画面サイズでも判定（タッチデバイス対応）
  const isSmallScreen = window.innerWidth < 768
  return isMobile || isSmallScreen
}

// 低性能デバイスかどうかを判定
const isLowPerformanceDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  // Android判定（iOSより一般的にGPU性能が低い）
  const isAndroid = /android/i.test(navigator.userAgent)
  // ハードウェア並列度が低い場合（古いデバイス）
  const lowConcurrency = (navigator.hardwareConcurrency || 4) <= 4
  // メモリが少ない場合（Chrome/Edge限定）
  const lowMemory = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4

  return isAndroid || lowConcurrency || lowMemory
}

type ScrollBlurOptions = {
  startPx?: number
  rangePx?: number
  maxBlurPx?: number
  maxExtraWash?: number
  minOpacity?: number
}

/**
 * スクロールに応じた背景ブラーエフェクトを適用するフック
 * モバイル/低性能デバイスでは軽量化または無効化
 */
export function useScrollBlur(options: ScrollBlurOptions = {}) {
  const {
    startPx = 48,
    rangePx = 420,
    maxBlurPx = 12,
    maxExtraWash = 0.2,
    minOpacity = 0.65,
  } = options

  useEffect(() => {
    const body = document.body
    body.classList.add('post-detail-page')

    const rootStyle = window.getComputedStyle(document.documentElement)
    const baseWashRaw = rootStyle.getPropertyValue('--bg-wash').trim()
    const baseWash = Number.isFinite(Number.parseFloat(baseWashRaw)) ? Number.parseFloat(baseWashRaw) : 0

    // モバイル/低性能デバイスではblurを無効化または軽量化
    const isMobile = isMobileDevice()
    const isLowPerf = isLowPerformanceDevice()

    // 低性能デバイスではblurを完全に無効化
    // モバイルではblur量を半減
    const effectiveMaxBlur = isLowPerf ? 0 : (isMobile ? maxBlurPx * 0.5 : maxBlurPx)
    // 低性能デバイスではスケールエフェクトも無効化
    const enableScale = !isLowPerf

    let rafId = 0
    let lastT = -1 // 前回のt値を記憶して不要な更新を防ぐ

    const update = () => {
      const y = window.scrollY || 0
      const t = Math.max(0, Math.min(1, (y - startPx) / rangePx))

      // t値が変わっていない場合はスキップ（0.01単位で丸める）
      const roundedT = Math.round(t * 100) / 100
      if (roundedT === lastT) return
      lastT = roundedT

      const blur = t * effectiveMaxBlur
      const wash = Math.min(0.6, baseWash + t * maxExtraWash)
      const scale = enableScale ? 1 + blur / 140 : 1
      const opacity = 1 - t * (1 - minOpacity)

      // CSSカスタムプロパティを更新
      if (effectiveMaxBlur > 0) {
        body.style.setProperty('--bg-blur', `${blur.toFixed(1)}px`)
      }
      if (enableScale) {
        body.style.setProperty('--bg-scale', scale.toFixed(3))
      }
      body.style.setProperty('--bg-wash', wash.toFixed(2))
      body.style.setProperty('--bg-opacity', opacity.toFixed(2))

      // スクロールが進んだらアニメーションを停止
      body.style.setProperty('--bg-animation-state', t > 0.1 ? 'paused' : 'running')
    }

    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        update()
      })
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) window.cancelAnimationFrame(rafId)

      // クリーンアップ時のアニメーション
      // 低性能デバイスではアニメーションなしで即時リセット
      if (isLowPerf) {
        body.classList.remove('post-detail-page')
        body.style.removeProperty('--bg-blur')
        body.style.removeProperty('--bg-scale')
        body.style.removeProperty('--bg-wash')
        body.style.removeProperty('--bg-opacity')
        body.style.removeProperty('--bg-animation-state')
        return
      }

      const parseNumber = (value: string, fallback: number) => {
        const n = Number.parseFloat(value)
        return Number.isFinite(n) ? n : fallback
      }

      const startBlur = parseNumber(body.style.getPropertyValue('--bg-blur'), 0)
      const startScale = parseNumber(body.style.getPropertyValue('--bg-scale'), 1)
      const startWash = parseNumber(body.style.getPropertyValue('--bg-wash'), baseWash)
      const startOpacity = parseNumber(body.style.getPropertyValue('--bg-opacity'), 1)
      const durationMs = 120
      const startedAt = performance.now()

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / durationMs)
        const k = easeOutCubic(t)
        const blur = startBlur * (1 - k)
        const scale = startScale + (1 - startScale) * k
        const wash = startWash + (baseWash - startWash) * k
        const opacity = startOpacity + (1 - startOpacity) * k

        body.style.setProperty('--bg-blur', `${blur.toFixed(1)}px`)
        body.style.setProperty('--bg-scale', scale.toFixed(3))
        body.style.setProperty('--bg-wash', wash.toFixed(2))
        body.style.setProperty('--bg-opacity', opacity.toFixed(2))

        if (t < 1) {
          window.requestAnimationFrame(tick)
          return
        }

        body.classList.remove('post-detail-page')
        body.style.removeProperty('--bg-blur')
        body.style.removeProperty('--bg-scale')
        body.style.removeProperty('--bg-wash')
        body.style.removeProperty('--bg-opacity')
        body.style.removeProperty('--bg-animation-state')
      }

      window.requestAnimationFrame(tick)
    }
  }, [startPx, rangePx, maxBlurPx, maxExtraWash, minOpacity])
}
