import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { User, Auth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirebase } from '../lib/firebase'
import { AdminAuthContext, type BeforeLogoutCallback } from './AdminAuthContextDef'

// セッションタイムアウト（1時間）
const SESSION_TIMEOUT_MS = 60 * 60 * 1000

// 管理者メールアドレスのリスト（環境変数から取得）
// 管理者メールアドレスのリスト（環境変数から取得）
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase())

// Firebase認証インスタンスのキャッシュ
let cachedAuth: Auth | null = null
let cachedGoogleProvider: GoogleAuthProvider | null = null

// signInWithRedirect を開始したことを示すフラグ（戻り先で getRedirectResult を確実に走らせる）
const REDIRECT_PENDING_KEY = 'adminAuth:redirectPending'

const DEBUG_ADMIN_AUTH = import.meta.env.DEV

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [, setFirebaseReady] = useState(false)
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

      if (cachedAuth) {
        const { signOut } = await import('firebase/auth')
        await signOut(cachedAuth)
      }
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
      if (DEBUG_ADMIN_AUTH) console.log('Session timeout - auto logout')
      await logout()
      alert('セッションが期限切れになりました。再度ログインしてください。')
    }, SESSION_TIMEOUT_MS)
  }, [logout])

  // startSessionTimeoutをrefで保持（useEffect内で使用するため）
  const startSessionTimeoutRef = useRef(startSessionTimeout)
  startSessionTimeoutRef.current = startSessionTimeout

  // Firebase遅延初期化（管理者ページアクセス時のみ、または既存セッション復元時）
  useEffect(() => {
    // useEffect内でwindowを直接参照（SSR対策）
    const isAdminPage = window.location.pathname.startsWith('/admin')

    // 管理者ページでない場合は初期化をスキップ（ただしlocalStorageにセッションがある場合は初期化）
    const hasStoredSession = localStorage.getItem('firebase:authUser:' + import.meta.env.VITE_FIREBASE_API_KEY + ':[DEFAULT]')
    const hasPendingRedirect = sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1'

    // デバッグログ
    if (DEBUG_ADMIN_AUTH) {
      console.log('[AdminAuth] Init check:', {
        isAdminPage,
        hasStoredSession: !!hasStoredSession,
        hasPendingRedirect,
        pathname: window.location.pathname,
      })
    }

    if (!isAdminPage && !hasStoredSession && !hasPendingRedirect) {
      if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] Skipping Firebase init - not admin page and no session/redirect')
      setIsLoading(false)
      return
    }

    let unsubscribe: (() => void) | null = null

    const init = async () => {
      try {
        const { auth, googleProvider } = await initializeFirebase()
        cachedAuth = auth
        cachedGoogleProvider = googleProvider
        setFirebaseReady(true)

        // リダイレクト認証の結果を取得
        const { getRedirectResult, signOut, onAuthStateChanged } = await import('firebase/auth')
        if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] Checking redirect result...')
        try {
          const result = await getRedirectResult(auth)
          if (DEBUG_ADMIN_AUTH) {
            console.log('[AdminAuth] Redirect result:', {
              hasUser: !!result?.user,
              email: result?.user?.email,
            })
          }
          if (result?.user) {
            // 管理者メールかチェック
            if (DEBUG_ADMIN_AUTH) {
              console.log('[AdminAuth] Checking admin email:', {
                userEmail: result.user.email?.toLowerCase(),
                adminEmails: ADMIN_EMAILS,
              })
            }
            if (!result.user.email || !ADMIN_EMAILS.includes(result.user.email.toLowerCase())) {
              // 管理者ではない場合はサインアウト
              if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] Not admin - signing out')
              await signOut(auth)
              alert('このアカウントには管理者権限がありません。')
            } else {
              if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] Admin verified - starting session')
              // セッションタイムアウトを開始
              startSessionTimeoutRef.current()
            }
          }
        } catch (redirectError) {
          console.error('[AdminAuth] Redirect result error:', redirectError)
        } finally {
          sessionStorage.removeItem(REDIRECT_PENDING_KEY)
        }

        // Firebase認証状態の監視
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (DEBUG_ADMIN_AUTH) {
            console.log('[AdminAuth] Auth state changed:', {
              hasUser: !!firebaseUser,
              email: firebaseUser?.email,
            })
          }
          setUser(firebaseUser)
          if (firebaseUser) {
            const token = await firebaseUser.getIdToken()
            setIdToken(token)
            if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] ID token obtained')
          } else {
            setIdToken(null)
            if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] No user - cleared token')
          }
          setIsLoading(false)
        })
      } catch (error) {
        console.error('Firebase initialization failed:', error)
        setIsLoading(false)
      }
    }

    init()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  
  }, []) // 初回マウント時のみ実行

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

  // Googleでログイン（ポップアップ方式）
  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      // Firebaseがまだ初期化されていない場合は初期化
      if (!cachedAuth || !cachedGoogleProvider) {
        const { auth, googleProvider } = await initializeFirebase()
        cachedAuth = auth
        cachedGoogleProvider = googleProvider
        setFirebaseReady(true)
      }

      const { signInWithPopup, signOut } = await import('firebase/auth')
      setIsRedirecting(true)

      const result = await signInWithPopup(cachedAuth, cachedGoogleProvider)
      if (DEBUG_ADMIN_AUTH) {
        console.log('[AdminAuth] Popup login result:', {
          hasUser: !!result?.user,
          email: result?.user?.email,
        })
      }

      if (result?.user) {
        // 管理者メールかチェック
        if (!result.user.email || !ADMIN_EMAILS.includes(result.user.email.toLowerCase())) {
          if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] Not admin - signing out')
          await signOut(cachedAuth)
          alert('このアカウントには管理者権限がありません。')
          setIsRedirecting(false)
          return false
        }
        if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] Admin verified via popup')

        // ポップアップ認証成功後、直接stateを更新（onAuthStateChangedが未設定の場合に対応）
        setUser(result.user)
        const token = await result.user.getIdToken()
        setIdToken(token)
        if (DEBUG_ADMIN_AUTH) console.log('[AdminAuth] User and token set directly after popup')

        startSessionTimeout()
      }

      setIsRedirecting(false)
      return true
    } catch (error) {
      console.error('[AdminAuth] Google login failed:', error)
      setIsRedirecting(false)
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
    <AdminAuthContext.Provider value={{ isAdmin, user, idToken, isLoading, isRedirecting, sessionExpiresAt, loginWithGoogle, logout, registerBeforeLogout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

// useAdminAuth hook is exported from src/hooks/useAdminAuth.ts
