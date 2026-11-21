import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiGet, apiPost, getUser, money, pct, when, BASE, getToken } from '../api'
import { ErrorBox, Json, MockTag, RouteBadge, Spinner, StatusBadge, Tabs, useAsync } from '../ui'

function DocImage({ id }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { let url; fetch(BASE + `/documents/${id}/file`, { headers: { Authorization: 'Bearer ' + getToken() } }).then((r) => r.ok ? r.blob() : null).then((b) => { if (b) { url = URL.createObjectURL(b); setSrc(url) } }); return () => url && URL.revokeObjectURL(url) }, [id])
  return src ? <img src={src} alt="document" style={{ maxWidth: '100%', borderRadius: 10, maxHeight: 260 }} /> : <span className="muted small">image unavailable</span>
}

export default function StaffCase() {
  const { id } = useParams()
  const me = getUser()
  const c = useAsync(() => apiGet('/cases/' + id), [id])
  const dec = useAsync(() => apiGet(`/cases/${id}/decision`).catch(() => null), [id])
  const tl = useAsync(() => apiGet(`/cases/${id}/timeline`), [id])
  const docs = useAsync(() => apiGet(`/cases/${id}/documents`).catch((e) => ({ denied: e })), [id])
  const [tab, setTab] = useState('brief')
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const reloadAll = () => { c.reload(); dec.reload(); tl.reload(); docs.reload() }
  const act = async (fn) => { setBusy(true); setErr(null); try { await fn(); reloadAll() } catch (e) { setErr(e) } finally { setBusy(false) } }
  if (c.loading) return <Spinner />
  if (c.error) return <ErrorBox e={c.error} />
  const x = c.data, brief = x.handoff_brief, tr = dec.data?.trace
  const canAct = me.role === 'officer' && !['paid', 'closed', 'rejected'].includes(x.status)
  return (
    <div className="col">
      <div className="row spread"><h2>Case #{x.id.slice(0, 8)} <StatusBadge s={x.status} /> {dec.data && <RouteBadge r={dec.data.route} />}</h2><Link to="/s/queue">← Queue</Link></div>
      {x.redacted && <div className="banner bad">🔒 Personal data hidden: {x.redaction_reason || 'the citizen has not shared it, or has withdrawn consent.'} You cannot approve or reject until they share again. (Attempt logged in the audit trail.)</div>}
      {x.masked && <div className="banner info">🙈 Personal identifiers are masked for your role.</div>}
      <ErrorBox e={err} />
      <div className="grid g2">
        <div className="card col">
          <h3>🤝 Handoff brief {brief?.headline && <span className="badge blue">{brief.headline}</span>}</h3>
          {brief ? <>
            <p><b>Why the system stopped:</b> {brief.why_unsure}</p>
            {brief.what_we_doubt?.length > 0 && <><b>Doubts</b><ul>{brief.what_we_doubt.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
            {brief.what_we_know?.length > 0 && <details><summary><b>What we know</b> ({brief.what_we_know.length})</summary><ul>{brief.what_we_know.map((d, i) => <li key={i}>{d}</li>)}</ul></details>}
            {brief.suggested_questions?.length > 0 && <><b>Suggested questions</b><ul>{brief.suggested_questions.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
            {brief.citizen_note && <div className="banner info">Citizen's note: {brief.citizen_note}</div>}
            <div className="small muted">If auto-approved the expected loss would be <b>{money(brief.expected_cost_if_auto_approved_pkr)}</b>; reviewing costs {money(brief.expected_cost_if_reviewed_pkr)}.</div></>
            : <p className="muted">No handoff brief (this case was not routed to a human, or data is hidden).</p>}
        </div>
        <div className="card col">
          <h3>👤 Submitted data</h3>
          {x.data ? <table><tbody>{Object.entries(x.data).filter(([, v]) => v !== null && v !== '').map(([k, v]) => <tr key={k}><th>{k}</th><td>{String(v)}</td></tr>)}</tbody></table> : <p className="muted">Hidden.</p>}
          {docs.data?.length > 0 && docs.data.map((d) => <div key={d.id}><DocImage id={d.id} /><div className="small">authenticity <b>{d.analysis?.authenticity}</b> {d.analysis?.flag && <span className="badge red">{d.analysis.flag}</span>}</div>{d.analysis?.flags?.map((f, i) => <div key={i} className="small">• {f}</div>)}</div>)}
          {docs.data?.denied && <p className="muted small">Documents: access denied (no consent).</p>}
        </div>
      </div>

      {canAct && (
        <div className="card col"><h3>Decision (you are the human in the loop)</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the citizen / audit log (required for reject or request proof)" />
          <div className="row">
            <button disabled={busy || x.redacted} onClick={() => act(() => apiPost(`/cases/${id}/review`, { action: 'approve', note }))}>✅ Approve <MockTag>MOCK PAY</MockTag></button>
            <button className="danger" disabled={busy || x.redacted} onClick={() => act(() => apiPost(`/cases/${id}/review`, { action: 'reject', note }))}>⛔ Reject</button>
            <button className="warn" disabled={busy || x.redacted} onClick={() => act(() => apiPost(`/cases/${id}/review`, { action: 'request_proof', note }))}>📎 Request proof</button>
            <button className="ghost" disabled={busy} onClick={() => act(() => apiPost(`/cases/${id}/assign`))}>🙋 Assign to me</button>
            <button className="ghost" disabled={busy || note.length < 3} onClick={() => act(() => apiPost(`/cases/${id}/escalate`, { reason: note }))}>🚨 Escalate</button>
          </div></div>)}

      <Tabs value={tab} onChange={setTab} tabs={[['brief', 'Explanation'], ['trace', 'Full auditor trace'], ['time', 'Timeline']]} />
      {tab === 'brief' && dec.data && <div className="card col"><h3>Reason shown to the citizen</h3><p>{dec.data.reason_user?.en}</p><p dir="rtl" style={{ fontSize: '1.1rem' }}>{dec.data.reason_user?.ur}</p><p className="small muted">Decision {dec.data.id?.slice(0, 8)} · rule v{dec.data.rule_version} · model {dec.data.model_version} · confidence {pct(dec.data.confidence)} · {when(dec.data.created_at)}</p></div>}
      {tab === 'trace' && tr && <div className="col">
        <div className="grid g2"><div className="card"><h3>📐 Expected cost of each action (PKR)</h3><table><tbody>{Object.entries(tr.decision.action_costs).map(([k, v]) => <tr key={k} style={k === tr.decision.route ? { background: 'var(--green-soft)' } : {}}><td>{k}</td><td><b>{Number(v).toLocaleString()}</b></td></tr>)}</tbody></table><p className="small muted">Auto-approve needs P ≥ {pct(tr.decision.thresholds.auto_approve_min_p, 2)}. {tr.decision.override && <>Override: <b>{tr.decision.override}</b></>}</p></div>
          <div className="card"><h3>📜 Rule v{tr.rule.version}</h3>{tr.rule.result.trace.map((r) => <div key={r.id} className="small">{r.passed === true ? '✅' : r.passed === false ? '❌' : '❓'} {r.label} <span className="muted">(actual {JSON.stringify(r.actual)})</span></div>)}</div></div>
        <div className="card"><h3>🪪 Identity evidence (Fellegi–Sunter)</h3><div className="table-wrap"><table><thead><tr><th>Field</th><th>Agreement</th><th>Weight</th></tr></thead><tbody>{Object.entries(tr.identity.fields).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.level}</td><td>{v.weight}</td></tr>)}<tr><th>Total</th><th>{tr.identity.decision}</th><th>{tr.identity.total_weight}</th></tr></tbody></table></div></div>
        <details className="card"><summary>Raw JSON trace (input, rule version, model version, confidence, result)</summary><Json data={tr} /></details></div>}
      {tab === 'time' && <div className="card"><ul className="step-list">{tl.data?.events.map((e, i) => <li key={i}><b>{e.kind}</b> · {when(e.at)}{e.note && <div className="small">{e.note}</div>}</li>)}</ul></div>}
    </div>
  )
}
