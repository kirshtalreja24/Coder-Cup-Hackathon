import { useState } from 'react'
import { apiPost } from '../api'
import { ErrorBox } from '../ui'

export default function RedTeam() {
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const run = async () => { setBusy(true); setErr(null); setRes(null); try { setRes(await apiPost('/redteam/run', undefined, { timeout: 120000 })) } catch (e) { setErr(e) } finally { setBusy(false) } }
  const cats = res ? [...new Set(res.results.map((r) => r.category))] : []
  return (
    <div className="col">
      <h2>🛡️ Red-Team · the system attacks itself, live</h2>
      <div className="banner info">Behaviour over claims. This button fires {res?.total || '40'} attacks (forged tokens, wrong roles, consent withdrawal, forged IDs, prompt injection, garbage input, rule changes, audit tampering…) at the <b>running</b> system inside a throw-away department, and prints what actually happened. Failures are shown, not hidden.</div>
      <div><button onClick={run} disabled={busy} style={{ fontSize: '1.15rem', padding: '14px 26px' }}>{busy ? '⏳ attacking…' : '🚀 Run the attacks'}</button></div>
      <ErrorBox e={err} />
      {res && <>
        <div className="grid"><div className="card"><div className="kpi-l">Score</div><div className="kpi" style={{ color: res.failed ? 'var(--red)' : 'var(--green)' }}>{res.score}</div><div className="small muted">in {res.duration_s}s · sandbox {res.sandbox_department}</div></div>
          {Object.entries(res.by_category).map(([k, v]) => <div key={k} className="card"><div className="kpi-l">{k}</div><div className="kpi" style={{ fontSize: '1.4rem' }}>{v}</div></div>)}
          <div className="card"><div className="kpi-l">Scam false-alarm rate</div><div className="kpi" style={{ fontSize: '1.4rem' }}>{res.false_alarm_check.scam_false_alarm_rate}</div><div className="small muted">recall {res.false_alarm_check.scam_recall} · {res.false_alarm_check.handed_to_human} handed to human</div></div></div>
        {cats.map((c) => <div key={c} className="card table-wrap"><h3 style={{ textTransform: 'capitalize' }}>{c}</h3><table><thead><tr><th></th><th>Attack</th><th>Safe behaviour</th><th>Actual</th></tr></thead><tbody>
          {res.results.filter((r) => r.category === c).map((r) => <tr key={r.id}><td>{r.passed ? '✅' : '❌'}</td><td>{r.attack}<div className="mono muted">{r.id}</div></td><td className="small">{r.safe_behaviour}</td><td className="small mono">{typeof r.actual === 'object' ? JSON.stringify(r.actual) : String(r.actual)}</td></tr>)}</tbody></table></div>)}
        <p className="hint">{res.note}</p></>}
    </div>
  )
}
