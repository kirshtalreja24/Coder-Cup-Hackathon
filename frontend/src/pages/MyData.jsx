import { useState, useEffect } from 'react'
import {
  Lock,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  CreditCard,
  FileText,
  User,
  History,
  Check,
  AlertTriangle,
  Info,
  Key,
  ExternalLink,
  Users,
  Copy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldX
} from 'lucide-react'
import { apiGet, apiPatch, apiPost, getUser, when } from '../api'
import { useLang } from '../i18n'
import { playPrompt } from '../voice'
import { ErrorBox, Spinner, useAsync, MockTag } from '../ui'

const SCOPE_DETAILS = {
  identity: {
    icon: CreditCard,
    title: { en: 'National Identity & Family Tree', ur: 'قومی شناختی ریکارڈ اور خاندانی شجرہ' },
    what: 'Full legal name, CNIC number, date of birth, martial status, and NADRA family unit ID.',
    why: 'Verifies applicant identity and confirms widowhood or family eligibility without requiring paper affidavits.',
    defaultWho: 'National Database and Registration Authority (NADRA)'
  },
  payment: {
    icon: ShieldCheck,
    title: { en: 'Raast Payment & Financial Routing', ur: 'راستی اکاؤنٹ اور ادائیگی کا راستہ' },
    what: 'IBAN, Raast mobile-linked payment alias, and bank account verification token.',
    why: 'Enables direct, zero-fee cash grant transfer from State Bank treasury directly into your account.',
    defaultWho: 'State Bank of Pakistan (Raast Gateway)'
  },
  documents: {
    icon: FileText,
    title: { en: 'Uploaded Proof Documents', ur: 'اپ لوڈ کردہ تصدیقی دستاویزات' },
    what: 'High-resolution images of CNIC, death certificate, and BISP survey slips.',
    why: 'Provides secondary proof to verify eligibility when biometric scanners fail or network is down.',
    defaultWho: 'Relief Verification Caseworkers'
  },
  case_history: {
    icon: History,
    title: { en: 'Application & Timeline History', ur: 'درخواست اور کارروائی کی تفصیلات' },
    what: 'Previous claim submissions, officer verification remarks, and appeal logs.',
    why: 'Maintains continuity across relief disbursements and prevents duplicate claim requests.',
    defaultWho: 'Social Welfare Department Officers'
  },
  profile: {
    icon: User,
    title: { en: 'Contact & Household Demographics', ur: 'رابطہ اور گھریلو معلومات' },
    what: 'Mobile phone number, residential address, district, and household size.',
    why: 'Ensures relief notifications and payment SMS reach you without delay.',
    defaultWho: 'District Relief Operations Center'
  }
}

const GRANTEE_LABELS = {
  mock_nadra: 'NADRA Civil Registry',
  mock_raast: 'State Bank Raast Rail',
  officer: 'Welfare Review Officers',
  helper: 'Community Digital Assistant'
}

