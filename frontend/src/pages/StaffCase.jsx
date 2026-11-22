import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Camera,
  UserCheck,
  ShieldAlert,
  FileText,
  AlertTriangle,
  Lock,
  Eye,
  Clock,
  Sparkles,
  ExternalLink,
  HelpCircle
} from 'lucide-react'
import { api, apiGet, apiPost, getUser, money, pct, when, BASE, getToken } from '../api'
import { ErrorBox, Json, MockTag, RouteBadge, Spinner, StatusBadge, Tabs, useAsync } from '../ui'
import { useLang } from '../i18n'

function DocImage({ id }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let url
    fetch(BASE + `/documents/${id}/file`, {
      headers: { Authorization: 'Bearer ' + getToken() }
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b)
          setSrc(url)
        }
      })
    return () => url && URL.revokeObjectURL(url)
  }, [id])

  return src ? (
    <img
      src={src}
      alt="Document evidence"
      style={{
        maxWidth: '100%',
        borderRadius: 'var(--radius-md)',
        maxHeight: 260,
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)'
      }}
    />
  ) : (
    <span className="small subtle">Image preview unavailable</span>
  )
}

export default function StaffCase() {
  const { id } = useParams()
  const { t, rtl, localize } = useLang()
  const me = getUser()
  const c = useAsync(() => apiGet('/cases/' + id), [id])
  const dec = useAsync(() => apiGet(`/cases/${id}/decision`).catch(() => null), [id])
  const tl = useAsync(() => apiGet(`/cases/${id}/timeline`), [id])
  const docs = useAsync(() => apiGet(`/cases/${id}/documents`).catch((e) => ({ denied: e })), [id])
  const [tab, setTab] = useState('brief')
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const reloadAll = () => {
    c.reload()
    dec.reload()
    tl.reload()
    docs.reload()
  }

  const act = async (fn) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      reloadAll()
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  if (c.loading) return <Spinner label="Loading case dossier…" />
  if (c.error) return <ErrorBox e={c.error} />
  const x = c.data,
    brief = x.handoff_brief,
    tr = dec.data?.trace
  const canAct = me.role === 'officer' && !['paid', 'closed', 'rejected'].includes(x.status)

  return (
    <div className={`col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ gap: 20 }}>
      {/* Dossier Header */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <Link
            to="/s/queue"
            className="row small subtle"
            style={{ textDecoration: 'none', gap: 6, marginBottom: 8 }}
          >
            <ArrowLeft size={14} />
            <span>{localize('قطار پر واپس جائیں', 'Queue par wapis', 'Back to Queue')}</span>
          </Link>
          <div className="row" style={{ gap: 12 }}>
            <h2 style={{ margin: 0 }}>Case #{x.id.slice(0, 8)}</h2>
            <StatusBadge s={x.status} />
            {dec.data && <RouteBadge r={dec.data.route} />}
          </div>
        </div>

        <div className="small subtle">Opened: {when(x.created_at)}</div>
      </div>

      {x.redacted && (
        <div className="banner bad">
          <Lock size={18} />
          <div>
            <b>Personal Data Redacted:</b>{' '}
            {x.redaction_reason || 'Citizen has not shared or has withdrawn active consent.'} Action blocked until consent is restored. (Logged in tamper-evident audit).
          </div>
        </div>
      )}

      {x.masked && (
        <div className="banner info">
          <Eye size={18} />
          <div>Personal identifiers (CNIC, phone, address) are masked for your role under privacy regulations.</div>
        </div>
      )}

      <ErrorBox e={err} />

      {/* Grid: AI Handoff Brief & Submitted Data */}
      <div className="grid g2">
        {/* Handoff Intelligence */}
        <div className="card col" style={{ gap: 14 }}>
          <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>AI Handoff Brief</h3>
            {brief?.headline && <span className="badge blue">{brief.headline}</span>}
          </div>

          {brief ? (
            <div className="col" style={{ gap: 12 }}>
              <div>
                <b className="small" style={{ color: 'var(--forest-dark)' }}>
                  Why the System Stopped:
                </b>
                <p className="small" style={{ margin: '4px 0 0' }}>
                  {brief.why_unsure}
                </p>
              </div>

              {brief.what_we_doubt?.length > 0 && (
                <div>
                  <b className="small" style={{ color: 'var(--terracotta-dark)' }}>
                    Specific Uncertainties & Doubts:
                  </b>
                  <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                    {brief.what_we_doubt.map((d, i) => (
                      <li key={i} className="small">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.what_we_know?.length > 0 && (
                <details>
                  <summary className="small subtle" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    Verified Ground Truths ({brief.what_we_know.length})
                  </summary>
                  <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                    {brief.what_we_know.map((d, i) => (
                      <li key={i} className="small">
                        {d}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {brief.suggested_questions?.length > 0 && (
                <div>
                  <b className="small" style={{ color: 'var(--blue)' }}>
                    Suggested Officer Inquiries:
                  </b>
                  <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                    {brief.suggested_questions.map((d, i) => (
                      <li key={i} className="small">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.citizen_note && (
                <div className="banner info small">
                  <b>Citizen Note:</b> {brief.citizen_note}
                </div>
              )}

              <div
                className="card flat small"
                style={{
                  background: 'var(--ivory-alt)',
                  border: '1px solid var(--border-subtle)',
                  padding: 10
                }}
              >
                Expected loss if auto-approved:{' '}
                <b className="mono">{money(brief.expected_cost_if_auto_approved_pkr)}</b> vs review cost:{' '}
                <b className="mono">{money(brief.expected_cost_if_reviewed_pkr)}</b>.
              </div>
            </div>
          ) : (
            <p className="small muted">
              No handoff brief recorded for this claim (decision routed automatically or data restricted).
            </p>
          )}
        </div>

        {/* Submitted Data & Document Analysis */}
        <div className="card col" style={{ gap: 14 }}>
          <div className="card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Claimant Submission & Evidence</h3>
          </div>

          {x.data ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {Object.entries(x.data)
                    .filter(([, v]) => v !== null && v !== '')
                    .map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ width: '40%' }}>{k}</th>
                        <td className="mono">{String(v)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">Data withheld under privacy regulations.</p>
          )}

          {docs.data?.length > 0 &&
            docs.data.map((d) => (
              <div
                key={d.id}
                className="col"
                style={{
                  gap: 8,
                  padding: 12,
                  background: 'var(--ivory-alt)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <DocImage id={d.id} />
                <div className="row spread small">
                  <span>
                    Authenticity Score: <b>{d.analysis?.authenticity ?? '-'}</b>
                  </span>
                  {d.analysis?.flag && <span className="badge red">{d.analysis.flag}</span>}
                </div>
                {d.analysis?.flags?.map((f, i) => (
                  <div key={i} className="small subtle">
                    • {f}
                  </div>
                ))}
              </div>
            ))}

          {docs.data?.denied && (
            <p className="small muted">
              Document storage access denied: citizen has not granted document permission.
            </p>
          )}
        </div>
      </div>

      {/* Human-in-the-Loop Action Bar (for officers) */}
      {canAct && (
        <div className="card col" style={{ gap: 14, border: '1.5px solid var(--forest)' }}>
          <div>
            <h3 style={{ margin: 0 }}>Human Adjudication (Human-in-the-Loop)</h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Your determination is recorded in the permanent audit chain alongside your reasoning.
            </div>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mandatory reasoning or instruction for rejection / additional proof request…"
            style={{ minHeight: 90 }}
          />

          <div className="row" style={{ gap: 10 }}>
            <button
              disabled={busy || x.redacted}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/review`, { action: 'approve', note }))
              }
            >
              <CheckCircle2 size={16} />
              <span>Approve & Release</span>
              <MockTag>MOCK PAY</MockTag>
            </button>

            <button
              className="danger"
              disabled={busy || x.redacted}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/review`, { action: 'reject', note }))
              }
            >
              <XCircle size={16} />
              <span>Reject Claim</span>
            </button>

            <button
              className="warn"
              disabled={busy || x.redacted}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/review`, { action: 'request_proof', note }))
              }
            >
              <Camera size={16} />
              <span>Request Proof</span>
            </button>

            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => act(() => apiPost(`/cases/${id}/assign`))}
            >
              <UserCheck size={16} />
              <span>Assign to Me</span>
            </button>

            <button
              className="btn ghost"
              disabled={busy || note.length < 3}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/escalate`, { reason: note }))
              }
            >
              <ShieldAlert size={16} />
              <span>Escalate</span>
            </button>
          </div>
        </div>
      )}

      {/* Deep Inspection Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ['brief', 'Citizen Notice & Rationale'],
          ['trace', 'Algorithmic Decision Trace'],
          ['time', 'Audit Timeline']
        ]}
      />

      {tab === 'brief' && dec.data && (
        <div className="card col" style={{ gap: 12 }}>
          <h3 style={{ margin: 0 }}>Notice Presented to Claimant</h3>
          <p style={{ fontSize: '1.05rem', margin: 0 }}>{dec.data.reason_user?.en}</p>
          <p dir="rtl" style={{ fontSize: '1.15rem', margin: 0 }}>
            {dec.data.reason_user?.ur}
          </p>
          <div className="small subtle" style={{ marginTop: 8 }}>
            Decision ID: <code className="mono">{dec.data.id?.slice(0, 8)}</code> · Rule: v{dec.data.rule_version} · Model: {dec.data.model_version} · Confidence: {pct(dec.data.confidence)} · Timestamp: {when(dec.data.created_at)}
          </div>
        </div>
      )}

      {tab === 'trace' && tr && (
        <div className="col" style={{ gap: 16 }}>
          <div className="grid g2">
            <div className="card col" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>Action Cost Matrix (PKR Loss)</h3>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {Object.entries(tr.decision.action_costs).map(([k, v]) => (
                      <tr
                        key={k}
                        style={
                          k === tr.decision.route
                            ? { background: 'var(--sage-soft)', fontWeight: 600 }
                            : {}
                        }
                      >
                        <td>{k}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          PKR {Number(v).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small subtle">
                Auto-approve threshold: P ≥ {pct(tr.decision.thresholds?.auto_approve_min_p, 2)}.
                {tr.decision.override && <span> Override: <b>{tr.decision.override}</b></span>}
              </div>
            </div>

            <div className="card col" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>Rule Engine Trace (v{tr.rule.version})</h3>
              <div className="col" style={{ gap: 6 }}>
                {tr.rule.result?.trace?.map((r) => (
                  <div
                    key={r.id}
                    className="row spread small"
                    style={{
                      padding: '6px 10px',
                      background: 'var(--ivory-alt)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {r.passed === true ? (
                        <CheckCircle2 size={15} style={{ color: 'var(--evergreen)', flexShrink: 0 }} />
                      ) : r.passed === false ? (
                        <XCircle size={15} style={{ color: 'var(--terracotta)', flexShrink: 0 }} />
                      ) : (
                        <HelpCircle size={15} style={{ color: 'var(--champagne)', flexShrink: 0 }} />
                      )}
                      <span>{r.label}</span>
                    </span>
                    <span className="mono subtle">
                      actual: {JSON.stringify(r.actual)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card col" style={{ gap: 10 }}>
            <h3 style={{ margin: 0 }}>Identity Matching (Fellegi–Sunter Weights)</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Registry Attribute</th>
                    <th>Agreement Level</th>
                    <th>Log-Likelihood Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tr.identity?.fields || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ fontWeight: 500 }}>{k}</td>
                      <td>{v.level}</td>
                      <td className="mono">{v.weight}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--ivory-alt)', fontWeight: 700 }}>
                    <td>Total Match Weight</td>
                    <td>{tr.identity?.decision}</td>
                    <td className="mono">{tr.identity?.total_weight}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <details className="card" style={{ padding: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Raw JSON Execution Trace
            </summary>
            <div style={{ marginTop: 10 }}>
              <Json data={tr} />
            </div>
          </details>
        </div>
      )}

      {tab === 'time' && (
        <div className="card">
          <ul className="step-list">
            {tl.data?.events.map((e, i) => (
              <li key={i}>
                <div className="row spread">
                  <b style={{ color: 'var(--forest-dark)' }}>{e.kind}</b>
                  <span className="small subtle">{when(e.at)}</span>
                </div>
                {e.note && <div className="small muted" style={{ marginTop: 4 }}>{e.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
