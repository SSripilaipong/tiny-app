// Google OAuth configuration
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const REDIRECT_URI = window.location.origin + '/'

class GoogleAuth {
  constructor() {
    this.tokenKey = 'tiny_app_token'
    this.expiryKey = 'tiny_app_token_expiry'
  }

  /**
   * Start OAuth flow by redirecting to Google
   */
  signIn() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: SCOPES,
      include_granted_scopes: 'true'
    })

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  /**
   * Handle OAuth callback - parse token from URL fragment
   */
  handleCallback() {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)

    const accessToken = params.get('access_token')
    const expiresIn = params.get('expires_in')

    if (accessToken) {
      const expiry = Date.now() + (parseInt(expiresIn, 10) * 1000)
      sessionStorage.setItem(this.tokenKey, accessToken)
      sessionStorage.setItem(this.expiryKey, expiry.toString())

      // Clean up URL
      window.history.replaceState(null, '', window.location.pathname)
      return true
    }

    return false
  }

  /**
   * Get current access token if valid
   */
  getToken() {
    const token = sessionStorage.getItem(this.tokenKey)
    const expiry = sessionStorage.getItem(this.expiryKey)

    if (!token || !expiry) {
      return null
    }

    // Check if token is expired (with 5 min buffer)
    if (Date.now() > parseInt(expiry, 10) - 300000) {
      this.signOut()
      return null
    }

    return token
  }

  /**
   * Check if user is signed in with valid token
   */
  isSignedIn() {
    return this.getToken() !== null
  }

  /**
   * Sign out - clear stored token
   */
  signOut() {
    sessionStorage.removeItem(this.tokenKey)
    sessionStorage.removeItem(this.expiryKey)
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthChange(callback) {
    // Check auth state periodically (for token expiry)
    const check = () => {
      callback(this.isSignedIn())
    }

    // Initial check
    check()

    // Check every minute for token expiry
    const interval = setInterval(check, 60000)

    return () => clearInterval(interval)
  }
}

export const googleAuth = new GoogleAuth()
