import PrototypeBanner from './components/PrototypeBanner'
import StaffOfflineBanner from './components/StaffOfflineBanner'
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api } from './api'
import { Shield, WifiOff } from 'lucide-react'
import { useAuth, ProtectedRoute, HOME, AuthErrorScreen } from './auth'
import { LangSwitch, useLang } from './i18n'
import { loadBox, onBox } from './offline'
import { Spinner } from './ui'
import Login from './pages/Login'
import { ScamPage, AskPage } from './pages/Tools'
import CitizenHome from './pages/CitizenHome'
import ClaimFlow from './pages/ClaimFlow'
import { MyCases, CaseView } from './pages/MyCases'
import MyData from './pages/MyData'
import HelperHome from './pages/HelperHome'
import Queue from './pages/Queue'
import StaffCase from './pages/StaffCase'
import Rules from './pages/Rules'
import RiskDial from './pages/RiskDial'
import ScamMap from './pages/ScamMap'
import Audit from './pages/Audit'
import Analytics from './pages/Analytics'
import Admin from './pages/Admin'
import RedTeam from './pages/RedTeam'
import About from './pages/About'
import Inbox from './pages/Inbox'
import Verify from './pages/Verify'

function useOnline() {
  const [on, set] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => set(true)
    const b = () => set(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', b)
    return () => {
      window.removeEventListener('online', a)
      window.removeEventListener('offline', b)
    }
  }, [])
  return on
}

function useUnread() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    const load = () => navigator.onLine && api('/notifications?unread_only=true&limit=1').then((d) => alive && setN(d.unread)).catch(() => {})
    load(); const id = setInterval(load, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return n
}

function Shell({ children }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const { t, rtl, localize } = useLang()
  const online = useOnline()
  const unread = useUnread()
  const [box, setBox] = useState(loadBox())
  useEffect(() => onBox(setBox), [])
  const pend = box.filter((x) => x.state !== 'done').length
  const staff = ['officer', 'admin', 'auditor'].includes(user?.role)
  const tabs = {
    citizen: [['/c', t('hello')], ['/c/claim', t('claim')], ['/c/cases', t('mycases')], ['/c/data', t('mydata')], ['/c/scam', t('scam')], ['/c/ask', t('ask')]],
    helper: [['/h', t('tab_families')], ['/h/scam', t('scam')], ['/h/ask', t('ask')]],
    officer: [['/s/queue', t('tab_queue')], ['/s/scam-map', t('tab_scam_map')], ['/s/risk', t('tab_risk')], ['/s/rules', t('tab_rules')], ['/s/analytics', t('tab_analytics')], ['/s/about', t('tab_about')]],
    admin: [['/s/rules', t('tab_rules')], ['/s/risk', t('tab_risk')], ['/s/queue', t('tab_queue')], ['/s/analytics', t('tab_analytics')], ['/s/scam-map', t('tab_scam_map')], ['/s/audit', t('tab_audit')], ['/s/admin', t('tab_admin')], ['/s/redteam', t('tab_redteam')], ['/s/about', t('tab_about')]],
    auditor: [['/s/audit', t('tab_audit')], ['/s/analytics', t('tab_evaluation')], ['/s/risk', t('tab_risk')], ['/s/scam-map', t('tab_scam_map')], ['/s/redteam', t('tab_redteam')], ['/s/about', t('tab_about')]],
  }[user?.role] || []

  return (
    <div className={rtl ? 'rtl' : ''}>
      <PrototypeBanner />
      <header className={"topbar" + (staff ? "" : " simple")}>
        <div className="container">
          <Link to={HOME[user?.role] || '/login'} className="brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} strokeWidth={2.2} style={{ color: 'var(--champagne)' }} />
            <span>{t('app')}</span>
          </Link>
          <nav className="tabs">{tabs.map(([to, l]) => <NavLink key={to} to={to} end={to === '/c' || to === '/h'}>{l}</NavLink>)}</nav>
          <span className="badge" style={{ background: online ? 'var(--forest-soft)' : '#FDF0D9', color: online ? 'var(--forest-dark)' : '#874635', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? 'var(--evergreen)' : '#A65D49', display: 'inline-block' }} />
            <span>{online ? t('online') : t('offline')}</span>
            {pend > 0 ? <span style={{ opacity: 0.85 }}>({pend} {localize('باقی', 'baqi', 'pending')})</span> : null}
          </span>
          <Link to="/inbox" className="badge" style={{ textDecoration: 'none', background: unread ? '#ffd98a' : 'rgba(255,255,255,.2)', color: unread ? '#2b1b00' : '#fff' }} title="Inbox">🔔{unread ? ' ' + unread : ''}</Link>
          <LangSwitch />
          <button className="small" onClick={() => { logout(); nav('/login', { replace: true }) }}>{user?.name ? user.name.split(' ')[0] : t('user')} · {t('logout')}</button>
        </div>
      </header>
      {staff ? (
        <StaffOfflineBanner online={online} pend={pend} onOpenSyncCenter={() => {}} />
      ) : (
        !online && (
          <div className="container">
            <div className="banner offline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WifiOff size={16} />
              <span>{t('saved_offline')}</span>
            </div>
          </div>
        )
      )}
      <main className="container">{children}</main>
    </div>
  )
}

