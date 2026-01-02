import { useEffect, useState, useRef, useCallback, useMemo } from 'react'

export type FetchState<T> = {
  data: T
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export type FetchOptions<T, R = unknown> = {
  headers?: Record<string, string>
  fallback?: T
  transform?: (data: R) => T
  /** SSRハイドレーション時に初回フェッチをスキップ（フォールバックデータを使用） */
  skipInitialFetch?: boolean
}

/**
 * 汎用データフェッチフック（フォールバック対応）
 * @param url フェッチするURL (nullの場合はフェッチしない)
 * @param options フェッチオプション
 */
export function useFetch<T, R = unknown>(
  url: string | null,
  options?: FetchOptions<T, R>
): FetchState<T> {
  const fallback = options?.fallback as T
  const skipInitial = options?.skipInitialFetch ?? false
  // skipInitialFetchの場合は最初からロード完了状態
  const [data, setData] = useState<T>(fallback)
  const [isLoading, setIsLoading] = useState(url !== null && !skipInitial)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const initialFetchSkipped = useRef(skipInitial)

  // headers と transform を安定化
  const headersRef = useRef(options?.headers)
  headersRef.current = options?.headers
  const transformRef = useRef(options?.transform)
  transformRef.current = options?.transform

  const fetchData = useCallback(async () => {
    if (!url) {
      setIsLoading(false)
      return
    }

    // 前回のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(url, {
        headers: headersRef.current,
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = (await res.json()) as R
      const transformed = transformRef.current ? transformRef.current(json) : (json as unknown as T)
      setData(transformed)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // キャンセルされた場合は無視
      }
      setError(err instanceof Error ? err : new Error('Unknown error'))
      // エラー時はフォールバックを維持
    } finally {
      setIsLoading(false)
    }
  }, [url])

  useEffect(() => {
    // skipInitialFetchの場合、初回のみスキップ
    if (initialFetchSkipped.current) {
      initialFetchSkipped.current = false
      return
    }

    fetchData()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  const refetch = useCallback(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch }
}

/**
 * メモ化されたフェッチオプションを作成
 */
export function useFetchOptions<T, R = unknown>(
  options: FetchOptions<T, R>
): FetchOptions<T, R> {
  return useMemo(() => options, [options.fallback, options.headers, options.transform])
}

/**
 * 認証付きフェッチフック
 */
export function useAuthFetch<T, R = unknown>(
  url: string | null,
  idToken: string | null,
  options?: FetchOptions<T, R>
): FetchState<T> {
  const headers = idToken ? { Authorization: `Bearer ${idToken}` } : undefined
  return useFetch<T, R>(url && idToken ? url : null, {
    ...options,
    headers,
  })
}
