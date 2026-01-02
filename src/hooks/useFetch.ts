import { useEffect, useState, useRef, useCallback } from 'react'

export type FetchState<T> = {
  data: T | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * 汎用データフェッチフック
 * @param url フェッチするURL (nullの場合はフェッチしない)
 * @param options フェッチオプション
 */
export function useFetch<T>(
  url: string | null,
  options?: {
    headers?: Record<string, string>
    initialData?: T | null
    transform?: (data: unknown) => T
  }
): FetchState<T> {
  const [data, setData] = useState<T | null>(options?.initialData ?? null)
  const [isLoading, setIsLoading] = useState(url !== null)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

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
        headers: options?.headers,
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = await res.json()
      const transformed = options?.transform ? options.transform(json) : (json as T)
      setData(transformed)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // キャンセルされた場合は無視
      }
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [url, options?.headers, options?.transform])

  useEffect(() => {
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
 * 認証付きフェッチフック
 */
export function useAuthFetch<T>(
  url: string | null,
  idToken: string | null,
  options?: {
    initialData?: T | null
    transform?: (data: unknown) => T
  }
): FetchState<T> {
  const headers = idToken ? { Authorization: `Bearer ${idToken}` } : undefined
  return useFetch<T>(url && idToken ? url : null, {
    ...options,
    headers,
  })
}
