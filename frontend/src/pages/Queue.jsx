import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare,
  RefreshCw,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Clock
} from 'lucide-react'
import { apiGet, money, pct, when } from '../api'
import { ErrorBox, RouteBadge, Spinner, StatusBadge, useAsync, Bar } from '../ui'

const PRI = {
  1: ['P1 Urgent', 'red'],
  2: ['P2 High', 'amber'],
  3: ['P3 Normal', 'blue'],
  4: ['P4 Low', 'grey']
}

export default function Queue() {
  const [sort, setSort] = useState('priority')
  const [waiting, setWaiting] = useState(false)
  const { data, loading, error, reload } = useAsync(
    () => apiGet(`/queue?sort=${sort}&include_waiting=${waiting}`),
    [sort, waiting]
  )

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Header and Filter Controls */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Review Queue</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Cases where the autonomous decision engine abstained or flagged uncertainty for human-in-the-loop oversight
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <label
            className="row small"
            style={{
              margin: 0,
              gap: 8,
              cursor: 'pointer',
              background: 'var(--paper)',
              padding: '8px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <input
              type="checkbox"
              style={{ width: 16, height: 16, minHeight: 16, margin: 0 }}
              checked={waiting}
              onChange={(e) => setWaiting(e.target.checked)}
            />
            <span>Include awaiting proof</span>
          </label>

          <select
            style={{ width: 'auto', minWidth: 160 }}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="priority">Sort: Priority (P1 first)</option>
            <option value="confidence">Sort: Least confident first</option>
            <option value="age">Sort: Oldest first</option>
          </select>

          <button
            className="btn ghost icon-btn"
            onClick={reload}
            title="Refresh queue"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label="Refreshing triage queue…" />}

      {data && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Case Identifier</th>
                <th>Status</th>
                <th>System Route</th>
                <th>P(Genuine)</th>
                <th>Uncertainty Driver</th>
                <th>Disbursement</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={'badge ' + (PRI[c.priority]?.[1] || 'grey')}>
                      {PRI[c.priority]?.[0] || 'P3 Normal'}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={'/s/case/' + c.id}
                      className="mono"
                      style={{ fontWeight: 700, textDecoration: 'none' }}
                    >
                      #{c.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge s={c.status} />
                  </td>
                  <td>
                    <RouteBadge r={c.route} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div className="row spread small mono" style={{ marginBottom: 4 }}>
                      <span>{pct(c.p_legit)}</span>
                    </div>
                    <Bar
                      value={c.p_legit ?? 0}
                      color={
                        c.p_legit > 0.9
                          ? 'var(--forest)'
                          : c.p_legit > 0.5
                            ? 'var(--gold)'
                            : 'var(--terracotta)'
                      }
                    />
                  </td>
                  <td className="small" style={{ maxWidth: 260 }}>
                    {c.headline || 'General manual review required'}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {money(c.amount)}
                  </td>
                  <td className="small subtle">{when(c.created_at)}</td>
                  <td>
                    <Link
                      to={'/s/case/' + c.id}
                      className="btn ghost small"
                      style={{ padding: '4px 8px' }}
                    >
                      <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px 16px' }}>
                    <div className="col" style={{ alignItems: 'center', gap: 6 }}>
                      <CheckSquare size={36} className="subtle" />
                      <b style={{ color: 'var(--forest-dark)' }}>Queue is clear</b>
                      <span className="small subtle">
                        No cases currently pending human adjudication.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
