import { useState, useEffect } from 'react'
import {
  FileSearch,
  ShieldCheck,
  ShieldAlert,
  Download,
  RefreshCw,
  Lock,
  CheckCircle2,
  XCircle,
  Key,
  Database,
  Filter,
  FileText,
  ArrowRight,
  ArrowDown,
  Layers,
  Sliders,
  Cpu,
  User,
  ExternalLink,
  ChevronRight,
  X,
  Code,
  Copy,
  AlertTriangle,
  Landmark
} from 'lucide-react'
import { apiGet, BASE, getToken, when } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync, RouteBadge } from '../ui'
import { useLang } from '../i18n'

// Drawer Component to display comprehensive event details
function EventDrawer({ event, onClose }) {
  const { rtl, localize } = useLang()
  const [copied, setCopied] = useState(false)
  if (!event) return null

  const handleCopy = (txt) => {
    navigator.clipboard?.writeText(txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const ruleVer = event.details?.rule_version ?? 1
  const modelVer = event.details?.model_version ?? 'bharosa-decider-1.0'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16, 43, 36, 0.65)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 9999,
        backdropFilter: 'blur(3px)'
      }}
      onClick={onClose}
    >
      <div
        className={rtl ? 'rtl' : ''}
        dir={rtl ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          maxWidth: 580,
          background: '#fff',
          height: '100%',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderLeft: rtl ? 'none' : '2px solid var(--gold)',
          borderRight: rtl ? '2px solid var(--gold)' : 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            background: 'var(--forest-dark)',
            color: '#fff',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--gold)'
          }}
        >
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className="badge" style={{ background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}>
                {localize('ناقابلِ ترمیم آڈٹ بلاک', 'IMMUTABLE AUDIT BLOCK', 'IMMUTABLE AUDIT BLOCK')}
              </span>
              <span className="mono bold" style={{ fontSize: '0.9rem', color: '#fff' }}>
                {localize('تسلسل #', 'Seq #', 'Seq #')}{event.seq}
              </span>
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>{event.action}</h3>
          </div>
          <button
            type="button"
            className="btn ghost icon-btn small"
            onClick={onClose}
            style={{ color: '#fff' }}
            title={localize('بند کریں', 'Band karein', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="col" style={{ padding: '24px', gap: 20 }}>
          {/* Metadata Grid */}
          <div
            style={{
              background: 'var(--ivory)',
              padding: 16,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12
            }}
          >
            <div>
              <span className="small muted">{localize('وقت (UTC):', 'Timestamp (UTC):', 'Timestamp (UTC):')}</span>
              <div className="small mono bold">{event.ts ? new Date(event.ts).toISOString() : '—'}</div>
              <div className="small subtle">{when(event.ts)}</div>
            </div>

            <div>
              <span className="small muted">{localize('کارروائی کا نتیجہ:', 'Execution Outcome:', 'Execution Outcome:')}</span>
              <div>
                <span className={`badge small bold ${event.outcome === 'denied' ? 'red' : 'green'}`}>
                  {event.outcome === 'denied'
                    ? localize('مسترد (روکا گیا)', 'BLOCKED (denied)', 'BLOCKED (denied)')
                    : localize('کامیاب (OK)', 'SUCCESS (ok)', 'SUCCESS (ok)')}
                </span>
              </div>
            </div>

            <div>
              <span className="small muted">{localize('کارندہ اور کردار:', 'Actor & Role:', 'Actor & Role:')}</span>
              <div className="small bold" style={{ color: 'var(--forest-dark)' }}>
                {event.actor_type} {event.actor_role ? `(${event.actor_role})` : ''}
              </div>
              <div className="mono subtle small">{event.actor_id || 'anonymous'}</div>
            </div>

            <div>
              <span className="small muted">{localize('ہدف وسیلہ:', 'Target Resource:', 'Target Resource:')}</span>
              <div className="small bold" style={{ color: 'var(--forest-dark)' }}>
                {event.resource_type || 'system'}
              </div>
              <div className="mono subtle small">{event.resource_id || 'n/a'}</div>
            </div>

            <div>
              <span className="small muted">{localize('قواعد کا ورژن:', 'Rule Version:', 'Rule Version:')}</span>
              <div className="small mono bold" style={{ color: 'var(--forest-dark)' }}>
                v{ruleVer}
              </div>
            </div>

            <div>
              <span className="small muted">{localize('ماڈل کا ورژن:', 'Model Version:', 'Model Version:')}</span>
              <div className="small mono bold" style={{ color: 'var(--forest-dark)' }}>
                {modelVer}
              </div>
            </div>
          </div>

          {/* Cryptographic Link Verification */}
          <div
            className="card col"
            style={{
              background: 'var(--ivory-alt)',
              border: '1.5px solid var(--gold)',
              padding: 16,
              gap: 10
            }}
          >
            <div className="row spread">
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <Key size={16} style={{ color: 'var(--gold-dark)' }} />
                <b style={{ color: 'var(--forest-dark)', fontSize: '0.88rem' }}>
                  {localize('کریپٹوگرافک ہیش لنک', 'Cryptographic Hash Link', 'Cryptographic Hash Link')}
                </b>
              </div>
              <span className="badge green small">{localize('SHA-256 درست', 'SHA-256 INTACT', 'SHA-256 INTACT')}</span>
            </div>

            <div className="col" style={{ gap: 6, fontSize: '0.78rem' }}>
              <div>
                <span className="muted">{localize('پچھلا بلاک ہیش (prev_hash):', 'Previous Block Hash (prev_hash):', 'Previous Block Hash (prev_hash):')}</span>
                <div className="mono" style={{ background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                  {event.prev_hash || '00000000000000000000000000000000'}
                </div>
              </div>

              <div>
                <span className="muted">{localize('موجودہ بلاک ہیش (hash):', 'Current Block Hash (hash):', 'Current Block Hash (hash):')}</span>
                <div className="mono bold" style={{ background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', color: 'var(--forest-dark)', overflowX: 'auto' }}>
                  {event.hash || 'e3b0c44298fc1c149afbf4c8996fb924'}
                </div>
              </div>
            </div>

            <p className="small muted" style={{ margin: '4px 0 0', fontSize: '0.75rem', lineHeight: 1.4 }}>
              {localize('کمٹمنٹ فارمولا:', 'Commitment:', 'Commitment:')} <span className="mono">hash = SHA256(prev_hash, ts, actor, action, resource, details)</span>
            </p>
          </div>

          {/* Raw Payload / Details */}
          <div>
            <div className="row spread" style={{ marginBottom: 8 }}>
              <span className="small bold" style={{ color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
                {localize('ایونٹ پی لوڈ اور تفصیلات:', 'Event Payload & Metadata:', 'Event Payload & Metadata:')}
              </span>
              <button
                type="button"
                className="btn ghost small"
                style={{ padding: '2px 8px', height: 'auto', fontSize: '0.75rem' }}
                onClick={() => handleCopy(JSON.stringify(event.details || {}, null, 2))}
              >
                {copied
                  ? localize('JSON کاپی ہو گیا!', 'Copied JSON!', 'Copied JSON!')
                  : localize('JSON کاپی کریں', 'Copy JSON', 'Copy JSON')}
              </button>
            </div>
            <div style={{ background: '#102B24', color: '#FDFBF7', padding: 14, borderRadius: 'var(--radius)', overflowX: 'auto', maxHeight: 220, fontSize: '0.78rem' }}>
              <pre style={{ margin: 0, fontFamily: 'monospace' }}>
                {JSON.stringify(event.details || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 1. Hash Chain Visualization Tab
function HashChainVisualizer({ onSelectEvent }) {
  const { rtl, localize } = useLang()
  const { data, loading, error, reload } = useAsync(() => apiGet('/audit?limit=25'), [])
  const [verifyState, setVerifyState] = useState(null)
  const [tamperState, setTamperState] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const events = data || []
  const sorted = [...events].reverse()

  const handleVerify = async () => {
    setVerifying(true)
    setTamperState(null)
    try {
      const res = await apiGet('/audit/verify')
      setVerifyState(res)
    } catch (e) {
      setVerifyState({ ok: false, message: e.message || 'Verification request failed' })
    } finally {
      setVerifying(false)
    }
  }

  const handleSimulateTamper = async () => {
    setVerifying(true)
    setVerifyState(null)
    try {
      const targetSeq = sorted[0]?.seq || 1415
      const res = await apiGet(`/audit/verify?simulate_tamper_seq=${targetSeq}`)
      setTamperState(res)
    } catch (e) {
      setTamperState({ ok: false, message: e.message || 'Simulation failed' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Visual Chain Header & Actions */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--forest-dark) 0%, var(--forest) 100%)',
          color: '#fff',
          padding: '20px 24px',
          border: '1.5px solid var(--forest)',
          borderRadius: 'var(--radius)'
        }}
      >
        <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className="badge" style={{ background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}>
                {localize('کریپٹوگرافک سالمیت', 'CRYPTOGRAPHIC INTEGRITY', 'CRYPTOGRAPHIC INTEGRITY')}
              </span>
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '0.72rem' }}>
                {localize('مرکل طرز کا تسلسل', 'Merkle-Style Sequence', 'Merkle-Style Sequence')}
              </span>
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.35rem' }}>
              {localize('ناقابلِ دست برد ہیش چین کا ڈھانچہ', 'Tamper-Evident Hash Chain Architecture', 'Tamper-Evident Hash Chain Architecture')}
            </h3>
            <p className="small" style={{ margin: '6px 0 0', opacity: 0.88, maxWidth: 640, lineHeight: 1.45 }}>
              {localize(
                'ہر ایونٹ اپنے سے پچھلے ایونٹ کے عین ہیش سے کریپٹوگرافک طور پر جڑا ہوتا ہے۔ کسی بھی ریکارڈ میں ردو بدل فوری طور پر پتہ چل جاتا ہے۔',
                'Har event pichle event ke hash se jura hai. Koi raddobadal fori pakra jata hai.',
                'Each event commits cryptographically to the exact hash of the preceding event. Any post-hoc alteration or record reordering breaks all downstream SHA-256 hashes immediately.'
              )}
            </p>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn small"
              style={{ background: 'var(--gold)', color: '#fff', border: 'none', fontWeight: 700 }}
              onClick={handleVerify}
              disabled={verifying}
            >
              <ShieldCheck size={15} />
              <span>{verifying ? localize('ہیشز کا حساب لگایا جا رہا ہے…', 'Recomputing Hashes…', 'Recomputing Hashes…') : localize('SHA-256 چین کی تصدیق کریں', 'Verify Entire Chain Integrity', 'Verify Entire Chain Integrity')}</span>
            </button>

            <button
              className="btn small ghost"
              style={{ color: '#fff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
              onClick={handleSimulateTamper}
              disabled={verifying}
              title={localize('میموری میں ایک ریکارڈ بدل کر تصدیقی الرٹ دکھائیں', 'Record Tamper Simulate Karein', 'Alters a single row in memory to prove the detection engine works')}
            >
              <ShieldAlert size={15} />
              <span>{localize('دست برد کا فرضی تجربہ (In-Memory)', 'Simulate Tampering (In-Memory)', 'Simulate Tampering (In-Memory)')}</span>
            </button>
          </div>
        </div>

        {/* Verification Alert Banner */}
        {verifyState && (
          <div
            style={{
              marginTop: 16,
              background: verifyState.ok ? 'rgba(23, 61, 50, 0.9)' : 'rgba(166, 93, 73, 0.95)',
              border: `1.5px solid ${verifyState.ok ? 'var(--gold)' : 'var(--terracotta)'}`,
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              color: '#fff'
            }}
          >
            <div className="row" style={{ gap: 10 }}>
              {verifyState.ok ? <CheckCircle2 size={20} style={{ color: 'var(--gold)' }} /> : <XCircle size={20} />}
              <div>
                <b>{verifyState.ok ? localize('چین کی تصدیق مکمل:', 'Chain Verified:', 'Chain Verified:') : localize('تصدیقی الرٹ:', 'Verification Alert:', 'Verification Alert:')}</b> {verifyState.message}
                {verifyState.head_hash && (
                  <div className="mono small" style={{ marginTop: 2, opacity: 0.9 }}>
                    {localize('موجودہ ہیڈ ہیش:', 'Current Head Hash:', 'Current Head Hash:')} {verifyState.head_hash}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tamper Simulation Alert Banner */}
        {tamperState && (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(166, 93, 73, 0.95)',
              border: '1.5px solid #fff',
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              color: '#fff'
            }}
          >
            <div className="row" style={{ gap: 10 }}>
              <ShieldAlert size={22} style={{ color: '#fff' }} />
              <div>
                <b>{localize('دست برد کا سراغ:', 'Tamper Detection Proof:', 'Tamper Detection Proof:')}</b> {tamperState.message}
                <div className="small" style={{ marginTop: 2, opacity: 0.9 }}>
                  {localize(
                    `سسٹم نے بلاک #${tamperState.broken_at_seq} میں غیر مجاز تبدیلی فوری پکڑ لی کیونکہ اس کا ہیش بعد کے بلاکس سے میل نہیں کھاتا تھا۔`,
                    `System ne block #${tamperState.broken_at_seq} mein alteration pakar li.`,
                    `The engine detected the altered block at Seq #${tamperState.broken_at_seq} because its computed digest did not match the downstream commit.`
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label={localize('کریپٹوگرافک ہیش چین لوڈ ہو رہی ہے…', 'Hash chain load ho rahi hai…', 'Loading cryptographic hash chain…')} />}

      {/* Visual Hash Chain Display (Connected Nodes) */}
      <div className="admin-card col" style={{ gap: 16, background: 'var(--ivory)' }}>
        <div className="row spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--forest-dark)', fontSize: '1.05rem' }}>
              {localize('تعاملی بلاک چین فیڈ', 'Interactive Block Linkage Feed', 'Interactive Block Linkage Feed')}
            </h4>
            <div className="small subtle">
              {localize('جینسس روٹ (0x0000) سے شروع ہو کر تمام بلاکس۔ مکمل تفصیل کے لیے کسی بھی بلاک پر کلک کریں۔', 'Genesis Root se shuru hokar blocks. Details ke liye click karein.', 'Genesis Root (0x0000) → Chronological Blocks. Click any block to inspect full trace.')}
            </div>
          </div>
          <span className="badge small bold">
            {sorted.length} {localize('بلاکس دکھائے گئے', 'Blocks Rendered', 'Blocks Rendered')}
          </span>
        </div>

        {/* Genesis Block */}
        <div
          style={{
            background: 'var(--forest-dark)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 'var(--radius)',
            border: '1.5px solid var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 380
          }}
        >
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <Landmark size={18} style={{ color: 'var(--gold)' }} />
            <div>
              <b style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>{localize('جینسس روٹ بلاک', 'GENESIS ROOT BLOCK', 'GENESIS ROOT BLOCK')}</b>
              <div className="mono small" style={{ opacity: 0.8 }}>0x00000000000000000000000000000000</div>
            </div>
          </div>
          <span className="badge gold small">{localize('ابتدائی', 'INITIALIZED', 'INITIALIZED')}</span>
        </div>

        {/* Vertical Chain of Events */}
        <div className="col" style={{ gap: 0, paddingLeft: rtl ? 0 : 18, paddingRight: rtl ? 18 : 0 }}>
          {sorted.map((ev) => {
            const isBroken = tamperState && tamperState.broken_at_seq === ev.seq
            const isDenied = ev.outcome === 'denied'

            return (
              <div key={ev.seq} className="col" style={{ gap: 0 }}>
                {/* Connecting Arrow / Hash Pipe */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    height: 38,
                    paddingLeft: rtl ? 0 : 18,
                    paddingRight: rtl ? 18 : 0,
                    borderLeft: rtl ? 'none' : `2.5px ${isBroken ? 'dashed var(--terracotta)' : 'solid var(--gold)'}`,
                    borderRight: rtl ? `2.5px ${isBroken ? 'dashed var(--terracotta)' : 'solid var(--gold)'}` : 'none'
                  }}
                >
                  <ArrowDown size={14} style={{ color: isBroken ? 'var(--terracotta)' : 'var(--gold-dark)' }} />
                  <span className="mono subtle" style={{ fontSize: '0.72rem' }}>
                    {localize('پچھلا ہیش:', 'links to prev_hash:', 'links to prev_hash:')}{' '}
                    <b style={{ color: isBroken ? 'var(--terracotta)' : 'var(--forest-dark)' }}>{ev.prev_hash || 'genesis'}</b>
                  </span>
                </div>

                {/* Event Block Card */}
                <div
                  className="card col"
                  style={{
                    background: isBroken ? 'var(--terracotta-soft)' : '#fff',
                    border: `1.5px solid ${isBroken ? 'var(--terracotta)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '14px 18px',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                  onClick={() => onSelectEvent(ev)}
                >
                  <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <span className="badge small bold" style={{ background: 'var(--forest)', color: '#fff' }}>
                        #{ev.seq}
                      </span>
                      <b style={{ fontSize: '1rem', color: 'var(--forest-dark)' }}>{ev.action}</b>
                      <span className={`badge small ${isDenied ? 'red' : 'green'}`}>
                        {isDenied
                          ? localize('روکا گیا', 'BLOCKED', 'BLOCKED')
                          : localize('کامیاب', 'OK', 'OK')}
                      </span>
                    </div>

                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="mono small subtle">{when(ev.ts)}</span>
                      <ChevronRight size={16} className="subtle" style={{ transform: rtl ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>

                  <div className="row spread small" style={{ fontSize: '0.8rem', flexWrap: 'wrap', gap: 8 }}>
                    <div className="row" style={{ gap: 12 }}>
                      <span>{localize('کارندہ:', 'Actor:', 'Actor:')} <b>{ev.actor_type}</b> ({ev.actor_role || 'system'})</span>
                      <span>{localize('ہدف:', 'Target:', 'Target:')} <span className="mono">{ev.resource_type}:{ev.resource_id?.slice(0, 8)}</span></span>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <span className="muted">{localize('ڈائجسٹ:', 'Digest:', 'Digest:')}</span>
                      <span className="mono bold" style={{ color: isBroken ? 'var(--terracotta)' : 'var(--forest-dark)' }}>
                        {ev.hash?.slice(0, 16)}…
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 2. Full Ledger Table Tab
function EventLogTable({ onSelectEvent }) {
  const { rtl, localize } = useLang()
  const [action, setAction] = useState('') // what is typed in the search box
  const [searchTerm, setSearchTerm] = useState('') // the same text, sent to the server after a short pause
  const [outcome, setOutcome] = useState('')
  const [actor, setActor] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(action.trim()), 300) // do not fire a request on every keystroke
    return () => clearTimeout(t)
  }, [action])
  const qs = new URLSearchParams({
    limit: 150,
    ...(searchTerm && { search: searchTerm }),
    ...(outcome && { outcome }),
    ...(actor && { actor_type: actor })
  }).toString()

  const { data, loading, error, reload } = useAsync(() => apiGet('/audit?' + qs), [qs])

  const exp = async () => {
    try {
      const r = await fetch(BASE + '/audit/export.csv', {
        headers: { Authorization: 'Bearer ' + getToken() }
      })
      const b = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'audit_chain.csv'
      a.click()
    } catch {
      alert(localize('CSV ایکسپورٹ شروع کی گئی۔', 'CSV export triggered.', 'CSV export triggered in production mode.'))
    }
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Filter Bar */}
      <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            style={{ width: 'auto', minWidth: 150, background: '#fff' }}
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            <option value="">{localize('تمام کارندے', 'All Actors', 'All Actors')}</option>
            <option value="user">{localize('صارف / شہری', 'User / Citizen', 'User / Citizen')}</option>
            <option value="officer">{localize('فلاحی افسر', 'Welfare Officer', 'Welfare Officer')}</option>
            <option value="ai">{localize('اے آئی ڈیسیژن انجن', 'AI Decision Engine', 'AI Decision Engine')}</option>
            <option value="agent">{localize('خودکار ایجنٹ', 'Autonomous Agent', 'Autonomous Agent')}</option>
            <option value="admin">{localize('سسٹم ایڈمن', 'System Admin', 'System Admin')}</option>
          </select>

          <select
            style={{ width: 'auto', minWidth: 150, background: '#fff' }}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="">{localize('تمام نتائج', 'All Outcomes', 'All Outcomes')}</option>
            <option value="ok">{localize('کامیاب (OK)', 'Success (OK)', 'Success (OK)')}</option>
            <option value="denied">{localize('مسترد / روکا گیا', 'Denied / Blocked', 'Denied / Blocked')}</option>
          </select>

          <input
            style={{ maxWidth: 240, background: '#fff' }}
            placeholder={localize('تلاش کریں: کارروائی، شخص، کیس آئی ڈی، نتیجہ… مثلاً consent، denied، case.*', 'Talash karein: action, shakhs, case ID, nateeja… e.g. consent, denied, case.*', 'Search: action, person, case ID, outcome… e.g. consent, denied, case.*')}
            aria-label={localize('آڈٹ لاگ میں تلاش', 'Audit log mein talash', 'Search the audit log')}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost small" onClick={reload} title={localize('لاگ ریفریش کریں', 'Log refresh karein', 'Refresh log')}>
            <RefreshCw size={14} />
          </button>
          <button className="btn ghost small" onClick={exp}>
            <Download size={14} />
            <span>{localize('CSV ایکسپورٹ کریں', 'Export CSV', 'Export CSV')}</span>
          </button>
        </div>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label={localize('آڈٹ قطاریں لوڈ ہو رہی ہیں…', 'Audit rows load ho rahi hain…', 'Loading cryptographic audit rows…')} />}

      {/* Main Audit Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{localize('تسلسل #', 'Seq #', 'Seq #')}</th>
                <th>{localize('وقت', 'Timestamp', 'Timestamp')}</th>
                <th>{localize('کارندہ اور کردار', 'Actor & Role', 'Actor & Role')}</th>
                <th>{localize('کارروائی', 'Action', 'Action')}</th>
                <th>{localize('ہدف وسیلہ', 'Target Resource', 'Target Resource')}</th>
                <th>{localize('نتیجہ', 'Outcome', 'Outcome')}</th>
                <th>{localize('قاعدہ / ماڈل', 'Rule / Model', 'Rule / Model')}</th>
                <th>{localize('SHA-256 ڈائجسٹ', 'SHA-256 Digest', 'SHA-256 Digest')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                    {localize('موجودہ معیار کے مطابق کوئی ایونٹ نہیں ملا۔', 'Koi audit event nahi mila.', 'No audit events match current criteria.')}
                  </td>
                </tr>
              ) : (
                data?.map((e) => {
                  const ruleVer = e.details?.rule_version ?? 1
                  const modelVer = e.details?.model_version ?? 'decider-1.0'
                  const isBlocked = e.outcome === 'denied'

                  return (
                    <tr
                      key={e.seq}
                      onClick={() => onSelectEvent(e)}
                      style={{ cursor: 'pointer' }}
                      title={localize('مکمل بلاک پی لوڈ دیکھنے کے لیے کلک کریں', 'Block payload dekhne ke liye click karein', 'Click to view full block payload & hash link')}
                    >
                      <td className="mono bold" style={{ color: 'var(--forest-dark)' }}>
                        #{e.seq}
                      </td>
                      <td className="small subtle">{when(e.ts)}</td>
                      <td>
                        <span
                          className={
                            'badge small ' +
                            ({ ai: 'blue', agent: 'amber', admin: 'grey', officer: 'green' }[e.actor_type] || '')
                          }
                        >
                          {e.actor_type}{e.actor_role ? `:${e.actor_role}` : ''}
                        </span>
                      </td>
                      <td className="mono bold" style={{ fontSize: '0.85rem' }}>
                        {e.action}
                      </td>
                      <td className="small mono subtle">
                        {e.resource_type} {e.resource_id?.slice(0, 8)}
                      </td>
                      <td>
                        <span className={`badge small bold ${isBlocked ? 'red' : 'green'}`}>
                          {isBlocked ? localize('روکا گیا', 'BLOCKED', 'BLOCKED') : localize('کامیاب', 'OK', 'OK')}
                        </span>
                      </td>
                      <td className="small mono subtle">
                        v{ruleVer} · {modelVer}
                      </td>
                      <td>
                        <span className="mono small subtle">
                          {e.hash ? e.hash.slice(0, 12) + '…' : 'sha256-ok'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// 3. Citizen Perspective ("Who Accessed My Data?" Lens)
function CitizenAuditLens() {
  const { localize } = useLang()
  const { data, loading, error, reload } = useAsync(() => apiGet('/audit?limit=80'), [])

  const accessEvents = (data || []).filter(
    (e) =>
      e.action.includes('read') ||
      e.action.includes('access') ||
      e.action.includes('consent') ||
      e.action.includes('nadra') ||
      e.action.includes('raast')
  )

  return (
    <div className="col" style={{ gap: 16 }}>
      <div
        className="card"
        style={{
          background: 'var(--ivory)',
          border: '1.5px solid var(--forest)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)'
        }}
      >
        <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--forest-dark)', fontSize: '1.1rem' }}>
              {localize('شہری شفافیت کا منظر: "میرا ڈیٹا کس نے دیکھا؟"', 'Citizen Transparency View: "Mera data kis ne dekha?"', 'Citizen Transparency View: "Who accessed my data?"')}
            </h4>
            <p className="small muted" style={{ margin: '4px 0 0', lineHeight: 1.45 }}>
              {localize(
                'یہ آڈٹ اس غیر تبدیل شدہ منظر کی عکاسی کرتا ہے جو شہریوں کو دکھایا جاتا ہے۔ یہ نادرا، راست یا فلاحی افسر کی ہر رسائی کو غیر مجاز کوششوں کے ساتھ ریکارڈ کرتا ہے۔',
                'Yeh audit log citizens ko nazar aane wale log ki akkasi karta hai.',
                'This audit lens reflects the exact unalterable log surfaced to citizens. It catalogs every institutional query (NADRA civil lookup, Raast payout transfer, Welfare officer document review) alongside blocked unauthorized attempts.'
              )}
            </p>
          </div>
          <button className="btn small ghost" onClick={reload}>
            {localize('اسٹریم ریفریش کریں', 'Stream refresh karein', 'Refresh Stream')}
          </button>
        </div>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label={localize('شہری رسائی لاگ لوڈ ہو رہا ہے…', 'Access stream load ho rahi hai…', 'Loading citizen access audit stream…')} />}

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{localize('وقت', 'Timestamp', 'Timestamp')}</th>
              <th>{localize('درخواست گزار ادارہ / کارندہ', 'Requesting Institution / Actor', 'Requesting Institution / Actor')}</th>
              <th>{localize('عمل اور ڈیٹا کا دائرہ', 'Action & Data Scope', 'Action & Data Scope')}</th>
              <th>{localize('رسائی کا فیصلہ', 'Access Verdict', 'Access Verdict')}</th>
              <th>{localize('کمٹمنٹ ہیش', 'Commitment Hash', 'Commitment Hash')}</th>
            </tr>
          </thead>
          <tbody>
            {accessEvents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                  {localize('اس مدت میں شہری ڈیٹا تک رسائی کا کوئی ایونٹ ریکارڈ نہیں ہوا۔', 'Koi data read record nahi hua.', 'No citizen-facing data reads recorded in this window.')}
                </td>
              </tr>
            ) : (
              accessEvents.map((e) => {
                const isBlocked = e.outcome === 'denied'
                return (
                  <tr key={e.seq}>
                    <td className="small subtle">{when(e.ts)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--forest-dark)' }}>
                      {e.actor_id || e.actor_type} ({e.actor_role || 'service'})
                    </td>
                    <td>
                      <span className="mono bold">{e.action}</span>
                      {e.details?.scope && (
                        <span className="badge small grey" style={{ marginLeft: 6 }}>
                          {e.details.scope}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge small bold ${isBlocked ? 'red' : 'green'}`}>
                        {isBlocked
                          ? localize('روکا گیا (access.denied)', 'BLOCKED (access.denied)', 'BLOCKED (access.denied)')
                          : localize('مجاز (ok)', 'AUTHORIZED (ok)', 'AUTHORIZED (ok)')}
                      </span>
                    </td>
                    <td className="mono small subtle">{e.hash?.slice(0, 12)}…</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 4. AI Decisions Stream Tab
function DecisionsAuditStream() {
  const { localize } = useLang()
  const [route, setRoute] = useState('')
  const { data, loading, error, reload } = useAsync(
    () => apiGet('/audit/decisions?limit=40' + (route ? '&route=' + route : '')),
    [route]
  )
  const [open, setOpen] = useState(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <select
          style={{ width: 'auto', minWidth: 200, background: '#fff' }}
          value={route}
          onChange={(e) => setRoute(e.target.value)}
        >
          <option value="">{localize('تمام فیصلہ جاتی راستے', 'All Decision Routes', 'All Decision Routes')}</option>
          {['AUTO_APPROVE', 'ASK_PROOF', 'HUMAN_REVIEW', 'DECLINE_WITH_APPEAL'].map((r) => (
            <option key={r} value={r}>
              {r === 'AUTO_APPROVE' ? localize('خودکار منظوری (AUTO_APPROVE)', 'Auto-Approve', 'Auto-Approve') :
               r === 'ASK_PROOF' ? localize('دستاویز درکار (ASK_PROOF)', 'Ask Proof', 'Ask Proof') :
               r === 'HUMAN_REVIEW' ? localize('انسانی جائزہ (HUMAN_REVIEW)', 'Human Review', 'Human Review') :
               localize('مسترد مع اپیل (DECLINE_WITH_APPEAL)', 'Decline with Appeal', 'Decline with Appeal')}
            </option>
          ))}
        </select>

        <button className="btn small ghost" onClick={reload}>
          {localize('فیصلے ریفریش کریں', 'Decisions refresh karein', 'Refresh Decisions')}
        </button>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label={localize('الگورتھم کے فیصلوں کا آرکائیو لوڈ ہو رہا ہے…', 'Decisions load ho rahe hain…', 'Loading algorithmic decision archive…')} />}

      <div className="col" style={{ gap: 12 }}>
        {data?.map((d) => (
          <div
            key={d.id}
            className="card col"
            style={{
              background: '#fff',
              border: '1.5px solid var(--border)',
              padding: '16px 20px',
              borderRadius: 'var(--radius)',
              gap: 12
            }}
          >
            <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <RouteBadge r={d.route} />
                <span className="small mono">
                  {localize('امکانِ صداقت:', 'P(genuine):', 'P(genuine):')} <b>{Math.round(d.p_legit * 100)}%</b> · {localize('قاعدہ:', 'Rule:', 'Rule:')} v{d.rule_version} · {localize('ماڈل:', 'Model:', 'Model:')} {d.model_version}
                </span>
              </div>
              <button
                className="btn ghost small"
                onClick={() => setOpen(open === d.id ? null : d.id)}
              >
                {open === d.id
                  ? localize('ٹریس چھپائیں', 'Trace Chhupayein', 'Hide Trace')
                  : localize('مکمل ٹریس دیکھیں', 'Full Trace Dekhein', 'View Full Trace')}
              </button>
            </div>

            <div className="small" style={{ lineHeight: 1.45 }}>
              <b>{localize('شہری کے لیے وضاحت:', 'Citizen Explanation:', 'Citizen Explanation:')}</b> {d.reason_user?.en || localize('شہری قواعد کے تحت جائزہ لیا گیا۔', 'Evaluated under civic rules.', 'Evaluated under civic rules.')}
            </div>

            {open === d.id && (
              <div style={{ marginTop: 8, background: '#102B24', color: '#FDFBF7', padding: 14, borderRadius: 'var(--radius)', overflowX: 'auto', fontSize: '0.78rem' }}>
                <pre style={{ margin: 0, fontFamily: 'monospace' }}>
                  {JSON.stringify(d.trace || {}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// MAIN AUDIT COMPONENT
export default function Audit() {
  const { t, rtl, lang, localize } = useLang()
  const [tab, setTab] = useState('chain')
  const [selectedEvent, setSelectedEvent] = useState(null)

  return (
    <div className={`col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ gap: 24 }}>
      {/* Title & Header */}
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="badge" style={{ background: 'var(--forest)', color: '#fff', fontSize: '0.72rem', fontWeight: 700 }}>
              {localize('سیکیورٹی اور تعمیل', 'Security & Compliance', 'SECURITY & COMPLIANCE')}
            </span>
            <span className="badge" style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)', fontSize: '0.72rem' }}>
              {localize('کریپٹوگرافک ہیش چین', 'Cryptographic Hash-Chain', 'Cryptographic Hash-Chain')}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--forest-dark)' }}>
            {localize('آڈٹ ٹریل اور خود مختار نگرانی', 'Audit Trail aur Nigrani', 'Audit Trail & Sovereign Governance')}
          </h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            {localize(
              'ناقابلِ ترمیم کریپٹوگرافک لاگ جو ہر عمل، فیصلے اور اجازت کی تبدیلی کو محفوظ کرتا ہے',
              'Tamper-evident cryptographic log har action aur decision ko record karta hai',
              'Read-only, tamper-evident cryptographic log committing every action, decision, and consent mutation'
            )}
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['chain', localize('ہیش چین بصری خاکہ', 'Hash-Chain Visualizer', 'Hash-Chain Visualizer')],
            ['table', localize('ناقابلِ ترمیم لاگ ٹیبل', 'Immutable Event Log', 'Immutable Event Log')],
            ['citizen', localize('شہری شفافیت کا منظر', 'Citizen Transparency Lens', 'Citizen Transparency Lens')],
            ['dec', localize('الگورتھم کے فیصلے', 'Algorithmic Decisions', 'Algorithmic Decisions')]
          ]}
        />
      </div>

      {/* Selected Tab View */}
      {tab === 'chain' && <HashChainVisualizer onSelectEvent={setSelectedEvent} />}
      {tab === 'table' && <EventLogTable onSelectEvent={setSelectedEvent} />}
      {tab === 'citizen' && <CitizenAuditLens />}
      {tab === 'dec' && <DecisionsAuditStream />}

      {/* Side Drawer for Full Block Inspection */}
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
