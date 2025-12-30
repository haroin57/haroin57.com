import { useEffect } from 'react'
import { isMobileDevice, isLowPerformanceDevice } from '../utils/device'

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

      // 更新頻度を下げてメインスレッド負荷を軽減（0.05単位で丸める）
      const roundedT = Math.round(t * 20) / 20
      if (roundedT === lastT) return
      lastT = roundedT

      const blur = t * effectiveMaxBlur
      const wash = Math.min(0.6, baseWash + t * maxExtraWash)
      const scale = enableScale ? 1 + blur / 140 : 1
      const opacity = 1 - t * (1 - minOpacity)

      // CSSカスタムプロパティを更新
      if (effectiveMaxBlur > 0 && blur >= 0.05) {
        const blurValue = `${blur.toFixed(1)}px`
        body.style.setProperty('--bg-filter', `blur(${blurValue})`)
        body.style.setProperty('--bg-blur', blurValue)
      } else {
        body.style.removeProperty('--bg-filter')
        body.style.removeProperty('--bg-blur')
      }

      if (enableScale && Math.abs(scale - 1) >= 0.001) {
        body.style.setProperty('--bg-scale', scale.toFixed(3))
      } else {
        body.style.removeProperty('--bg-scale')
      }

      body.style.setProperty('--bg-wash', wash.toFixed(2))
      body.style.setProperty('--bg-opacity', opacity.toFixed(2))

      // スクロールが進んだらアニメーションを停止
      const shouldPause = t > 0.05
      body.style.setProperty('--bg-animation-state', shouldPause ? 'paused' : 'running')
      body.style.setProperty('--p5-animation-state', shouldPause ? 'paused' : 'running')
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

      // transitionなしの状態で先にCSS変数をリセット（ページ遷移時の負荷を抑える）
      body.style.removeProperty('--bg-filter')
      body.style.removeProperty('--bg-blur')
      body.style.removeProperty('--bg-scale')
      body.style.removeProperty('--bg-wash')
      body.style.removeProperty('--bg-opacity')
      body.style.removeProperty('--bg-animation-state')
      body.style.removeProperty('--p5-animation-state')
      body.classList.remove('post-detail-page')
    }
  }, [startPx, rangePx, maxBlurPx, maxExtraWash, minOpacity])
}
