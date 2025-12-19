import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

// セッションタイムアウト（1時間）
const SESSION_TIMEOUT_MS = 60 * 60 * 1000

// ログアウト前に呼び出されるコールバック（下書き保存用）
type BeforeLogoutCallback = () => void | Promise<void>

type AdminAuthContextType = {
  isAdmin: boolean
  user: User | null
  idToken: string | null
  isLoading: boolean
  sessionExpiresAt: number | null
  loginWithGoogle: () => Promise<boolean>
  logout: () => Promise<void>
  registerBeforeLogout: (callback: BeforeLogoutCallback) => () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

// 管理者メールアドレスのリスト（環境変数から取得）
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase())

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const beforeLogoutCallbacksRef = useRef<Set<BeforeLogoutCallback>>(new Set())

  // 管理者かどうかを判定
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))

  // ログアウト前コールバックを登録
  const registerBeforeLogout = useCallback((callback: BeforeLogoutCallback) => {
    beforeLogoutCallbacksRef.current.add(callback)
    return () => {
      beforeLogoutCallbacksRef.current.delete(callback)
    }
  }, [])

  // Firebase認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // IDトークンを取得
        const token = await firebaseUser.getIdToken()
        setIdToken(token)
      } else {
        setIdToken(null)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // IDトークンの自動更新（1時間ごと）
  useEffect(() => {
    if (!user) return

    const refreshToken = async () => {
      try {
        const token = await user.getIdToken(true) // 強制リフレッシュ
        setIdToken(token)
      } catch (error) {
        console.error('Failed to refresh token:', error)
      }
    }

    // 50分ごとにトークンをリフレッシュ（有効期限は1時間）
    const interval = setInterval(refreshToken, 50 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // ログアウト（下書き保存コールバックを先に実行）
  const logout = useCallback(async (skipCallbacks = false) => {
    try {
      // 登録されたコールバックを実行（下書き保存など）
      if (!skipCallbacks) {
        const callbacks = Array.from(beforeLogoutCallbacksRef.current)
        for (const callback of callbacks) {
          try {
            await callback()
          } catch (err) {
            console.error('Before logout callback failed:', err)
          }
        }
      }

      // セッションタイマーをクリア
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
        sessionTimeoutRef.current = null
      }
      setSessionExpiresAt(null)

      await signOut(auth)
      setUser(null)
      setIdToken(null)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [])

  // セッションタイムアウトの設定
  const startSessionTimeout = useCallback(() => {
    // 既存のタイマーをクリア
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
    }

    const expiresAt = Date.now() + SESSION_TIMEOUT_MS
    setSessionExpiresAt(expiresAt)

    sessionTimeoutRef.current = setTimeout(async () => {
      console.log('Session timeout - auto logout')
      await logout()
      alert('セッションが期限切れになりました。再度ログインしてください。')
    }, SESSION_TIMEOUT_MS)
  }, [logout])

  // Googleでログイン
  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      // 管理者メールかチェック
      if (!firebaseUser.email || !ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) {
        // 管理者ではない場合はサインアウト
        await signOut(auth)
        return false
      }

      // セッションタイムアウトを開始
      startSessionTimeout()

      return true
    } catch (error) {
      console.error('Google login failed:', error)
      return false
    }
  }, [startSessionTimeout])

  // ページリロード時もセッションを維持（ただしリロード時から1時間）
  useEffect(() => {
    if (user && isAdmin && !sessionExpiresAt) {
      startSessionTimeout()
    }
  }, [user, isAdmin, sessionExpiresAt, startSessionTimeout])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
      }
    }
  }, [])

  return (
    <AdminAuthContext.Provider value={{ isAdmin, user, idToken, isLoading, sessionExpiresAt, loginWithGoogle, logout, registerBeforeLogout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return context
}
