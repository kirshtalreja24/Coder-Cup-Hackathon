import { useState } from 'react'
import { apiGet, BASE, getToken, when } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync, RouteBadge } from '../ui'

function Log() {
  const [action, setAction] = useState('')
  const [outcome, setOutcome] = useState('')
  const [actor, setActor] = useState('')
  const qs = new URLSearchParams({ limit: 150, ...(action && { action }), ...(outcome && { outcome }), ...(actor && { actor_type: actor }) }).toString()
  const { data, loading, error, reload } = useAsync(() => apiGet('/audit?' + qs), [qs])
  const exp = async () => { const r = await fetch(BASE + '/audit/export.csv', { headers: { Authorization: 'Bearer ' + getToken() } }); const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'audit.csv'; a.click() }
  return (
    <div className="col"><div className="row"><select style={{ width: 'auto' }} value={actor} onChange={(e) => setActor(e.target.value)}><option value="">all actors</option><option value="user">user</option><option value="ai">AI</option><option value="agent">agent</option><option value="system">system</option></select>
      <select style={{ width: 'auto' }} value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">all outcomes</option><option value="ok">ok</option><option value="denied">denied</option></select>
      <input style={{ maxWidth: 240 }} placeholder="action e.g. consent.* or ai.*" value={action} onChange={(e) => setAction(e.target.value)} /><button className="ghost small" onClick={reload}>↻</button><button className="ghost small" onClick={exp}>⬇ CSV</button></div>
      <ErrorBox e={error} />{loading && <Spinner />}
      <div className="card table-wrap"><table><thead><tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Outcome</th><th>Details</th><th>Hash</th></tr></thead><tbody>
        {data?.map((e) => <tr key={e.seq}><td>{e.seq}</td><td className="small">{when(e.ts)}</td><td><span className={'badge ' + ({ ai: 'blue', agent: 'amber', system: 'grey' }[e.actor_type] || '')}>{e.actor_type}{e.actor_role ? ':' + e.actor_role : ''}</span></td><td className="mono">{e.action}</td><td className="small mono">{e.resource_type} {e.resource_id?.slice(0, 8)}</td>
          <td><span className={'badge ' + (e.outcome === 'denied' ? 'red' : '')}>{e.outcome}</span></td><td className="small mono" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{JSON.stringify(e.details).slice(0, 110)}</td><td className="mono muted">{e.hash}</td></tr>)}</tbody></table></div></div>
  )
}

function Verify() {
  const [res, setRes] = useState(null)
  const [tamper, setTamper] = useState(null)
  const [err, setErr] = useState(null)
  const run = async () => { try { setRes(await apiGet('/audit/verify')) } catch (e) { setErr(e) } }
  const sim = async () => { try { const l = await apiGet('/audit?limit=20'); setTamper(await apiGet('/audit/verify?simulate_tamper_seq=' + l.at(-1).seq)) } catch (e) { setErr(e) } }
  return (
    <div className="col"><div className="card col"><h3>🔗 Tamper-evident hash chain</h3><p className="small muted">Every audit row stores the hash of the previous row. Changing, deleting or reordering any past event breaks every hash after it.</p>
      <div className="row"><button onClick={run}>Verify the whole chain</button><button className="ghost" onClick={sim}>🧪 Prove detection: tamper with one row (in memory only)</button></div><ErrorBox e={err} />
      {res && <div className={'banner ' + (res.ok ? 'ok' : 'bad')}>{res.ok ? '✅' : '❌'} {res.message}{res.head_hash && <div className="mono small">head {res.head_hash.slice(0, 32)}…</div>}</div>}
      {tamper && <div className={'banner ' + (tamper.ok ? 'bad' : 'ok')}>{tamper.ok ? '❌ Tampering NOT detected!' : '✅ Tampering detected: ' + tamper.message}</div>}</div></div>
  )
}

function Consents() {
  const { data, loading, error } = useAsync(() => apiGet('/audit/consents'), [])
  return <div className="card table-wrap">{loading && <Spinner />}<ErrorBox e={error} /><table><thead><tr><th>Granted</th><th>Subject</th><th>Grantee</th><th>Scope</th><th>Status</th><th>Withdrawn</th><th>Receipt</th></tr></thead><tbody>
    {data?.map((c) => <tr key={c.id}><td className="small">{when(c.granted_at)}</td><td className="mono">{c.subject}</td><td>{c.grantee_type}:{c.grantee.slice(0, 12)}</td><td>{c.scope}</td><td><span className={'badge ' + (c.status === 'active' ? '' : 'red')}>{c.status}</span></td><td className="small">{when(c.withdrawn_at)}</td><td className="mono muted">{c.receipt?.slice(0, 12)}</td></tr>)}</tbody></table></div>
}

function Decisions() {
  const [route, setRoute] = useState('')
  const { data, loading, error } = useAsync(() => apiGet('/audit/decisions?limit=40' + (route ? '&route=' + route : '')), [route])
  const [open, setOpen] = useState(null)
  return <div className="col"><select style={{ width: 'auto' }} value={route} onChange={(e) => setRoute(e.target.value)}><option value="">all routes</option>{['AUTO_APPROVE', 'ASK_PROOF', 'HUMAN_REVIEW', 'DECLINE_WITH_APPEAL'].map((r) => <option key={r}>{r}</option>)}</select>
    <ErrorBox e={error} />{loading && <Spinner />}
    {data?.map((d) => <div key={d.id} className="card col"><div className="row spread"><div className="row"><RouteBadge r={d.route} /><span className="small">P(genuine) {Math.round(d.p_legit * 100)}% · rule v{d.rule_version} · {d.model_version}</span></div><button className="ghost small" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'hide' : 'full trace'}</button></div>
      <div className="small"><b>User sees:</b> {d.reason_user?.en}</div>{open === d.id && <Json data={d.trace} />}</div>)}</div>
}

export default function Audit() {
  const [tab, setTab] = useState('log')
  return <div className="col"><h2>🔎 Audit <span className="muted small">· read-only · personal identifiers masked</span></h2>
    <Tabs value={tab} onChange={setTab} tabs={[['log', 'Event log'], ['verify', 'Verify chain'], ['dec', 'AI decisions'], ['cons', 'Consent records']]} />
    {tab === 'log' && <Log />}{tab === 'verify' && <Verify />}{tab === 'dec' && <Decisions />}{tab === 'cons' && <Consents />}</div>
}
