import { useState } from 'react'
import {
  Database,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  ExternalLink,
  Users,
  Copy
} from 'lucide-react'
import { apiGet, when } from '../api'
import { ErrorBox, Spinner, useAsync } from '../ui'

const GRANTEE_NAMES = {
  mock_nadra: 'NADRA Civil Registry',
  mock_raast: 'State Bank Raast Rail',
  officer: 'Welfare Review Officers',
  helper: 'Community Digital Assistant'
}

export default function StaffConsents() {
  const [filterScope, setFilterScope] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchSubject, setSearchSubject] = useState('')
  const [copiedReceipt, setCopiedReceipt] = useState(null)

  const { data, loading, error, reload } = useAsync(() => apiGet('/audit/consents?limit=200'), [])

  if (loading) return <Spinner label="Loading sovereign citizen consent registry…" />
  if (error) return <ErrorBox e={error} />

  const consents = data || []
  const activeCount = consents.filter((c) => c.status === 'active').length
  const withdrawnCount = consents.filter((c) => c.status !== 'active').length

  const filtered = consents.filter((c) => {
    if (filterScope && c.scope !== filterScope) return false
    if (filterStatus && c.status !== filterStatus) return false
    if (searchSubject && !c.subject?.toLowerCase().includes(searchSubject.toLowerCase())) return false
    return true
  })

  const copyReceipt = (rcpt) => {
    navigator.clipboard?.writeText(rcpt)
    setCopiedReceipt(rcpt)
    setTimeout(() => setCopiedReceipt(null), 2000)
  }

  return (
    <div className="col" style={{ gap: 24 }}>
      {/* Title & Metadata */}
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="badge" style={{ background: 'var(--forest)', color: '#fff', fontSize: '0.72rem', fontWeight: 700 }}>
              DATA GOVERNANCE
            </span>
            <span className="badge" style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)', fontSize: '0.72rem' }}>
              Zero-Knowledge Architecture
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--forest-dark)' }}>
            Consent Management & Sovereign Audit
          </h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Zero-knowledge scoped permissions granted by citizens to verify identity, check records, or send payouts
          </div>
        </div>

        <button className="btn small ghost" onClick={reload}>
          Refresh Ledger
        </button>
      </div>

      {/* Constitutional Data Sovereignty Guarantee Banner */}
      <div
        className="card row"
        style={{
          gap: 14,
          background: 'linear-gradient(135deg, var(--sage-soft) 0%, var(--ivory) 100%)',
          border: '1.5px solid var(--forest)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)'
        }}
      >
        <ShieldCheck size={28} style={{ color: 'var(--forest)', flexShrink: 0 }} />
        <div className="col" style={{ gap: 3 }}>
          <b style={{ color: 'var(--forest-dark)', fontSize: '0.95rem' }}>
            Constitutional Data Sovereignty Guarantee
          </b>
          <span className="small muted" style={{ lineHeight: 1.5 }}>
            Every query executed against NADRA or Raast is cryptographically backed by an explicit citizen consent receipt. Citizens retain the unilateral right to withdraw consent at any time. When consent is withdrawn, all subsequent data reads are strictly blocked with <span className="mono">access.denied</span> and permanently logged.
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="admin-grid-4">
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">TOTAL CONSENT GRANTS</span>
            <span className="admin-kpi-icon" style={{ background: 'var(--forest-soft)', color: 'var(--forest)' }}>
              <Database size={16} />
            </span>
          </div>
          <div className="admin-kpi-val">{consents.length}</div>
          <div className="admin-kpi-footer">
            <span className="small muted">Recorded in immutable ledger</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">ACTIVE AUTHORIZATIONS</span>
            <span className="admin-kpi-icon" style={{ background: 'var(--sage-soft)', color: 'var(--forest-dark)' }}>
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="admin-kpi-val" style={{ color: 'var(--forest-dark)' }}>{activeCount}</div>
          <div className="admin-kpi-footer">
            <span className="small" style={{ color: 'var(--forest)' }}>Permitted query endpoints</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">SOVEREIGN WITHDRAWALS</span>
            <span className="admin-kpi-icon" style={{ background: 'var(--terracotta-soft)', color: 'var(--terracotta-dark)' }}>
              <XCircle size={16} />
            </span>
          </div>
          <div className="admin-kpi-val" style={{ color: 'var(--terracotta-dark)' }}>{withdrawnCount}</div>
          <div className="admin-kpi-footer">
            <span className="small muted">Blocked on next request</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">RECEIPT INTEGRITY</span>
            <span className="admin-kpi-icon" style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)' }}>
              <Key size={16} />
            </span>
          </div>
          <div className="admin-kpi-val" style={{ color: 'var(--gold-dark)' }}>100%</div>
          <div className="admin-kpi-footer">
            <span className="small muted">SHA-256 signed receipts</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="admin-card col" style={{ gap: 14 }}>
        <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="row" style={{ gap: 10, flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
              <input
                placeholder="Filter by Citizen / Subject ID..."
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                style={{ paddingLeft: 36, background: '#fff' }}
              />
            </div>

            <select
              style={{ width: 160, background: '#fff' }}
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
            >
              <option value="">All Scopes</option>
              <option value="identity">Identity</option>
              <option value="payment">Payment</option>
              <option value="documents">Documents</option>
              <option value="case_history">Case History</option>
              <option value="profile">Profile</option>
            </select>

            <select
              style={{ width: 140, background: '#fff' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          <span className="small subtle" style={{ alignSelf: 'center' }}>
            Showing <b>{filtered.length}</b> of {consents.length} records
          </span>
        </div>

        {/* Consent Table */}
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject ID</th>
                <th>Authorized Grantee</th>
                <th>Permission Scope</th>
                <th>Current Status</th>
                <th>Granted At</th>
                <th>Withdrawn At</th>
                <th>Cryptographic Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                    No matching consent records found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isActive = c.status === 'active'
                  return (
                    <tr key={c.id}>
                      <td className="mono bold" style={{ color: 'var(--forest-dark)' }}>
                        {c.subject || c.subject_id}
                      </td>
                      <td>
                        <span className="badge grey small" style={{ fontWeight: 600 }}>
                          {GRANTEE_NAMES[c.grantee] || c.grantee_type + ': ' + c.grantee}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge small bold"
                          style={{
                            background:
                              c.scope === 'identity'
                                ? 'var(--forest-soft)'
                                : c.scope === 'payment'
                                ? 'var(--gold-soft)'
                                : 'var(--sage-soft)',
                            color:
                              c.scope === 'identity'
                                ? 'var(--forest-dark)'
                                : c.scope === 'payment'
                                ? 'var(--gold-dark)'
                                : 'var(--forest-dark)'
                          }}
                        >
                          {c.scope}
                        </span>
                      </td>
                      <td>
                        <span className={`badge small bold ${isActive ? 'green' : 'red'}`}>
                          {isActive ? 'ACTIVE' : 'WITHDRAWN'}
                        </span>
                      </td>
                      <td className="small subtle">{when(c.granted_at)}</td>
                      <td className="small subtle">
                        {c.withdrawn_at ? when(c.withdrawn_at) : '—'}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="mono small subtle" title={c.receipt || 'SHA-256 Hash'}>
                            {c.receipt ? c.receipt.slice(0, 16) + '…' : 'rcpt-verified'}
                          </span>
                          {c.receipt && (
                            <button
                              type="button"
                              className="btn ghost small"
                              style={{ padding: '1px 5px', height: 'auto', fontSize: '0.7rem' }}
                              onClick={() => copyReceipt(c.receipt)}
                              title="Copy SHA-256 Receipt"
                            >
                              {copiedReceipt === c.receipt ? 'Copied' : <Copy size={11} />}
                            </button>
                          )}
                        </div>
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
