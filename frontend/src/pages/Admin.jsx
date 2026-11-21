import { useState } from 'react'
import { apiDel, apiGet, apiPost, apiPut, apiPatch, BASE } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync } from '../ui'

export default function Admin() {
  const [tab, setTab] = useState('users')
  return <div className="col"><h2>🛠️ Admin</h2>
    <Tabs value={tab} onChange={setTab} tabs={[['users', 'Users & roles'], ['keys', 'API keys'], ['hooks', 'Webhooks & jobs'], ['plan', 'Plan & usage']]} />
    {tab === 'users' && <Users />}{tab === 'keys' && <Keys />}{tab === 'hooks' && <Hooks />}{tab === 'plan' && <Plan />}</div>
}

function Users() {
  const u = useAsync(() => apiGet('/admin/users'), [])
  const [f, setF] = useState({ email: '', name: '', role: 'officer', password: '' })
  const [err, setErr] = useState(null)
  const [filter, setFilter] = useState('')
  const rows = (u.data || []).filter((x) => x.role !== 'citizen' || filter)
  return <div className="col"><div className="card col"><h3>Create staff user</h3><div className="row">
    <input placeholder="email" style={{ flex: 1 }} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><input placeholder="name" style={{ flex: 1 }} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
    <select style={{ width: 'auto' }} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{['citizen', 'helper', 'officer', 'admin', 'auditor'].map((r) => <option key={r}>{r}</option>)}</select>
    <input placeholder="password (8+)" type="password" style={{ flex: 1 }} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
    <button onClick={async () => { try { await apiPost('/admin/users', f); setF({ email: '', name: '', role: 'officer', password: '' }); u.reload() } catch (e) { setErr(e) } }}>Create</button></div><ErrorBox e={err} /></div>
    <div className="card table-wrap"><div className="row spread"><h3>Users</h3><label className="row small" style={{ margin: 0 }}><input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={!!filter} onChange={(e) => setFilter(e.target.checked ? '1' : '')} /> include citizens</label></div>
      {u.loading && <Spinner />}<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead><tbody>
        {rows.map((x) => <tr key={x.id}><td>{x.name}</td><td className="small">{x.email}</td><td><select style={{ width: 'auto', minHeight: 32 }} value={x.role} onChange={async (e) => { try { await apiPatch('/admin/users/' + x.id, { role: e.target.value }); u.reload() } catch (er) { setErr(er) } }}>{['citizen', 'helper', 'officer', 'admin', 'auditor'].map((r) => <option key={r}>{r}</option>)}</select></td>
          <td><button className={'small ' + (x.is_active ? 'ghost' : 'danger')} onClick={async () => { try { await apiPatch('/admin/users/' + x.id, { is_active: !x.is_active }); u.reload() } catch (er) { setErr(er) } }}>{x.is_active ? 'active' : 'disabled'}</button></td></tr>)}</tbody></table></div></div>
}

function Keys() {
  const k = useAsync(() => apiGet('/admin/api-keys'), [])
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState(null)
  const [err, setErr] = useState(null)
  return <div className="col"><div className="card col"><h3>Public REST API keys</h3><p className="small muted">Send <code>X-API-Key</code> to <code>/v1/*</code> and <code>/mock/*</code>. Docs: <a href={BASE + '/docs'} target="_blank" rel="noreferrer">Swagger UI</a> · <a href={BASE + '/openapi.json'} target="_blank" rel="noreferrer">OpenAPI JSON</a></p>
    <div className="row"><input style={{ flex: 1 }} placeholder="key name e.g. 'Ministry dashboard'" value={name} onChange={(e) => setName(e.target.value)} /><button disabled={!name} onClick={async () => { try { setFresh(await apiPost('/admin/api-keys', { name, scopes: ['public:read', 'scam:check', 'eligibility:precheck', 'policy:ask', 'mock:nadra', 'mock:raast'] })); setName(''); k.reload() } catch (e) { setErr(e) } }}>Create key</button></div>
    {fresh && <div className="banner ok">Copy it now (shown once): <b className="mono">{fresh.api_key}</b></div>}<ErrorBox e={err} />
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Calls</th><th></th></tr></thead><tbody>{k.data?.map((x) => <tr key={x.id}><td>{x.name}</td><td className="mono">{x.prefix}…</td><td className="small">{x.scopes.join(', ')}</td><td>{x.usage_count}</td><td>{x.active ? <button className="danger small" onClick={async () => { await apiDel('/admin/api-keys/' + x.id); k.reload() }}>revoke</button> : <span className="badge red">revoked</span>}</td></tr>)}</tbody></table></div></div></div>
}

function Hooks() {
  const w = useAsync(() => apiGet('/admin/webhooks'), [])
  const j = useAsync(() => apiGet('/admin/jobs'), [])
  const [url, setUrl] = useState('')
  const [fresh, setFresh] = useState(null)
  return <div className="col"><div className="card col"><h3>Webhooks to outside systems</h3><p className="small muted">Signed with HMAC-SHA256 (<code>X-Bharosa-Signature</code>), delivered by the background job queue with retries.</p>
    <div className="row"><input style={{ flex: 1 }} placeholder="https://example.org/hook (try webhook.site)" value={url} onChange={(e) => setUrl(e.target.value)} /><button disabled={!url} onClick={async () => { setFresh(await apiPost('/admin/webhooks', { url, events: ['*'] })); setUrl(''); w.reload() }}>Add</button></div>
    {fresh && <div className="banner ok">Signing secret (shown once): <b className="mono">{fresh.secret}</b></div>}
    {w.data?.map((x) => <div key={x.id} className="card flat"><b>{x.url}</b> <span className="small muted">{x.events.join(',')}</span><div className="small">{x.recent.map((r, i) => <span key={i} className={'badge ' + (r.ok ? '' : 'red')} style={{ marginRight: 4 }}>{r.event} {r.status ?? 'fail'}</span>)}</div></div>)}</div>
    <div className="card col"><div className="row spread"><h3>Background jobs</h3><button className="ghost small" onClick={async () => { await apiPost('/admin/jobs/run-now'); j.reload() }}>▶ run now</button></div>
      <div className="row">{Object.entries(j.data?.counts || {}).map(([k, v]) => <span key={k} className="badge">{k}: {v}</span>)}</div><Json data={j.data?.recent || []} max={200} /></div></div>
}

function Plan() {
  const t = useAsync(() => apiGet('/admin/tenant'), [])
  if (t.loading) return <Spinner />
  const x = t.data
  return <div className="card col"><h3>Subscription plan · {x.name}</h3><div className="grid"><div><div className="kpi-l">Plan</div><div className="kpi">{x.plan}</div></div><div><div className="kpi-l">Usage this month</div><div className="kpi">{x.usage_this_month} / {x.monthly_quota}</div></div></div>
    <div className="bar"><i style={{ width: Math.min(100, (x.usage_this_month / x.monthly_quota) * 100) + '%' }} /></div><p className="small muted">New cases are refused with HTTP 429 once the plan quota is reached.</p>
    <div className="row">{['free', 'pro', 'enterprise'].map((p) => <button key={p} className={x.plan === p ? '' : 'ghost'} onClick={async () => { await apiPut('/admin/tenant/plan', { plan: p }); t.reload() }}>{p}</button>)}</div></div>
}
