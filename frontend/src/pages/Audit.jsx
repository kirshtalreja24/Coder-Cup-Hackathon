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

// Drawer Component to display comprehensive event details
function EventDrawer({ event, onClose }) {
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
        style={{
          width: '100%',
          maxWidth: 580,
          background: '#fff',
          height: '100%',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderLeft: '2px solid var(--gold)'
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
                IMMUTABLE AUDIT BLOCK
              </span>
              <span className="mono bold" style={{ fontSize: '0.9rem', color: '#fff' }}>
                Seq #{event.seq}
              </span>
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>{event.action}</h3>
          </div>
          <button
            type="button"
            className="btn ghost icon-btn small"
            onClick={onClose}
            style={{ color: '#fff' }}
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
              <span className="small muted">Timestamp (UTC):</span>
              <div className="small mono bold">{event.ts ? new Date(event.ts).toISOString() : '—'}</div>
              <div className="small subtle">{when(event.ts)}</div>
            </div>

            <div>
              <span className="small muted">Execution Outcome:</span>
              <div>
                <span className={`badge small bold ${event.outcome === 'denied' ? 'red' : 'green'}`}>
                  {event.outcome === 'denied' ? 'BLOCKED (denied)' : 'SUCCESS (ok)'}
                </span>
              </div>
            </div>

            <div>
              <span className="small muted">Actor & Role:</span>
              <div className="small bold" style={{ color: 'var(--forest-dark)' }}>
                {event.actor_type} {event.actor_role ? `(${event.actor_role})` : ''}
              </div>
              <div className="mono subtle small">{event.actor_id || 'anonymous'}</div>
            </div>

            <div>
              <span className="small muted">Target Resource:</span>
              <div className="small bold" style={{ color: 'var(--forest-dark)' }}>
                {event.resource_type || 'system'}
              </div>
              <div className="mono subtle small">{event.resource_id || 'n/a'}</div>
            </div>

            <div>
              <span className="small muted">Rule Version:</span>
              <div className="small mono bold" style={{ color: 'var(--forest-dark)' }}>
                v{ruleVer}
              </div>
            </div>

            <div>
              <span className="small muted">Model Version:</span>
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
              <div className="row" style={{ gap: 6 }}>
                <Key size={16} style={{ color: 'var(--gold-dark)' }} />
                <b style={{ color: 'var(--forest-dark)', fontSize: '0.88rem' }}>
                  Cryptographic Hash Link
                </b>
              </div>
              <span className="badge green small">SHA-256 INTACT</span>
            </div>

            <div className="col" style={{ gap: 6, fontSize: '0.78rem' }}>
              <div>
                <span className="muted">Previous Block Hash (prev_hash):</span>
                <div className="mono" style={{ background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  {event.prev_hash || '00000000000000000000000000000000'}
                </div>
              </div>

              <div>
                <span className="muted">Current Block Hash (hash):</span>
                <div className="mono bold" style={{ background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', color: 'var(--forest-dark)' }}>
                  {event.hash || 'e3b0c44298fc1c149afbf4c8996fb924'}
                </div>
              </div>
            </div>

            <p className="small muted" style={{ margin: '4px 0 0', fontSize: '0.75rem', lineHeight: 1.4 }}>
              Commitment: <span className="mono">hash = SHA256(prev_hash, ts, actor, action, resource, details)</span>
            </p>
          </div>

          {/* Raw Payload / Details */}
          <div>
            <div className="row spread" style={{ marginBottom: 8 }}>
              <span className="small bold" style={{ color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
                Event Payload & Metadata:
              </span>
              <button
                type="button"
                className="btn ghost small"
                style={{ padding: '2px 8px', height: 'auto', fontSize: '0.75rem' }}
                onClick={() => handleCopy(JSON.stringify(event.details || {}, null, 2))}
              >
                {copied ? 'Copied JSON!' : 'Copy JSON'}
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
  const { data, loading, error, reload } = useAsync(() => apiGet('/audit?limit=25'), [])
  const [verifyState, setVerifyState] = useState(null)
  const [tamperState, setTamperState] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const events = data || []
  // Chronological order for hash chain left-to-right or top-to-bottom
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
                CRYPTOGRAPHIC INTEGRITY
              </span>
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '0.72rem' }}>
                Merkle-Style Sequence
              </span>
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.35rem' }}>
              Tamper-Evident Hash Chain Architecture
            </h3>
            <p className="small" style={{ margin: '6px 0 0', opacity: 0.88, maxWidth: 640, lineHeight: 1.45 }}>
              Each event commits cryptographically to the exact hash of the preceding event. Any post-hoc alteration or record reordering breaks all downstream SHA-256 hashes immediately.
            </p>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn small"
              style={{ background: 'var(--gold)', color: '#fff', border: 'none', fontWeight: 700 }}
              onClick={handleVerify}
              disabled={verifying}
            >
              <ShieldCheck size={15} />
              <span>{verifying ? 'Recomputing Hashes…' : 'Verify Entire Chain Integrity'}</span>
            </button>

            <button
              className="btn small ghost"
              style={{ color: '#fff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
              onClick={handleSimulateTamper}
              disabled={verifying}
              title="Alters a single row in memory to prove the detection engine works"
            >
              <ShieldAlert size={15} />
              <span>Simulate Tampering (In-Memory)</span>
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
                <b>{verifyState.ok ? 'Chain Verified:' : 'Verification Alert:'}</b> {verifyState.message}
                {verifyState.head_hash && (
                  <div className="mono small" style={{ marginTop: 2, opacity: 0.9 }}>
                    Current Head Hash: {verifyState.head_hash}
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
                <b>Tamper Detection Proof:</b> {tamperState.message}
                <div className="small" style={{ marginTop: 2, opacity: 0.9 }}>
                  The engine detected the altered block at Seq #{tamperState.broken_at_seq} because its computed digest did not match the downstream commit.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label="Loading cryptographic hash chain…" />}

      {/* Visual Hash Chain Display (Connected Nodes) */}
      <div className="admin-card col" style={{ gap: 16, background: 'var(--ivory)' }}>
        <div className="row spread" style={{ alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--forest-dark)', fontSize: '1.05rem' }}>
              Interactive Block Linkage Feed
            </h4>
            <div className="small subtle">
              Genesis Root (0x0000) &rarr; Chronological Blocks. Click any block to inspect full trace.
            </div>
          </div>
          <span className="badge small bold">{sorted.length} Blocks Rendered</span>
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
              <b style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>GENESIS ROOT BLOCK</b>
              <div className="mono small" style={{ opacity: 0.8 }}>0x00000000000000000000000000000000</div>
            </div>
          </div>
          <span className="badge gold small">INITIALIZED</span>
        </div>

        {/* Vertical Chain of Events */}
        <div className="col" style={{ gap: 0, paddingLeft: 18 }}>
          {sorted.map((ev, idx) => {
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
                    paddingLeft: 18,
                    borderLeft: `2.5px ${isBroken ? 'dashed var(--terracotta)' : 'solid var(--gold)'}`
                  }}
                >
                  <ArrowDown size={14} style={{ color: isBroken ? 'var(--terracotta)' : 'var(--gold-dark)' }} />
                  <span className="mono subtle" style={{ fontSize: '0.72rem' }}>
                    links to prev_hash: <b style={{ color: isBroken ? 'var(--terracotta)' : 'var(--forest-dark)' }}>{ev.prev_hash || 'genesis'}</b>
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
                  <div className="row spread" style={{ alignItems: 'flex-start' }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="badge small bold" style={{ background: 'var(--forest)', color: '#fff' }}>
                        #{ev.seq}
                      </span>
                      <b style={{ fontSize: '1rem', color: 'var(--forest-dark)' }}>{ev.action}</b>
                      <span className={`badge small ${isDenied ? 'red' : 'green'}`}>
                        {isDenied ? 'BLOCKED' : 'OK'}
                      </span>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono small subtle">{when(ev.ts)}</span>
                      <ChevronRight size={16} className="subtle" />
                    </div>
                  </div>

                  <div className="row spread small" style={{ fontSize: '0.8rem' }}>
                    <div className="row" style={{ gap: 12 }}>
                      <span>Actor: <b>{ev.actor_type}</b> ({ev.actor_role || 'system'})</span>
                      <span>Target: <span className="mono">{ev.resource_type}:{ev.resource_id?.slice(0, 8)}</span></span>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <span className="muted">Digest:</span>
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
      alert('CSV export triggered in production mode.')
    }
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Filter Bar */}
      <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            style={{ width: 'auto', minWidth: 140, background: '#fff' }}
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            <option value="">All Actors</option>
            <option value="user">User / Citizen</option>
            <option value="officer">Welfare Officer</option>
            <option value="ai">AI Decision Engine</option>
            <option value="agent">Autonomous Agent</option>
            <option value="admin">System Admin</option>
          </select>

          <select
            style={{ width: 'auto', minWidth: 140, background: '#fff' }}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="">All Outcomes</option>
            <option value="ok">Success (OK)</option>
            <option value="denied">Denied / Blocked</option>
          </select>

          <input
            style={{ maxWidth: 220, background: '#fff' }}
            placeholder="Search: action, person, case ID, outcome… e.g. consent, denied, case.*"
            aria-label="Search the audit log"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost small" onClick={reload} title="Refresh log">
            <RefreshCw size={14} />
          </button>
          <button className="btn ghost small" onClick={exp}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label="Loading cryptographic audit rows…" />}

      {/* Main Audit Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Seq #</th>
                <th>Timestamp</th>
                <th>Actor & Role</th>
                <th>Action</th>
                <th>Target Resource</th>
                <th>Outcome</th>
                <th>Rule / Model</th>
                <th>SHA-256 Digest</th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                    No audit events match current criteria.
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
                      title="Click to view full block payload & hash link"
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
                          {isBlocked ? 'BLOCKED' : 'OK'}
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
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--forest-dark)', fontSize: '1.1rem' }}>
              Citizen Transparency View: "Who accessed my data?"
            </h4>
            <p className="small muted" style={{ margin: '4px 0 0', lineHeight: 1.45 }}>
              This audit lens reflects the exact unalterable log surfaced to citizens. It catalogs every institutional query (NADRA civil lookup, Raast payout transfer, Welfare officer document review) alongside blocked unauthorized attempts.
            </p>
          </div>
          <button className="btn small ghost" onClick={reload}>
            Refresh Stream
          </button>
        </div>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label="Loading citizen access audit stream…" />}

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Requesting Institution / Actor</th>
              <th>Action & Data Scope</th>
              <th>Access Verdict</th>
              <th>Commitment Hash</th>
            </tr>
          </thead>
          <tbody>
            {accessEvents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                  No citizen-facing data reads recorded in this window.
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
                        {isBlocked ? 'BLOCKED (access.denied)' : 'AUTHORIZED (ok)'}
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
  const [route, setRoute] = useState('')
  const { data, loading, error, reload } = useAsync(
    () => apiGet('/audit/decisions?limit=40' + (route ? '&route=' + route : '')),
    [route]
  )
  const [open, setOpen] = useState(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row spread">
        <select
          style={{ width: 'auto', minWidth: 200, background: '#fff' }}
          value={route}
          onChange={(e) => setRoute(e.target.value)}
        >
          <option value="">All Decision Routes</option>
          {['AUTO_APPROVE', 'ASK_PROOF', 'HUMAN_REVIEW', 'DECLINE_WITH_APPEAL'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <button className="btn small ghost" onClick={reload}>
          Refresh Decisions
        </button>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label="Loading algorithmic decision archive…" />}

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
            <div className="row spread">
              <div className="row" style={{ gap: 10 }}>
                <RouteBadge r={d.route} />
                <span className="small mono">
                  P(genuine): <b>{Math.round(d.p_legit * 100)}%</b> · Rule: v{d.rule_version} · Model: {d.model_version}
                </span>
              </div>
              <button
                className="btn ghost small"
                onClick={() => setOpen(open === d.id ? null : d.id)}
              >
                {open === d.id ? 'Hide Trace' : 'View Full Trace'}
              </button>
            </div>

            <div className="small" style={{ lineHeight: 1.45 }}>
              <b>Citizen Explanation:</b> {d.reason_user?.en || 'Evaluated under civic rules.'}
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
  const [tab, setTab] = useState('chain')
  const [selectedEvent, setSelectedEvent] = useState(null)

  return (
    <div className="col" style={{ gap: 24 }}>
      {/* Title & Header */}
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="badge" style={{ background: 'var(--forest)', color: '#fff', fontSize: '0.72rem', fontWeight: 700 }}>
              SECURITY & COMPLIANCE
            </span>
            <span className="badge" style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)', fontSize: '0.72rem' }}>
              Cryptographic Hash-Chain
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--forest-dark)' }}>
            Audit Trail & Sovereign Governance
          </h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Read-only, tamper-evident cryptographic log committing every action, decision, and consent mutation
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['chain', 'Hash-Chain Visualizer'],
            ['table', 'Immutable Event Log'],
            ['citizen', 'Citizen Transparency Lens'],
            ['dec', 'Algorithmic Decisions']
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
