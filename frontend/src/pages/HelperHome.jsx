import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Lock,
  Unlock,
  Search,
  ShieldCheck,
  AlertTriangle,
  Phone,
  Key,
  Clock,
  Plus,
  FileText,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Wifi,
  WifiOff,
  UserCheck,
  Eye,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HardDrive
} from 'lucide-react'
import { apiGet, apiPost, when } from '../api'
import { playPrompt } from '../voice'
import { ErrorBox, Spinner, StatusBadge, Tabs, useAsync, MockTag } from '../ui'
import { loadBox, isEffectiveOnline, flush, onBox } from '../offline'
import MyData from './MyData'
import OfflineSyncCenter from '../components/OfflineSyncCenter'

const LOCK_S = 60

// Visual color palette generator for family avatar identifiers
const AVATAR_COLORS = [
  { bg: 'rgba(23, 61, 50, 0.15)', text: '#173D32', border: 'rgba(23, 61, 50, 0.3)' },
  { bg: 'rgba(196, 154, 86, 0.2)', text: '#92400E', border: 'rgba(196, 154, 86, 0.4)' },
  { bg: 'rgba(37, 99, 235, 0.15)', text: '#1D4ED8', border: 'rgba(37, 99, 235, 0.3)' },
  { bg: 'rgba(13, 148, 136, 0.15)', text: '#0F766E', border: 'rgba(13, 148, 136, 0.3)' },
  { bg: 'rgba(168, 85, 247, 0.15)', text: '#7E22CE', border: 'rgba(168, 85, 247, 0.3)' }
]