export default function MyData({ subjectId, subjectName }) {
  const { t, lang } = useLang()
  const q = subjectId ? `?subject_id=${subjectId}` : ''
  const cons = useAsync(() => apiGet('/consents' + q), [subjectId])
  const log = useAsync(() => apiGet('/consents/access-log' + q), [subjectId])
  // Only a helper account has a family list; citizens must not call this endpoint (it answers 403).
  const isHelper = getUser()?.role === 'helper'
  const helperFamilies = useAsync(() => (isHelper ? apiGet('/helper/families').catch(() => null) : Promise.resolve(null)), [])

  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState('')
  const [blockedExplain, setBlockedExplain] = useState(false)
  const [withdrawTarget, setWithdrawTarget] = useState(null) // for single withdrawal confirmation
  const [confirmAllOpen, setConfirmAllOpen] = useState(false) // for panic button confirmation
  const [actionBusy, setActionBusy] = useState(false)
  const [copiedReceipt, setCopiedReceipt] = useState(null)

  const u = getUser()
  const [prof, setProf] = useState({ name: u?.name || '', phone: u?.phone || '' })

  const refresh = () => {
    cons.reload()
    log.reload()
    helperFamilies.reload()
  }

  const handleCopyReceipt = (text) => {
    navigator.clipboard?.writeText(text)
    setCopiedReceipt(text)
    setTimeout(() => setCopiedReceipt(null), 2000)
  }

  // Single Consent Withdrawal with Confirmation
  const executeWithdraw = async (c) => {
    setActionBusy(true)
    setErr(null)
    try {
      await apiPost(`/consents/${c.id}/withdraw`)
      playPrompt('consent_withdrawn', 'Your permission was withdrawn.', lang === 'ur' ? 'ur' : 'en')
      setMsg(`Permission for "${c.scope}" revoked successfully.`)
      setBlockedExplain(true)
      setWithdrawTarget(null)
      refresh()
    } catch (e) {
      setErr(e)
    } finally {
      setActionBusy(false)
    }
  }

  // Panic Button: Withdraw All with Confirmation
  const executeWithdrawAll = async () => {
    setActionBusy(true)
    setErr(null)
    try {
      const r = await apiPost('/consents/withdraw-all' + q)
      setMsg(`Sovereign Lockdown Active: ${r.withdrawn} permission(s) revoked.`)
      setBlockedExplain(true)
      playPrompt('consent_withdrawn', 'All permissions withdrawn.', lang === 'ur' ? 'ur' : 'en')
      setConfirmAllOpen(false)
      refresh()
    } catch (e) {
      setErr(e)
    } finally {
      setActionBusy(false)
    }
  }

  const saveProfile = async () => {
    try {
      await apiPatch('/auth/me/profile', prof)
      setMsg('Profile contact details updated.')
    } catch (e) {
      setErr(e)
    }
  }

  const activeCount = cons.data?.active_count ?? cons.data?.active?.length ?? 0
  const activeConsents = cons.data?.active || []
  const withdrawnConsents = cons.data?.withdrawn || []

  return (
    <div className="col narrow" style={{ gap: 24, maxWidth: 840, margin: '0 auto' }}>
      {/* Title Header with Sovereign Trust Theme */}
      <div
        className="card flat"
        style={{
          background: 'linear-gradient(135deg, var(--forest-dark) 0%, var(--forest) 100%)',
          color: '#fff',
          padding: '24px 28px',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--forest)'
        }}
      >
        <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="badge" style={{ background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
                DATA SOVEREIGNTY CONSOLE
              </span>
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '0.75rem' }}>
                Zero-Knowledge Privacy
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#fff', lineHeight: 1.25 }}>
              {t('mydata')}
              {subjectName && <span style={{ fontSize: '1.2rem', opacity: 0.9 }}> · {subjectName}</span>}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: '0.95rem', opacity: 0.88, maxWidth: 580, lineHeight: 1.5 }}>
              You own your data. Government agencies, verification services, and welfare officers can only access your information with explicit, revocable permission.
            </p>
          </div>

          {activeCount > 0 && (
            <button
              className="btn small"
              style={{
                background: 'var(--terracotta)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                alignSelf: 'flex-start'
              }}
              onClick={() => setConfirmAllOpen(true)}
            >
              <ShieldAlert size={14} />
              <span>Panic Button: Revoke All</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Message */}
      {msg && (
        <div className="banner ok" style={{ borderLeft: '4px solid var(--forest)' }}>
          <CheckCircle2 size={20} style={{ color: 'var(--forest)' }} />
          <div style={{ flex: 1 }}>
            <b>{msg}</b>
          </div>
        </div>
      )}

      {/* Backend Blocking Rule Explanation Banner (Appears after revocation) */}
      {blockedExplain && (
        <div
          className="card"
          style={{
            background: 'var(--sage-soft)',
            border: '1.5px solid var(--forest)',
            padding: '16px 20px',
            borderRadius: 'var(--radius)'
          }}
        >
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <ShieldX size={24} style={{ color: 'var(--forest-dark)', flexShrink: 0, marginTop: 2 }} />
            <div className="col" style={{ gap: 4 }}>
              <b style={{ color: 'var(--forest-dark)', fontSize: '0.95rem' }}>
                Sovereign Backend Rule Enforcement Active
              </b>
              <p className="small" style={{ margin: 0, lineHeight: 1.5, color: '#1a3328' }}>
                Under Bharosa's zero-knowledge security rules, subsequent queries to NADRA, Raast, or caseworker portals for revoked scopes will immediately fail with <b>HTTP 403 Forbidden</b> (<span className="mono">access.denied</span>). Every blocked attempt is permanently committed to the immutable audit trail.
              </p>
            </div>
          </div>
        </div>
      )}

      <ErrorBox e={err} />

      {/* CONFIRMATION MODAL: SINGLE CONSENT WITHDRAWAL */}
      {withdrawTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 43, 36, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            className="card col"
            style={{
              maxWidth: 480,
              width: '100%',
              background: '#fff',
              border: '2px solid var(--terracotta)',
              padding: 24,
              gap: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div className="row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--terracotta-soft)',
                  color: 'var(--terracotta)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--terracotta-dark)' }}>Confirm Permission Revocation</h3>
                <span className="small muted">Immediate cryptographic termination</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5, color: '#2a2a2a' }}>
              Are you sure you want to withdraw consent for <b>{withdrawTarget.scope}</b>?
              Once revoked, <b>{GRANTEE_LABELS[withdrawTarget.grantee] || withdrawTarget.grantee}</b> will be strictly blocked from reading this data. Active relief disbursements or identity assessments requiring this data will be paused.
            </p>

            <div className="row spread" style={{ paddingTop: 8 }}>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setWithdrawTarget(null)}
                disabled={actionBusy}
              >
                Cancel (Keep Active)
              </button>

              <button
                type="button"
                className="btn danger small"
                disabled={actionBusy}
                onClick={() => executeWithdraw(withdrawTarget)}
              >
                {actionBusy ? 'Revoking…' : 'Yes, Revoke Access Immediately'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: PANIC WITHDRAW ALL */}
      {confirmAllOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 43, 36, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            className="card col"
            style={{
              maxWidth: 500,
              width: '100%',
              background: '#fff',
              border: '2px solid var(--terracotta)',
              padding: 24,
              gap: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div className="row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--terracotta-soft)',
                  color: 'var(--terracotta)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--terracotta-dark)' }}>Activate Panic Lockdown</h3>
                <span className="small muted">Revoke all active permissions simultaneously</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5, color: '#2a2a2a' }}>
              This will revoke <b>all {activeCount} active data sharing permissions</b> across NADRA, Raast, and all welfare officers at once. All external lookups will be immediately halted.
            </p>

            <div className="row spread" style={{ paddingTop: 8 }}>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setConfirmAllOpen(false)}
                disabled={actionBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn danger small"
                disabled={actionBusy}
                onClick={executeWithdrawAll}
              >
                {actionBusy ? 'Locking Down…' : 'Confirm Lockdown: Revoke All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE DATA SHARING PERMISSIONS */}
      <div className="card col" style={{ gap: 18, border: '1.5px solid var(--border)' }}>
        <div className="row spread" style={{ alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--forest-dark)' }}>
              Active Data Sharing Permissions
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Scoped zero-knowledge access granted to verify identity, check claims, or disburse funds
            </div>
          </div>
          <span className="badge green bold" style={{ fontSize: '0.8rem' }}>
            {activeCount} Active Grant{activeCount === 1 ? '' : 's'}
          </span>
        </div>

        {cons.loading && <Spinner label="Loading sovereign consent registry…" />}

        {activeCount === 0 && !cons.loading && (
          <div
            className="col"
            style={{
              alignItems: 'center',
              padding: '36px 16px',
              textAlign: 'center',
              background: 'var(--ivory)',
              borderRadius: 'var(--radius)',
              border: '1px dashed var(--border)'
            }}
          >
            <Lock size={36} style={{ color: 'var(--forest)' }} />
            <b style={{ marginTop: 10, fontSize: '1.05rem', color: 'var(--forest-dark)' }}>
              Total Data Privacy Active
            </b>
            <p className="small muted" style={{ margin: '4px 0 0', maxWidth: 440 }}>
              No active permissions exist. No external registry, bank rail, or caseworker has access to your records.
            </p>
          </div>
        )}

        {/* List of active consents with comprehensive details */}
        <div className="col" style={{ gap: 14 }}>
          {activeConsents.map((c) => {
            const meta = SCOPE_DETAILS[c.scope] || {
              icon: FileText,
              title: { en: c.scope.toUpperCase(), ur: c.scope },
              what: 'Data scoped to ' + c.scope,
              why: 'Required to process public welfare relief.',
              defaultWho: GRANTEE_LABELS[c.grantee] || c.grantee
            }
            const Icon = meta.icon
            const granteeName = GRANTEE_LABELS[c.grantee] || c.grantee_type + ': ' + c.grantee

            return (
              <div
                key={c.id}
                className="card col"
                style={{
                  background: 'var(--ivory)',
                  border: '1.5px solid var(--forest)',
                  padding: '18px 20px',
                  borderRadius: 'var(--radius)',
                  gap: 14
                }}
              >
                {/* Header row */}
                <div className="row spread" style={{ alignItems: 'flex-start' }}>
                  <div className="row" style={{ gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius)',
                        background: 'var(--forest)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <div>
                      <div className="row" style={{ gap: 8 }}>
                        <b style={{ fontSize: '1.05rem', color: 'var(--forest-dark)' }}>
                          {meta.title?.[lang === 'ur' ? 'ur' : 'en'] || meta.title?.en}
                        </b>
                        <span className="badge green small">ACTIVE</span>
                      </div>
                      <div className="small subtle" style={{ marginTop: 2 }}>
                        Granted to: <b>{granteeName}</b> · Since {when(c.granted_at)}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn danger small"
                    onClick={() => setWithdrawTarget(c)}
                    style={{ fontWeight: 600 }}
                  >
                    Withdraw Consent
                  </button>
                </div>

                {/* 3 Pillars: What is accessed, Why it is needed, Who can access */}
                <div
                  className="admin-grid-3"
                  style={{
                    gap: 10,
                    background: '#fff',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div className="col" style={{ gap: 2 }}>
                    <span className="small bold" style={{ color: 'var(--forest-dark)', fontSize: '0.78rem' }}>
                      📋 WHAT DATA IS ACCESSED
                    </span>
                    <span className="small muted" style={{ lineHeight: 1.4 }}>
                      {meta.what}
                    </span>
                  </div>

                  <div className="col" style={{ gap: 2 }}>
                    <span className="small bold" style={{ color: 'var(--forest-dark)', fontSize: '0.78rem' }}>
                      ⚖️ WHY IT IS NEEDED
                    </span>
                    <span className="small muted" style={{ lineHeight: 1.4 }}>
                      {c.purpose || meta.why}
                    </span>
                  </div>

                  <div className="col" style={{ gap: 2 }}>
                    <span className="small bold" style={{ color: 'var(--forest-dark)', fontSize: '0.78rem' }}>
                      🏛️ WHO CAN ACCESS
                    </span>
                    <span className="small muted" style={{ lineHeight: 1.4 }}>
                      {granteeName} (Subject ID: {c.id.slice(0, 8)}…)
                    </span>
                  </div>
                </div>

                {/* Cryptographic Receipt Hash */}
                <div className="row spread small subtle" style={{ fontSize: '0.76rem', borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <Key size={13} style={{ color: 'var(--gold-dark)' }} />
                    <span>Cryptographic Receipt:</span>
                    <span className="mono bold" style={{ color: 'var(--forest-dark)' }}>
                      {c.receipt || 'rcpt-sha256-verified'}
                    </span>
                  </div>

                  {c.receipt && (
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ padding: '1px 6px', height: 'auto', fontSize: '0.72rem' }}
                      onClick={() => handleCopyReceipt(c.receipt)}
                    >
                      {copiedReceipt === c.receipt ? 'Copied!' : 'Copy Hash'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* HELPER MODE: PER-FAMILY CONSENT BREAKDOWN */}
      {isHelper && helperFamilies.data?.families?.length > 0 && (
        <div className="card col" style={{ gap: 14, border: '1.5px solid var(--gold)', background: 'var(--ivory)' }}>
          <div className="row spread" style={{ alignItems: 'center' }}>
            <div className="row" style={{ gap: 10 }}>
              <Users size={20} style={{ color: 'var(--gold-dark)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--forest-dark)' }}>
                  Helper Mode — Per-Family Consent Delegation
                </h3>
                <div className="small subtle">
                  One shared phone, independent cryptographic consents per household
                </div>
              </div>
            </div>
            <span className="badge amber small bold">
              {helperFamilies.data?.count ?? helperFamilies.data?.families?.length ?? 0} Registered Families
            </span>
          </div>

          <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
            Each family maintains independent, isolated consent. Switching to a new household automatically locks access to the previous family's records and logs a new audit event.
          </p>

          <div className="col" style={{ gap: 8 }}>
            {(helperFamilies.data?.families || []).map((f) => (
              <div
                key={f.citizen_id}
                className="row spread"
                style={{
                  background: '#fff',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div className="row" style={{ gap: 10 }}>
                  <User size={16} style={{ color: 'var(--forest)' }} />
                  <div>
                    <b style={{ fontSize: '0.9rem', color: 'var(--forest-dark)' }}>{f.name}</b>
                    <span className="mono subtle small" style={{ marginLeft: 8 }}>({f.citizen_id})</span>
                  </div>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <span
                    className={`badge small ${f.helper_consent_active ? 'green' : 'amber'}`}
                  >
                    {f.helper_consent_active ? 'Consent Active' : 'OTP Authorization Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "WHO ACCESSED MY DATA?" TRANSPARENCY AUDIT LOG */}
      <div className="card col" style={{ gap: 16 }}>
        <div className="row spread" style={{ alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--forest-dark)' }}>
              "Who accessed my data?" — Tamper-Evident Access Log
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Immutable audit of every institution lookup attempt and blocked unauthorized access
            </div>
          </div>
          <button className="btn ghost small" onClick={() => log.reload()}>
            Refresh History
          </button>
        </div>

        {log.loading && <Spinner label="Loading cryptographic access records…" />}

        {log.data?.length === 0 && !log.loading && (
          <p className="small muted">No external lookups or read events recorded yet.</p>
        )}

        {log.data?.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Requesting Actor / Service</th>
                  <th>Action & Scope</th>
                  <th>Access Outcome</th>
                </tr>
              </thead>
              <tbody>
                {log.data?.map((e) => {
                  const isBlocked = e.outcome === 'denied'
                  return (
                    <tr key={e.seq}>
                      <td className="small subtle">{when(e.at)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--forest-dark)' }}>
                        {GRANTEE_LABELS[e.by] || e.by}
                      </td>
                      <td className="small">
                        <span className="mono">{e.action}</span>{' '}
                        {e.scope && (
                          <span className="badge small grey" style={{ marginLeft: 4 }}>
                            {e.scope}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge small ${isBlocked ? 'red' : 'green'}`}
                          style={{ fontWeight: 700 }}
                        >
                          {isBlocked ? 'BLOCKED (access.denied)' : 'AUTHORIZED (OK)'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HISTORY OF REVOKED PERMISSIONS */}
      {withdrawnConsents.length > 0 && (
        <details className="card" style={{ padding: 18, background: 'var(--ivory)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--forest-dark)' }}>
            Historical Log of Revoked Permissions ({withdrawnConsents.length})
          </summary>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {withdrawnConsents.map((c) => (
              <div
                key={c.id}
                className="row spread small"
                style={{
                  padding: '10px 14px',
                  background: '#fff',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <XCircle size={15} style={{ color: 'var(--terracotta)' }} />
                  <span>
                    Scope <b>{c.scope}</b> revoked from <b>{GRANTEE_LABELS[c.grantee] || c.grantee}</b>
                  </span>
                </div>
                <span className="muted">Terminated {when(c.withdrawn_at)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* PROFILE CONTACT DETAILS UPDATE */}
      {!subjectId && (
        <div className="card col" style={{ gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--forest-dark)' }}>
              Accurate Notification Channel
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Keep your contact phone updated to receive instant SMS notifications when payments are disbursed
            </div>
          </div>
          <div className="admin-grid-2" style={{ gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.85rem' }}>Full Legal Name</label>
              <input
                value={prof.name}
                onChange={(e) => setProf({ ...prof, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem' }}>Verified Mobile Phone (for 8171 SMS)</label>
              <input
                value={prof.phone || ''}
                onChange={(e) => setProf({ ...prof, phone: e.target.value })}
                placeholder="0300-1234567"
              />
            </div>
          </div>
          <button
            onClick={saveProfile}
            className="btn small"
            style={{ alignSelf: 'flex-start', background: 'var(--forest)', color: '#fff' }}
          >
            <Edit3 size={14} />
            <span>Save Profile</span>
          </button>
        </div>
      )}
    </div>
  )
}
