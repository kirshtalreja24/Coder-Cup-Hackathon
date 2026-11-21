import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Filter, ChevronRight, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react'
import { apiGet, money, pct, when } from '../api'
import { ErrorBox, Spinner, StatusBadge, useAsync } from '../ui'

export default function StaffApplications() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { data, loading, error } = useAsync(() => apiGet('/cases?limit=150'), [])

  if (loading) return <Spinner label="Loading all departmental applications…" />
  if (error) return <ErrorBox e={error} />

  const cases = (data || []).filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.id.toLowerCase().includes(q) ||
      (c.data?.name && c.data.name.toLowerCase().includes(q)) ||
      (c.data?.cnic && c.data.cnic.includes(q))
    )
  })

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Header */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Relief Applications Registry</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Central repository of all citizen relief claims, verification status, and decision records
          </div>
        </div>
        <span className="badge">{cases.length} records found</span>
      </div>

      {/* Filter and Search Bar */}
      <div className="card row spread" style={{ padding: '14px 18px', gap: 12, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={18} className="subtle" />
          <input
            placeholder="Search by Case ID, Applicant Name, or CNIC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', border: 'none', background: 'transparent', padding: '4px 0' }}
          />
        </div>

        <div className="tabs-inline" style={{ margin: 0 }}>
          {[
            ['all', 'All'],
            ['awaiting_human', 'Awaiting Officer'],
            ['paid', 'Paid'],
            ['needs_proof', 'Needs Proof'],
            ['declined', 'Declined']
          ].map(([val, label]) => (
            <button
              key={val}
              className={filter === val ? 'on' : ''}
              onClick={() => setFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {cases.length === 0 ? (
          <div className="col" style={{ padding: '48px 20px', alignItems: 'center', textAlign: 'center' }}>
            <FileText size={40} className="subtle" />
            <b style={{ marginTop: 10, color: 'var(--forest-dark)' }}>No applications found</b>
            <span className="small subtle">Try clearing your search query or selecting another filter.</span>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Case Ref</th>
                <th>Citizen Details</th>
                <th>Declared Income</th>
                <th>Grant Amount</th>
                <th>Status</th>
                <th>AI P(Legit)</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--forest-dark)' }}>
                    #{c.id.slice(0, 8)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.data?.name || 'Verified Citizen'}</div>
                    <div className="small subtle mono">{c.data?.cnic || 'Masked on file'}</div>
                  </td>
                  <td>{c.data?.monthly_income ? money(c.data.monthly_income) : 'Low-Income'}</td>
                  <td>
                    <b>{money(c.amount || 25000)}</b>
                  </td>
                  <td>
                    <StatusBadge s={c.status} />
                  </td>
                  <td>
                    <span className="mono small" style={{ fontWeight: 700 }}>
                      {c.p_legit ? pct(c.p_legit) : '—'}
                    </span>
                  </td>
                  <td className="small subtle">{when(c.created_at)}</td>
                  <td>
                    <Link
                      to={`/s/case/${c.id}`}
                      className="btn small ghost"
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                      <span>Inspect</span>
                      <ChevronRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
