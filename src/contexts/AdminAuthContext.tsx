import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

type AdminAuthContextType = {
  isAdmin: boolean
  user: User | null
  idToken: string | null
  isLoading: boolean
  loginWithGoogle: () => Promise<boolean>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

// 管理者メールアドレスのリスト（環境変数から取得）
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase())

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 管理者かどうかを判定
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))

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

      return true
    } catch (error) {
      console.error('Google login failed:', error)
      return false
    }
  }, [])

  // ログアウト
  const logout = useCallback(async () => {
    try {
      await signOut(auth)
      setUser(null)
      setIdToken(null)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [])

  return (
    <AdminAuthContext.Provider value={{ isAdmin, user, idToken, isLoading, loginWithGoogle, logout }}>
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
