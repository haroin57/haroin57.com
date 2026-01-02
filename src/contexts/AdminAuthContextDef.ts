import { createContext } from 'react'
import type { User } from 'firebase/auth'

// ログアウト前に呼び出されるコールバック（下書き保存用）
export type BeforeLogoutCallback = () => void | Promise<void>

export type AdminAuthContextType = {
  isAdmin: boolean
  user: User | null
  idToken: string | null
  isLoading: boolean
  isRedirecting: boolean
  sessionExpiresAt: number | null
  loginWithGoogle: () => Promise<boolean>
  logout: () => Promise<void>
  registerBeforeLogout: (callback: BeforeLogoutCallback) => () => void
}

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null)
