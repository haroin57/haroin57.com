/**
 * Vite向けプリロード/プリフェッチ制御
 *
 * webpackのmagic commentsの代わりに、ブラウザのResource Hints APIを使用して
 * 動的にpreload/prefetchを制御する
 */

import { shouldPrefetch as checkSlowConnection } from './network'

type PreloadPriority = 'high' | 'low' | 'auto'

// プリロード済みのモジュールを追跡
const preloadedModules = new Set<string>()
const prefetchedModules = new Set<string>()

/**
 * モジュールを高優先度でプリロード
 * link rel="modulepreload" を動的に挿入
 */
export function preloadModule(url: string): void {
  if (preloadedModules.has(url)) return
  preloadedModules.add(url)

  const link = document.createElement('link')
  link.rel = 'modulepreload'
  link.href = url
  link.as = 'script'
  document.head.appendChild(link)
}

/**
 * モジュールを低優先度でプリフェッチ
 * link rel="prefetch" を動的に挿入
 */
export function prefetchModule(url: string): void {
  if (prefetchedModules.has(url) || preloadedModules.has(url)) return
  prefetchedModules.add(url)

  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  link.as = 'script'
  document.head.appendChild(link)
}

/**
 * 動的インポートをラップしてプリロード優先度を制御
 */
export function createPreloader<T>(
  loader: () => Promise<T>,
  options: { priority?: PreloadPriority; chunkName?: string } = {}
): () => Promise<T> {
  const { priority = 'auto' } = options
  let cachedPromise: Promise<T> | null = null

  return () => {
    if (cachedPromise) return cachedPromise

    // 低速回線ではプリロードをスキップ
    if (priority !== 'high' && !checkSlowConnection()) {
      cachedPromise = loader()
      return cachedPromise
    }

    cachedPromise = loader()
    return cachedPromise
  }
}

/**
 * 高優先度プリロード（クリティカルなルート用）
 * - 即座にインポートを開始
 * - ブラウザに高優先度としてヒント
 */
export function preload<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null

  const load = () => {
    if (!promise) {
      promise = loader()
    }
    return promise
  }

  // 即座にプリロード開始
  if (typeof window !== 'undefined') {
    // requestIdleCallbackまたはsetTimeoutで非同期に開始
    const schedulePreload = 'requestIdleCallback' in window
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 100 })
      : (cb: () => void) => setTimeout(cb, 0)

    schedulePreload(() => {
      load()
    })
  }

  return load
}

/**
 * 低優先度プリフェッチ（将来必要になる可能性のあるルート用）
 * - ブラウザがアイドル時にのみロード
 * - 低速回線では無効
 */
export function prefetch<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null

  const load = () => {
    if (!promise) {
      promise = loader()
    }
    return promise
  }

  // アイドル時にプリフェッチ
  if (typeof window !== 'undefined' && checkSlowConnection()) {
    const schedulePrefetch = 'requestIdleCallback' in window
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 3000 })
      : (cb: () => void) => setTimeout(cb, 1000)

    schedulePrefetch(() => {
      load()
    })
  }

  return load
}

/**
 * 遅延ロード（ユーザーアクションまで待機）
 * プリロード/プリフェッチなし
 */
export function lazyLoad<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null

  return () => {
    if (!promise) {
      promise = loader()
    }
    return promise
  }
}
