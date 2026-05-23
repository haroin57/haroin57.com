export function useAdminAuth() {
  return {
    isAdmin: false,
    user: null,
    idToken: null,
    isLoading: false,
    isRedirecting: false,
    sessionExpiresAt: null,
    loginWithGoogle: async () => false,
    logout: async () => {},
    registerBeforeLogout: () => () => {},
  }
}
