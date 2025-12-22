import type { Auth, GoogleAuthProvider as GoogleAuthProviderType } from 'firebase/auth'

// Firebase設定（環境変数から取得）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Firebase遅延初期化（管理者ページアクセス時のみ）
let authInstance: Auth | null = null
let googleProviderInstance: GoogleAuthProviderType | null = null
let initPromise: Promise<{ auth: Auth; googleProvider: GoogleAuthProviderType }> | null = null

export async function initializeFirebase(): Promise<{ auth: Auth; googleProvider: GoogleAuthProviderType }> {
  if (authInstance && googleProviderInstance) {
    return { auth: authInstance, googleProvider: googleProviderInstance }
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const [{ initializeApp }, { getAuth, GoogleAuthProvider }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ])

    const app = initializeApp(firebaseConfig)
    authInstance = getAuth(app)
    googleProviderInstance = new GoogleAuthProvider()

    // Googleログイン時に追加のスコープを要求
    googleProviderInstance.addScope('email')
    googleProviderInstance.addScope('profile')

    return { auth: authInstance, googleProvider: googleProviderInstance }
  })()

  return initPromise
}

// 後方互換性のためのゲッター（遅延初期化後にのみ使用可能）
export function getAuthInstance(): Auth {
  if (!authInstance) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.')
  }
  return authInstance
}

export function getGoogleProviderInstance(): GoogleAuthProviderType {
  if (!googleProviderInstance) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.')
  }
  return googleProviderInstance
}
