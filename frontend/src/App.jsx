import PrototypeBanner from './components/PrototypeBanner'
import StaffOfflineBanner from './components/StaffOfflineBanner'
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
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

function Shell({ children }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const { t, rtl } = useLang()
  const online = useOnline()
  const [box, setBox] = useState(loadBox())
  useEffect(() => onBox(setBox), [])
  const pend = box.filter((x) => x.state !== 'done').length
  const staff = ['officer', 'admin', 'auditor'].includes(user?.role)
  const tabs = {
    citizen: [['/c', t('hello')], ['/c/claim', t('claim')], ['/c/cases', t('mycases')], ['/c/data', t('mydata')], ['/c/scam', t('scam')], ['/c/ask', t('ask')]],
    helper: [['/h', 'Families'], ['/h/scam', t('scam')], ['/h/ask', t('ask')]],
    officer: [['/s/queue', 'Review queue'], ['/s/scam-map', 'Scam map'], ['/s/risk', 'Risk dial'], ['/s/rules', 'Rules & Twin'], ['/s/analytics', 'Analytics'], ['/s/about', 'About']],
    admin: [['/s/rules', 'Rules & Twin'], ['/s/risk', 'Risk dial'], ['/s/queue', 'Queue'], ['/s/analytics', 'Analytics'], ['/s/scam-map', 'Scam map'], ['/s/audit', 'Audit'], ['/s/admin', 'Admin'], ['/s/redteam', 'Red-Team'], ['/s/about', 'About']],
    auditor: [['/s/audit', 'Audit'], ['/s/analytics', 'Evaluation'], ['/s/risk', 'Risk dial'], ['/s/scam-map', 'Scam map'], ['/s/redteam', 'Red-Team'], ['/s/about', 'About']],
  }[user?.role] || []

  return (
    <div className={!staff && rtl ? 'rtl' : ''}>
      <PrototypeBanner />
      <header className={"topbar" + (staff ? "" : " simple")}>
        <div className="container">
          <Link to={HOME[user?.role] || '/login'} className="brand">🛡️ {t('app')}</Link>
          <nav className="tabs">{tabs.map(([to, l]) => <NavLink key={to} to={to} end={to === '/c' || to === '/h'}>{l}</NavLink>)}</nav>
          <span className="badge" style={{ background: online ? '#c9efe0' : '#ffd98a', color: '#13302a' }}>{online ? '● ' + t('online') : '○ ' + t('offline')}{pend ? ` · ${pend} ⏳` : ''}</span>
          <LangSwitch />
          <button className="small" onClick={() => { logout(); nav('/login', { replace: true }) }}>{user?.name ? user.name.split(' ')[0] : 'User'} · {t('logout')}</button>
        </div>
      </header>
      {staff ? (
        <StaffOfflineBanner online={online} pend={pend} onOpenSyncCenter={() => {}} />
      ) : (
        !online && <div className="container"><div className="banner offline">📴 {t('saved_offline')}</div></div>
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