function Guard({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  )
}

function RootRedirect() {
  const { user, loading, authError, offlineDismissed, validateSession, dismissAuthError, logout } = useAuth()
  if (loading) {
    return (
      <div className="container center col" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner label="Verifying session security…" />
      </div>
    )
  }
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
  return <Navigate to={user ? (HOME[user.role] || '/login') : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      {/* Explicitly public pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/inbox" element={<Guard><Inbox /></Guard>} />
      <Route path="/public/scam" element={<div className="container narrow"><ScamPage pub /></div>} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Citizen protected routes */}
      <Route path="/c" element={<Guard roles={['citizen']}><CitizenHome /></Guard>} />
      <Route path="/c/claim" element={<Guard roles={['citizen']}><ClaimFlow /></Guard>} />
      <Route path="/c/cases" element={<Guard roles={['citizen']}><MyCases /></Guard>} />
      <Route path="/c/cases/:id" element={<Guard roles={['citizen']}><CaseView /></Guard>} />
      <Route path="/c/data" element={<Guard roles={['citizen']}><MyData /></Guard>} />
      <Route path="/c/scam" element={<Guard roles={['citizen']}><ScamPage /></Guard>} />
      <Route path="/c/ask" element={<Guard roles={['citizen']}><AskPage /></Guard>} />

      {/* Helper protected routes */}
      <Route path="/h" element={<Guard roles={['helper']}><HelperHome /></Guard>} />
      <Route path="/h/claim" element={<Guard roles={['helper']}><ClaimFlow helper /></Guard>} />
      <Route path="/h/cases/:id" element={<Guard roles={['helper']}><CaseView helper /></Guard>} />
      <Route path="/h/scam" element={<Guard roles={['helper']}><ScamPage /></Guard>} />
      <Route path="/h/ask" element={<Guard roles={['helper']}><AskPage /></Guard>} />

      {/* Staff protected routes with explicit role permissions */}
      <Route path="/s/queue" element={<Guard roles={['officer', 'admin']}><Queue /></Guard>} />
      <Route path="/s/case/:id" element={<Guard roles={['officer', 'admin', 'auditor']}><StaffCase /></Guard>} />
      <Route path="/s/rules" element={<Guard roles={['admin', 'officer', 'auditor']}><Rules /></Guard>} />
      <Route path="/s/risk" element={<Guard roles={['admin', 'officer', 'auditor']}><RiskDial /></Guard>} />
      <Route path="/s/scam-map" element={<Guard roles={['admin', 'officer', 'auditor']}><ScamMap /></Guard>} />
      <Route path="/s/audit" element={<Guard roles={['auditor', 'admin']}><Audit /></Guard>} />
      <Route path="/s/analytics" element={<Guard roles={['admin', 'officer', 'auditor']}><Analytics /></Guard>} />
      <Route path="/s/admin" element={<Guard roles={['admin']}><Admin /></Guard>} />
      <Route path="/s/redteam" element={<Guard roles={['admin', 'auditor']}><RedTeam /></Guard>} />
      <Route path="/s/about" element={<Guard roles={['admin', 'officer', 'auditor']}><About /></Guard>} />

      {/* Catch-all unknown routes redirect to root redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