function getAvatarStyle(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const idx = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function getInitials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return 'F'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function HelperHome() {
  const nav = useNavigate()
  const fam = useAsync(() => apiGet('/helper/families'), [])
  const [active, setActive] = useState(() => JSON.parse(sessionStorage.getItem('bh_family') || 'null'))
  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'consented' | 'pending'
  const [tab, setTab] = useState('cases')
  const [err, setErr] = useState(null)
  const [mock, setMock] = useState(null)
  const [code, setCode] = useState('')
  const [info, setInfo] = useState('')
  const [left, setLeft] = useState(LOCK_S)
  const [locked, setLocked] = useState(false)
  const [auditNotice, setAuditNotice] = useState('')
  const [showSyncCenter, setShowSyncCenter] = useState(false)
  const [box, setBox] = useState(loadBox())
  const [online, setOnline] = useState(isEffectiveOnline())

  const cases = useAsync(
    () => (active ? apiGet('/cases?limit=100').then((l) => l.filter((c) => c.citizen_id === active.id)) : []),
    [active?.id]
  )
  const last = useRef(Date.now())

  // Keep local outbox in sync for offline detection
  useEffect(() => {
    const unsub = onBox((newBox) => setBox(newBox))
    const handleConn = () => setOnline(isEffectiveOnline())
    window.addEventListener('online', handleConn)
    window.addEventListener('offline', handleConn)
    return () => {
      unsub()
      window.removeEventListener('online', handleConn)
      window.removeEventListener('offline', handleConn)
    }
  }, [])

  // Auto-lock countdown for shared community phone safety (60s)
  useEffect(() => {
    const bump = () => {
      last.current = Date.now()
      setLeft(LOCK_S)
    }
    const events = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll']
    events.forEach((e) => window.addEventListener(e, bump))

    const id = setInterval(() => {
      if (!active) return
      const s = LOCK_S - Math.floor((Date.now() - last.current) / 1000)
      setLeft(Math.max(0, s))
      if (s <= 0) {
        setLocked(true)
        sessionStorage.removeItem('bh_family')
        setActive(null)
        playPrompt('lock_warning', 'For privacy, the screen is locked.', 'en')
      }
    }, 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(id)
    }
  }, [active])

  // Family Switching: Calls /helper/switch/:id, which logs an audited event and seals prior family
  const sw = async (f) => {
    setErr(null)
    setMock(null)
    setInfo('')
    try {
      const r = await apiPost('/helper/switch/' + f.citizen_id)
      const a = { id: f.citizen_id, name: f.name, consent: r.consent_active }
      sessionStorage.setItem('bh_family', JSON.stringify(a))
      setActive(a)
      setLocked(false)
      setTab('cases')
      last.current = Date.now()
      setLeft(LOCK_S)
      setAuditNotice(`Session switch to "${f.name}" recorded in tamper-evident audit log (Action: helper.switch). Previous family data purged from session memory.`)
      playPrompt('helper_switch', 'Switched to another family. The previous family is now locked.', 'en')
    } catch (e) {
      setErr(e)
    }
  }

  // Explicit Lock / Exit
  const lock = () => {
    sessionStorage.removeItem('bh_family')
    setActive(null)
    setAuditNotice('')
    setMock(null)
    setCode('')
  }

  // Request SMS OTP code
  const reqCode = async () => {
    setErr(null)
    try {
      const res = await apiPost(`/helper/families/${active.id}/consent/request`)
      setMock(res)
    } catch (e) {
      setErr(e)
    }
  }

  // Confirm OTP code and grant isolated consent
  const confirm = async () => {
    setErr(null)
    try {
      await apiPost(`/helper/families/${active.id}/consent/confirm`, { code })
      const a = { ...active, consent: true }
      sessionStorage.setItem('bh_family', JSON.stringify(a))
      setActive(a)
      setInfo(`✔ Verified OTP consent successfully recorded for ${active.name}. Helper authorized.`)
      setMock(null)
      setCode('')
      fam.reload()
    } catch (e) {
      setErr(e)
    }
  }

  const familiesList = fam.data?.families || []
  const filteredList = familiesList
    .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
    .filter((f) => {
      if (filterType === 'consented') return f.helper_consent_active
      if (filterType === 'pending') return !f.helper_consent_active
      return true
    })

  const consentedCount = familiesList.filter((f) => f.helper_consent_active).length
  const pendingCount = familiesList.length - consentedCount
  const activeFamilyOfflineClaims = box.filter((x) => x.citizen_id === active?.id && x.state !== 'done')

  return (
    <div className="col narrow" style={{ gap: 20 }}>
      {/* Offline Sync Center Modal */}
      <OfflineSyncCenter isOpen={showSyncCenter} onClose={() => setShowSyncCenter(false)} />

      {/* Auto-Lock Privacy Overlay Modal */}
      {locked && (
        <div className="lock" style={{ zIndex: 9999 }}>
          <div
            className="lock-card"
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-xl, 18px)',
              padding: '36px 28px',
              maxWidth: '460px',
              border: '2px solid rgba(196, 154, 86, 0.4)',
              boxShadow: '0 24px 60px rgba(13, 35, 24, 0.35)'
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(196, 154, 86, 0.15)',
                color: 'var(--gold-dark, #92400E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <Lock size={36} />
            </div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--forest-dark, #0D2318)', fontSize: '1.4rem' }}>
              Locked for Family Privacy
            </h2>
            <p className="muted small" style={{ margin: '0 0 24px', lineHeight: 1.5 }}>
              No screen activity was detected for 60 seconds on this shared community device. The previous family's personal records were automatically sealed to safeguard their confidentiality.
            </p>
            <button
              className="btn"
              onClick={() => setLocked(false)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0D2318 0%, #173D32 100%)',
                color: '#FFF'
              }}
            >
              <Users size={16} style={{ marginRight: 8 }} />
              Select a Family to Resume
            </button>
          </div>
        </div>
      )}

      {/* Main Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0D2318 0%, #173D32 60%, #1A4035 100%)',
          borderRadius: 'var(--radius-xl, 18px)',
          padding: '24px 28px',
          color: '#FDFBF7',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 6px 24px rgba(13, 35, 24, 0.25), inset 0 1px 0 rgba(196, 154, 86, 0.2)'
        }}
      >
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.62rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  background: 'rgba(196, 154, 86, 0.2)',
                  color: 'var(--gold, #C49A56)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(196, 154, 86, 0.3)'
                }}
              >
                TRUSTED HELPER PORTAL · ایک فون، متعدد خاندان
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#FDFBF7', fontWeight: 800 }}>
              Community Helper Mode
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'rgba(253, 251, 247, 0.72)', maxWidth: '520px', lineHeight: 1.5 }}>
              Assisting multiple community families from one trusted phone. Each family holds its own isolated consent, and sessions lock automatically for privacy.
            </p>
          </div>

          {/* Right Status Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Offline / Online Sync Trigger */}
              <button
                type="button"
                className="ghost small"
                onClick={() => setShowSyncCenter(true)}
                style={{
                  background: online ? 'rgba(74, 222, 128, 0.15)' : 'rgba(252, 211, 77, 0.2)',
                  border: `1px solid ${online ? 'rgba(74, 222, 128, 0.4)' : 'rgba(252, 211, 77, 0.5)'}`,
                  color: online ? '#86EFAC' : '#FDE68A',
                  borderRadius: 999,
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.74rem',
                  fontWeight: 600
                }}
                title="View local device storage and offline synchronization status"
              >
                {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                <span>{online ? 'Online' : 'Offline Staged'}</span>
                {box.length > 0 && <span className="mono bold">({box.length})</span>}
              </button>
            </div>

            {/* Auto-Lock Indicator when active */}
            {active && (
              <div
                style={{
                  background: left <= 15 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(196, 154, 86, 0.2)',
                  border: `1.5px solid ${left <= 15 ? '#EF4444' : 'rgba(196, 154, 86, 0.5)'}`,
                  color: left <= 15 ? '#FCA5A5' : 'var(--gold, #C49A56)',
                  borderRadius: 999,
                  padding: '4px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  fontWeight: 700
                }}
              >
                <Clock size={13} style={{ animation: left <= 15 ? 'spin 1.5s linear infinite' : 'none' }} />
                <span>Auto-lock in {left}s</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ErrorBox e={err} />

      {/* Audit Confirmation Banner for Family Switch */}
      {auditNotice && (
        <div
          style={{
            background: 'rgba(23, 61, 50, 0.08)',
            border: '1.5px solid var(--forest, #173D32)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--forest, #173D32)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.8rem', color: 'var(--forest-dark, #0D2318)', lineHeight: 1.4 }}>
            <strong>Audit Trail Confirmed:</strong> {auditNotice}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ACTIVE FAMILY SESSION VIEW
      ─────────────────────────────────────────────────────────── */}
      {active ? (
        <div className="card col" style={{ gap: 18, border: '1.5px solid var(--forest, #173D32)' }}>
          {/* Active Family Session Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0D2318 0%, #173D32 100%)',
              borderRadius: 'var(--radius, 12px)',
              padding: '16px 20px',
              color: '#FDFBF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: 'rgba(196, 154, 86, 0.25)',
                  border: '1.5px solid rgba(196, 154, 86, 0.5)',
                  color: 'var(--gold, #C49A56)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {getInitials(active.name)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.62rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--gold, #C49A56)'
                    }}
                  >
                    CURRENTLY ASSISTING
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: active.consent ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: active.consent ? '#86EFAC' : '#FCA5A5'
                    }}
                  >
                    {active.consent ? '✓ CONSENT ACTIVE' : '🔒 CONSENT REQUIRED'}
                  </span>
                </div>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', color: '#FDFBF7', fontWeight: 800 }}>
                  {active.name}
                </h3>
                <div className="row" style={{ gap: 8, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  <span className="mono">ID: {active.id}</span>
                  <span>•</span>
                  <span>Auto-locking in {left}s</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  last.current = Date.now()
                  setLeft(LOCK_S)
                }}
                style={{
                  color: 'var(--gold, #C49A56)',
                  borderColor: 'rgba(196, 154, 86, 0.3)',
                  padding: '6px 12px'
                }}
                title="Extend session timer by 60 seconds"
              >
                <Clock size={13} style={{ marginRight: 4 }} />
                <span>+60s</span>
              </button>

              <button
                type="button"
                className="btn danger small"
                onClick={lock}
                style={{
                  padding: '8px 16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Lock size={14} />
                <span>Lock & Switch Family</span>
              </button>
            </div>
          </div>

          {/* If Consent is NOT granted for this family: Show OTP Consent Flow */}
          {!active.consent ? (
            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '12px',
                border: '1.5px solid var(--border-subtle, #E5E7EB)',
                padding: '24px'
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    background: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Key size={22} style={{ color: '#B45309' }} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--forest-dark, #0D2318)' }}>
                    Family Consent Authorization Required
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--muted, #6B7280)', lineHeight: 1.5 }}>
                    Under Bharosa constitutional rules, no helper can view or submit relief claims without this specific family's verifiable authorization. An OTP code must be sent to the family's registered phone.
                  </p>
                </div>
              </div>

              {!mock ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button
                    className="btn"
                    onClick={reqCode}
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      background: 'var(--forest, #173D32)',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    <Phone size={18} />
                    <span>Send SMS Verification Code to Family's Phone</span>
                    <MockTag>MOCK SMS</MockTag>
                  </button>
                  <span className="small subtle" style={{ textAlign: 'center' }}>
                    A one-time simulated 6-digit code will be generated for demonstration.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Mock SMS Notice */}
                  <div
                    style={{
                      background: '#EFF6FF',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Phone size={18} style={{ color: '#2563EB' }} />
                      <div>
                        <div style={{ fontSize: '0.74rem', color: '#1E40AF', fontWeight: 600 }}>
                          SIMULATED SMS SENT TO FAMILY
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#1E3A8A' }}>
                          Code: <strong className="mono" style={{ fontSize: '1.1rem', letterSpacing: '2px' }}>{mock.mock_code_for_demo}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setCode(mock.mock_code_for_demo)}
                      style={{ background: '#2563EB', color: '#FFF', fontSize: '0.78rem' }}
                    >
                      Autofill Code
                    </button>
                  </div>

                  {/* Code Input & Confirmation */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      style={{
                        maxWidth: '220px',
                        fontSize: '1.2rem',
                        letterSpacing: '4px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontWeight: 700
                      }}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                    />
                    <button
                      className="btn"
                      onClick={confirm}
                      disabled={code.trim().length < 6}
                      style={{
                        padding: '12px 20px',
                        fontWeight: 700,
                        background: 'var(--forest, #173D32)',
                        color: '#FFF'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Confirm & Grant Consent</span>
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={reqCode}
                      style={{ color: 'var(--muted, #6B7280)' }}
                    >
                      Resend Code
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Consent Active: Tabbed Interface for Claims & Data */
            <>
              {info && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1.5px solid #BBF7D0',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: '#166534',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{info}</span>
                </div>
              )}

              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  ['cases', 'Claims & Relief Requests'],
                  ['data', 'Privacy & Sovereign Consents']
                ]}
              />

              {tab === 'cases' && (
                <div className="col" style={{ gap: 16 }}>
                  {/* Action Bar */}
                  <div className="row spread" style={{ alignItems: 'center' }}>
                    <Link
                      to="/h/claim"
                      className="btn"
                      style={{
                        padding: '12px 20px',
                        fontWeight: 700,
                        background: 'var(--forest, #173D32)',
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <Plus size={16} />
                      <span>New Relief Claim for {active.name.split(' ')[0]}</span>
                    </Link>

                    {activeFamilyOfflineClaims.length > 0 && (
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => setShowSyncCenter(true)}
                        style={{ color: 'var(--gold-dark, #B45309)', fontWeight: 600 }}
                      >
                        <Clock size={14} style={{ marginRight: 4 }} />
                        <span>{activeFamilyOfflineClaims.length} Offline Staged Claim(s)</span>
                      </button>
                    )}
                  </div>

                  {/* Local Offline Claims for this Family */}
                  {activeFamilyOfflineClaims.length > 0 && (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(196, 154, 86, 0.1) 0%, rgba(23, 61, 50, 0.05) 100%)',
                        border: '1.5px solid rgba(196, 154, 86, 0.4)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <div className="row spread">
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gold-dark, #92400E)' }}>
                          Offline Claims Staged on this Phone for {active.name}
                        </div>
                        <button className="small btn" onClick={() => flush()} disabled={!online}>
                          Sync Now
                        </button>
                      </div>
                      {activeFamilyOfflineClaims.map((item) => (
                        <div
                          key={item.id}
                          className="row spread"
                          style={{
                            background: '#FFF',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            fontSize: '0.82rem'
                          }}
                        >
                          <div>
                            <span className="mono bold">{item.temp_id}</span>
                            <span className="small muted" style={{ marginLeft: 8 }}>
                              {when(item.created)}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: '#FEF3C7',
                              color: '#92400E',
                              padding: '2px 8px',
                              borderRadius: 999
                            }}
                          >
                            WAITING SYNC
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {cases.loading && <Spinner label="Loading family requests…" />}

                  {cases.data?.length === 0 && activeFamilyOfflineClaims.length === 0 && (
                    <div
                      style={{
                        padding: '32px 20px',
                        textAlign: 'center',
                        background: 'var(--ivory, #F5F0E6)',
                        borderRadius: '12px',
                        border: '1.5px dashed var(--border-subtle, #E5E7EB)'
                      }}
                    >
                      <FileText size={32} style={{ color: 'var(--muted, #9CA3AF)', margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 600, color: 'var(--forest-dark, #0D2318)' }}>
                        No Claims on File for this Family
                      </div>
                      <p className="small muted" style={{ margin: '4px 0 0' }}>
                        Click "New Relief Claim" above to register an application on their behalf.
                      </p>
                    </div>
                  )}

                  {cases.data?.map((c) => (
                    <Link
                      key={c.id}
                      to={'/h/cases/' + c.id}
                      className="row spread"
                      style={{
                        padding: '14px 18px',
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid var(--border-subtle, #E5E7EB)',
                        borderRadius: 'var(--radius-md, 10px)',
                        background: '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                      }}
                    >
                      <div>
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <b className="mono" style={{ fontSize: '0.92rem', color: 'var(--forest-dark, #0D2318)' }}>
                            #{c.id.slice(0, 8)}
                          </b>
                          <span className="small subtle">{when(c.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted, #6B7280)', marginTop: 2 }}>
                          {c.data?.marital_status ? `Status: ${c.data.marital_status}` : 'Relief application'}
                          {c.data?.monthly_income && ` · PKR ${Number(c.data.monthly_income).toLocaleString()}`}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                        <StatusBadge s={c.status} />
                        <ChevronRight size={16} className="subtle" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {tab === 'data' && (
                <MyData subjectId={active.id} subjectName={active.name} />
              )}
            </>
          )}
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────
           FAMILY SELECTION ROSTER VIEW
        ─────────────────────────────────────────────────────────── */
        <div className="card col" style={{ gap: 20 }}>
          {/* Territory Statistics Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Families Assigned
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--forest-dark, #0D2318)', marginTop: 2 }}>
                {familiesList.length}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted, #6B7280)' }}>In helper territory</div>
            </div>

            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Consent Active
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16A34A', marginTop: 2 }}>
                {consentedCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#16A34A' }}>Verified via OTP</div>
            </div>

            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Consent Needed
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: pendingCount > 0 ? '#B45309' : 'var(--muted, #9CA3AF)', marginTop: 2 }}>
                {pendingCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted, #6B7280)' }}>Requires SMS OTP</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ position: 'relative' }}>
              <Search
                size={18}
                className="subtle"
                style={{ position: 'absolute', left: 14, top: 14 }}
              />
              <input
                placeholder="Search community family by name or relief programme…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ paddingLeft: 42, background: '#FFFFFF' }}
              />
              {q && (
                <button
                  type="button"
                  className="ghost small icon-btn"
                  onClick={() => setQ('')}
                  style={{ position: 'absolute', right: 10, top: 10 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="row" style={{ gap: 8 }}>
              {[
                { id: 'all', label: `All Families (${familiesList.length})` },
                { id: 'consented', label: `Consent Active (${consentedCount})` },
                { id: 'pending', label: `Consent Required (${pendingCount})` }
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`small ${filterType === chip.id ? 'btn' : 'btn ghost'}`}
                  onClick={() => setFilterType(chip.id)}
                  style={{
                    fontSize: '0.76rem',
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: filterType === chip.id ? 'var(--forest, #173D32)' : 'transparent',
                    color: filterType === chip.id ? '#FFF' : 'var(--forest-dark, #0D2318)'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {fam.loading && <Spinner label="Loading community family roster…" />}

          {/* Large, Easy-to-Identify Family Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filteredList.map((f) => {
              const av = getAvatarStyle(f.name)
              const hasConsent = f.helper_consent_active

              return (
                <div
                  key={f.citizen_id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: `1.5px solid ${hasConsent ? 'rgba(23, 61, 50, 0.2)' : 'rgba(196, 154, 86, 0.35)'}`,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Top card section: Avatar + Info */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        background: av.bg,
                        border: `1.5px solid ${av.border}`,
                        color: av.text,
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {getInitials(f.name)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.02rem', color: 'var(--forest-dark, #0D2318)', fontWeight: 700, lineHeight: 1.3 }}>
                        {f.name}
                      </h4>
                      <div className="row" style={{ gap: 6, fontSize: '0.72rem', color: 'var(--muted, #6B7280)', marginTop: 4 }}>
                        <span className="mono">ID: {f.citizen_id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Consent Badge & Switch Action */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="row spread" style={{ alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: hasConsent ? '#DCFCE7' : '#FEF3C7',
                          color: hasConsent ? '#15803D' : '#92400E',
                          border: `1px solid ${hasConsent ? '#BBF7D0' : '#FDE68A'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {hasConsent ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                        <span>{hasConsent ? 'CONSENT ACTIVE' : 'CONSENT REQUIRED'}</span>
                      </span>

                      <span className="small subtle" style={{ fontSize: '0.68rem' }}>
                        {hasConsent ? 'OTP Confirmed' : 'Needs Mock SMS'}
                      </span>
                    </div>

                    <button
                      className="btn"
                      onClick={() => sw(f)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        background: hasConsent ? 'var(--forest, #173D32)' : 'linear-gradient(135deg, #B45309, #D97706)',
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      {hasConsent ? (
                        <>
                          <Users size={15} />
                          <span>Start Assistance Session</span>
                          <ArrowRight size={14} />
                        </>
                      ) : (
                        <>
                          <Key size={15} />
                          <span>Request OTP Consent</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredList.length === 0 && !fam.loading && (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #6B7280)' }}>
              No families match your search query. Try another name.
            </div>
          )}

          {/* Sovereign Device Security Explainer */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(196, 154, 86, 0.08) 0%, rgba(23, 61, 50, 0.04) 100%)',
              border: '1px solid rgba(196, 154, 86, 0.3)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              gap: 12,
              alignItems: 'center'
            }}
          >
            <ShieldCheck size={24} style={{ color: 'var(--gold-dark, #92400E)', flexShrink: 0 }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--forest-dark, #0D2318)', lineHeight: 1.5 }}>
              <strong>Sovereign Privacy Guarantee:</strong> Each family possesses an isolated consent boundary. Opening a session for one family automatically seals and purges previous family data from memory. Session expires after 60s of inactivity.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
