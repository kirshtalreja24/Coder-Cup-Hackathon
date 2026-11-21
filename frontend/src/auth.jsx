import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { api, clearSession, getToken, getUser, setSession, login as apiLogin } from './api'
import { Spinner } from './ui'

export const AuthContext = createContext(null)

export const HOME = {
  citizen: '/c',
  helper: '/h',
  officer: '/s/queue',
  admin: '/s/rules',
  auditor: '/s/audit'
}

export const ROLE_ROUTES = {
  citizen: ['/c'],
  helper: ['/h'],
  officer: ['/s/queue', '/s/case', '/s/rules', '/s/risk', '/s/scam-map', '/s/analytics', '/s/about'],
  admin: ['/s/rules', '/s/risk', '/s/queue', '/s/case', '/s/analytics', '/s/scam-map', '/s/audit', '/s/admin', '/s/redteam', '/s/about'],
  auditor: ['/s/audit', '/s/case', '/s/analytics', '/s/risk', '/s/scam-map', '/s/redteam', '/s/about']
}

export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const payload = parseJwt(token)
  if (!payload || !payload.exp) return true
  // Check if expired with a 5 second clock skew buffer
  return payload.exp * 1000 <= Date.now() + 5000
}

export function isRouteAllowed(path, role) {
  if (!path || !role || !ROLE_ROUTES[role]) return false
  if (role === 'citizen') return path === '/c' || path.startsWith('/c/')
  if (role === 'helper') return path === '/h' || path.startsWith('/h/')
  if (['officer', 'admin', 'auditor'].includes(role)) {
    if (!path.startsWith('/s')) return false
    return ROLE_ROUTES[role].some((prefix) => path === prefix || path.startsWith(prefix + '/'))
  }
  return false
}

// Synchronous initial session check — instant zero-wait determination for logged out users
function getInitialSession() {
  const t = getToken()
  if (!t || isTokenExpired(t)) {
    if (t) clearSession()
    return { token: null, user: null, loading: false }
  }
  const cached = getUser()
  const payload = parseJwt(t)
  if (!cached || !payload || cached.role !== payload.role) {
    clearSession()
    return { token: null, user: null, loading: false }
  }
  // We have a structurally valid cached token and user.
  // We verify with the backend while keeping cached credentials ready.
  return { token: t, user: cached, loading: true }
}

