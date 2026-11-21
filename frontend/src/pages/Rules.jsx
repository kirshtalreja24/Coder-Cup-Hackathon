import { useEffect, useState } from 'react'
import { apiGet, apiPost, getUser, money, pct, when } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync } from '../ui'

const OPS = ['>=', '<=', '>', '<', '==', '!=']

function Diff({ a, b }) {
  const rows = []
  const ca = Object.fromEntries(a.conditions.map((c) => [c.id, c])), cb = Object.fromEntries(b.conditions.map((c) => [c.id, c]))
  if (a.amount !== b.amount) rows.push(`amount: ${a.amount} → ${b.amount}`)
  for (const id of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
    if (!ca[id]) rows.push(`+ added "${cb[id].label}"`); else if (!cb[id]) rows.push(`- removed "${ca[id].label}"`)
    else if (JSON.stringify([ca[id].op, ca[id].value, ca[id].hard, ca[id].any_of]) !== JSON.stringify([cb[id].op, cb[id].value, cb[id].hard, cb[id].any_of])) rows.push(`~ ${ca[id].label}: ${ca[id].op ?? 'any_of'} ${JSON.stringify(ca[id].value ?? ca[id].any_of)} → ${cb[id].op ?? 'any_of'} ${JSON.stringify(cb[id].value ?? cb[id].any_of)}`)
  }
  return rows.length ? <ul className="small">{rows.map((r, i) => <li key={i} className="mono">{r}</li>)}</ul> : <p className="muted small">No changes vs live rule.</p>
}

