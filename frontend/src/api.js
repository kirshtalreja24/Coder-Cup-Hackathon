// API client: token handling, timeouts, offline detection, tiny responses.
export const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export const getToken = () => localStorage.getItem('bh_token')
export const setSession = (token, user) => { localStorage.setItem('bh_token', token); localStorage.setItem('bh_user', JSON.stringify(user)) }
export const clearSession = () => { localStorage.removeItem('bh_token'); localStorage.removeItem('bh_user') }
export const getUser = () => { try { return JSON.parse(localStorage.getItem('bh_user') || 'null') } catch { return null } }

export class ApiError extends Error {
  constructor(status, detail) { super(typeof detail === 'string' ? detail : JSON.stringify(detail)); this.status = status; this.detail = detail }
}

export async function api(path, { method = 'GET', body, form, formData, headers = {}, timeout = 20000, auth = true } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const h = { ...headers }
  if (auth && getToken()) h.Authorization = 'Bearer ' + getToken()
  let payload
  if (form) { h['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString() }
  else if (formData) { payload = formData }
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  try {
    const res = await fetch(BASE + path, { method, headers: h, body: payload, signal: ctrl.signal })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!res.ok) {
      if (res.status === 401 && auth) { clearSession(); if (!location.pathname.startsWith('/login')) location.href = '/login' }
      throw new ApiError(res.status, data?.detail ?? data)
    }
    return data
  } catch (e) {
    if (e instanceof ApiError) throw e
    const err = new ApiError(0, 'offline'); err.offline = true; throw err
  } finally { clearTimeout(timer) }
}

export const apiGet = (p, o) => api(p, o)
export const apiPost = (p, body, o) => api(p, { method: 'POST', body, ...o })
export const apiPut = (p, body, o) => api(p, { method: 'PUT', body, ...o })
export const apiPatch = (p, body, o) => api(p, { method: 'PATCH', body, ...o })
export const apiDel = (p, o) => api(p, { method: 'DELETE', ...o })

export async function login(email, password) {
  const r = await api('/auth/login', { method: 'POST', form: { username: email, password }, auth: false })
  setSession(r.access_token, r.user)
  return r.user
}

export const money = (n) => (n == null ? '-' : 'PKR ' + Number(n).toLocaleString('en-US'))
export const when = (s) => (s ? new Date(s).toLocaleString() : '')
export const pct = (x, d = 0) => (x == null ? '-' : (x * 100).toFixed(d) + '%')