export function AuthProvider({ children }) {
  const initial = getInitialSession()
  const [token, setTokenState] = useState(initial.token)
  const [user, setUserState] = useState(initial.user)
  const [loading, setLoading] = useState(initial.loading)
  const [authError, setAuthError] = useState(null)
  const [offlineDismissed, setOfflineDismissed] = useState(false)

  // Use an incrementing sequence number to prevent React 18 StrictMode double-mount race conditions
  const validationSeq = useRef(0)

  const validateSession = useCallback(async () => {
    const currentSeq = ++validationSeq.current
    const currentToken = getToken()

    if (!currentToken || isTokenExpired(currentToken)) {
      clearSession()
      if (currentSeq === validationSeq.current) {
        setTokenState(null)
        setUserState(null)
        setAuthError(null)
        setOfflineDismissed(false)
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setAuthError(null)

    try {
      // 5-second timeout for session verification so user never waits indefinitely
      const verifiedUser = await api('/auth/me', { timeout: 5000 })
      if (currentSeq === validationSeq.current) {
        setSession(currentToken, verifiedUser)
        setTokenState(currentToken)
        setUserState(verifiedUser)
        setAuthError(null)
        setOfflineDismissed(false)
        setLoading(false)
      }
    } catch (err) {
      if (currentSeq !== validationSeq.current) return

      if (err.status === 401) {
        // Token rejected by server (expired, revoked, bad signature)
        clearSession()
        setTokenState(null)
        setUserState(null)
        setAuthError(null)
        setOfflineDismissed(false)
        setLoading(false)
      } else {
        // Network offline, timeout, or server unavailable:
        // DO NOT erase potentially valid session!
        console.warn('Backend unavailable during session verification:', err)
        setAuthError({
          message: err.offline
            ? 'Cannot reach the Bharosa server. Check your connection or API server.'
            : (err.detail || 'The authentication server is temporarily unavailable.'),
          status: err.status || 0
        })
        setLoading(false)
      }
    }
  }, [])

  // Verify stored session on startup if a token exists
  useEffect(() => {
    if (initial.loading) {
      validateSession()
    }

    const handleUnauthorized = () => {
      clearSession()
      setTokenState(null)
      setUserState(null)
      setAuthError(null)
      setOfflineDismissed(false)
      setLoading(false)
    }

    window.addEventListener('bh_auth_unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('bh_auth_unauthorized', handleUnauthorized)
    }
  }, [validateSession, initial.loading])

  const loginUser = useCallback(async (email, password) => {
    const loggedUser = await apiLogin(email, password)
    const newToken = getToken()
    setTokenState(newToken)
    setUserState(loggedUser)
    setAuthError(null)
    setOfflineDismissed(false)
    setLoading(false)
    return loggedUser
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setTokenState(null)
    setUserState(null)
    setAuthError(null)
    setOfflineDismissed(false)
    setLoading(false)
  }, [])

  const dismissAuthError = useCallback(() => {
    setOfflineDismissed(true)
    setAuthError(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const refreshed = await api('/auth/me', { timeout: 5000 })
      const currentToken = getToken()
      if (currentToken) {
        setSession(currentToken, refreshed)
        setUserState(refreshed)
      }
      return refreshed
    } catch (e) {
      if (e.status === 401) {
        logout()
      }
      throw e
    }
  }, [logout])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        authError,
        offlineDismissed,
        loginUser,
        logout,
        validateSession,
        dismissAuthError,
        refreshUser,
        isAuthenticated: Boolean(user && token && !isTokenExpired(token))
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

export function AuthErrorScreen({ error, onRetry, onOffline, onLogout, hasUser }) {
  return (
    <div
      className="container center col"
      style={{
        minHeight: '65vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '32px 16px',
        maxWidth: 520,
        margin: '0 auto',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'rgba(196, 154, 86, 0.15)',
          border: '1px solid var(--champagne, #C49A56)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--terracotta, #c2593f)',
          fontSize: 26
        }}
      >
        ⚠️
      </div>

      <div className="col" style={{ gap: 8 }}>
        <h3 style={{ margin: 0, color: 'var(--forest-dark, #13302a)', fontSize: '1.25rem' }}>
          Backend Temporarily Unavailable
        </h3>
        <p className="subtle" style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
          {error?.message || 'Unable to connect to the Bharosa API server to verify your session. Your credentials have been safely preserved.'}
        </p>
      </div>

      <div className="row wrap" style={{ gap: 12, justifyContent: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={onRetry}
          style={{ minWidth: 140 }}
        >
          🔄 Retry Connection
        </button>
        {hasUser && (
          <button
            type="button"
            className="secondary"
            onClick={onOffline}
            style={{ minWidth: 130 }}
          >
            Continue Offline
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={onLogout}
          style={{ minWidth: 100 }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

export function ProtectedRoute({ roles, children }) {
  const { user, loading, authError, offlineDismissed, validateSession, dismissAuthError, logout, isAuthenticated } = useAuth()
  const loc = useLocation()

  // 1. Loading state: render full-screen spinner, NEVER flash protected content
  if (loading) {
    return (
      <div
        className="container center col"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16
        }}
      >
        <Spinner label="Verifying session security…" />
      </div>
    )
  }

  // 2. Backend unavailable error: show clear error with retry option without wiping session
  if (authError && !offlineDismissed) {
    return (
      <AuthErrorScreen
        error={authError}
        onRetry={validateSession}
        onOffline={user ? dismissAuthError : null}
        onLogout={logout}
        hasUser={Boolean(user)}
      />
    )
  }

  // 3. Unauthenticated: redirect to /login with state.from preserved
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: loc }} replace />
  }

  // 4. Role mismatch: redirect to user's authorized landing page
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME[user.role] || '/login'} replace />
  }

  // 5. Authenticated & authorized: render protected content
  return children
}