export default function Rules() {
  const me = getUser()
  const admin = me.role === 'admin'
  const list = useAsync(() => apiGet('/rules'), [])
  const pub = useAsync(() => apiGet('/rules/published'), [])
  const [draft, setDraft] = useState(null)
  const [twin, setTwin] = useState(null)
  const [tab, setTab] = useState('edit')
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [gate, setGate] = useState(null)
  const [reason, setReason] = useState('')
  useEffect(() => { if (pub.data && !draft) setDraft(JSON.parse(JSON.stringify(pub.data.definition))) }, [pub.data])
  if (pub.loading || !draft) return <Spinner />
  const setCond = (i, patch) => setDraft({ ...draft, conditions: draft.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const run = async (fn) => { setBusy(true); setErr(null); setMsg(null); try { await fn() } catch (e) { setErr(e) } finally { setBusy(false) } }
  const runTwin = () => run(async () => setTwin(await apiPost('/rules/twin', { definition: draft })))
  const publish = () => run(async () => {
    const d = await apiPost('/rules/draft', { definition: draft, note: 'edited in rule editor' })
    try {
      const r = await apiPost(`/rules/${d.id}/publish`, reason.trim() ? { override_reason: reason.trim() } : undefined)
      setMsg(`Published as v${r.published_version} (was v${r.previous_version}). Effective immediately, no redeploy. Old decisions keep their old version.` + (r.safety_gate?.override_reason ? ' Safety gate overridden with a recorded reason.' : ''))
      pub.reload(); list.reload(); setTwin(null); setGate(null); setReason('')
    } catch (e) {
      if (e.status === 409 && e.detail?.error === 'safety_gate') { setGate({ ...e.detail, draftId: d.id }); setTwin(e.detail.twin) } else throw e
    }
  })
  return (
    <div className="col">
      <div className="row spread"><h2>📜 Eligibility rules <span className="badge">live: v{pub.data.version}</span></h2><span className="muted small">changing rules needs no code and no redeploy</span></div>
      <Tabs value={tab} onChange={setTab} tabs={[['edit', 'Editor + Digital Twin'], ['versions', 'Versions & history'], ['json', 'Advanced JSON']]} />
      <ErrorBox e={err} />{msg && <div className="banner ok">✔ {msg}</div>}
      {tab === 'edit' && <>
        <div className="card col">
          <div className="row"><div style={{ flex: 2, minWidth: 200 }}><label>Programme title</label><input disabled={!admin} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div style={{ flex: 1, minWidth: 140 }}><label>Payment amount (PKR)</label><input disabled={!admin} type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></div></div>
          <div className="table-wrap"><table><thead><tr><th>Condition</th><th>Fact</th><th>Rule</th><th>Hard?</th></tr></thead><tbody>
            {draft.conditions.map((c, i) => <tr key={c.id}><td>{c.label}</td><td className="mono">{c.fact || 'any of: ' + c.any_of?.map((a) => a.fact).join(' | ')}</td>
              <td>{c.fact ? <div className="row" style={{ flexWrap: 'nowrap' }}><select disabled={!admin} style={{ width: 76 }} value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>{OPS.map((o) => <option key={o}>{o}</option>)}</select>
                <input disabled={!admin} style={{ width: 130 }} value={c.value} onChange={(e) => { const v = e.target.value; setCond(i, { value: isNaN(Number(v)) || v === '' ? v : Number(v) }) }} /></div> : <span className="muted small">group rule (edit in JSON)</span>}</td>
              <td><input type="checkbox" disabled={!admin} style={{ width: 20, minHeight: 20 }} checked={c.hard} onChange={(e) => setCond(i, { hard: e.target.checked })} /></td></tr>)}</tbody></table></div>
          <div><b>Changes vs live:</b><Diff a={pub.data.definition} b={draft} /></div>
          <div className="row"><button disabled={busy} onClick={runTwin}>🧪 Test on past cases (Digital Twin)</button>
            {admin && <button className="warn" disabled={busy} onClick={publish}>🚀 Publish to live</button>}
            <button className="ghost" onClick={() => { setDraft(JSON.parse(JSON.stringify(pub.data.definition))); setTwin(null) }}>↺ Reset</button></div>
          {!admin && <p className="hint">Only admins can publish. Officers and auditors can still run the Twin.</p>}
        </div>
        {gate && <div className="card col" style={{ borderColor: 'var(--red)', borderWidth: 2 }}><h3>🛡️ Blocked by the safety gate</h3>
          <div className="banner bad">{gate.message}</div>
          <p className="small">Before publishing, the system replays every change on past cases. Rules that raise automatic payouts by more than 15%, or that would approve more fraud, need a written reason that is stored in the audit log.</p>
          <label>Written justification (10+ characters)</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Director-approved pilot for flood-affected districts" />
          <div className="row"><button className="danger" disabled={busy || reason.trim().length < 10} onClick={publish}>Publish anyway (audited)</button><button className="ghost" onClick={() => { setGate(null); setReason('') }}>Cancel</button></div></div>}
        {twin && <div className="card col"><h3>🧪 Digital Twin result · {twin.cases_replayed} past cases replayed <span className="badge grey">nothing was changed</span></h3>
          <div className="grid">{[['Auto-approved', twin.before.routes.AUTO_APPROVE || 0, twin.after.routes.AUTO_APPROVE || 0], ['Sent to humans', twin.before.routes.HUMAN_REVIEW || 0, twin.after.routes.HUMAN_REVIEW || 0], ['Asked for proof', twin.before.routes.ASK_PROOF || 0, twin.after.routes.ASK_PROOF || 0], ['Declined (appealable)', twin.before.routes.DECLINE_WITH_APPEAL || 0, twin.after.routes.DECLINE_WITH_APPEAL || 0], ['Wrong approvals (fraud paid)', twin.before.wrong_approvals, twin.after.wrong_approvals], ['Genuine people declined by the rule', twin.before.genuine_declined_by_rule, twin.after.genuine_declined_by_rule], ['Genuine people NEWLY declined by this change', 0, twin.after.wrongful_declines], ['Auto-spend', money(twin.before.auto_spend_pkr), money(twin.after.auto_spend_pkr)], ['Total expected cost', money(twin.before.total_cost_pkr), money(twin.after.total_cost_pkr)]].map(([l, a, b]) => <div key={l} className="card flat"><div className="kpi-l">{l}</div><div className="row"><span className="muted">{a}</span>→<b className="kpi" style={{ fontSize: '1.4rem' }}>{b}</b></div></div>)}</div>
          {twin.summary.map((s, i) => <div key={i} className={'banner ' + (s.startsWith('WARNING') ? 'bad' : 'info')}>{s}</div>)}
          <h3>{twin.changed_cases} cases would change</h3><div className="row">{twin.transitions.map((t, i) => <span key={i} className="badge blue">{t.from} → {t.to}: {t.count}</span>)}</div></div>}
      </>}
      {tab === 'versions' && <div className="card table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Published</th><th>Note</th><th>Changes vs live</th></tr></thead><tbody>
        {list.data?.map((r) => <tr key={r.id}><td>v{r.version}</td><td><span className={'badge ' + (r.status === 'published' ? '' : 'grey')}>{r.status}</span></td><td className="small">{when(r.published_at)}</td><td className="small">{r.note}</td><td><Diff a={pub.data.definition} b={r.definition} /></td></tr>)}</tbody></table></div>}
      {tab === 'json' && <div className="card col"><p className="small muted">Operators: &gt;= &lt;= &gt; &lt; == != in not_in exists. Missing facts are UNKNOWN (the system asks), never silently passed. No code is evaluated.</p>
        <textarea style={{ minHeight: 320, fontFamily: 'monospace' }} disabled={!admin} value={JSON.stringify(draft, null, 2)} onChange={(e) => { try { setDraft(JSON.parse(e.target.value)); setErr(null) } catch { /* keep typing */ } }} /></div>}
    </div>
  )
}
