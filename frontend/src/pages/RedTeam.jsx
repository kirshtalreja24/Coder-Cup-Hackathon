import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../api'
import { Bar, ErrorBox } from '../ui'

// The scorecard runs in the background on the server and fills in live, row by row, so it works even on a slow link.
export default function RedTeam() {
  const [prog, setProg] = useState(null)
  const [err, setErr] = useState(null)
  const timer = useRef(null)

  const poll = async () => {
    try {
      const p = await apiGet('/redteam/progress', { timeout: 30000 })
      setProg(p)
      if (p.status === 'running') timer.current = setTimeout(poll, 1500)
    } catch (e) { setErr(e); timer.current = setTimeout(poll, 4000) }
  }
  useEffect(() => { poll(); return () => clearTimeout(timer.current) }, []) // eslint-disable-line

  const start = async () => {
    setErr(null); clearTimeout(timer.current)
    try { await apiPost('/redteam/start'); setProg({ status: 'running', results: [], done: 0, passed: 0, expected: prog?.expected || 61, phase: 'starting' }); poll() } catch (e) { setErr(e) }
  }

  const running = prog?.status === 'running'
  const rows = prog?.results || []
  const final = prog?.result
  const cats = [...new Set(rows.map((r) => r.category))]
  const failed = rows.filter((r) => !r.passed).length
  return (
    <div className="col">
      <h2>🛡️ Red-Team · the system attacks itself, live</h2>
      <div className="banner info">Behaviour over claims. This button fires {prog?.expected || '50+'} attacks (forged tokens, wrong roles, tenant isolation, consent withdrawal, helper self-consent, forged IDs, prompt injection, garbage input, rule changes and the safety gate, SSRF, receipt tampering, audit tampering…) at the <b>running</b> system inside a throw-away department, and prints what actually happened. Failures are shown, not hidden.</div>
      <div className="row"><button onClick={start} disabled={running} style={{ fontSize: '1.15rem', padding: '14px 26px' }}>{running ? '⏳ attacking…' : '🚀 Run the attacks'}</button>
        {running && <span className="muted">phase: <b>{prog.phase}</b> · {prog.elapsed_s ?? 0}s</span>}</div>
      {running && <div><Bar value={Math.min(0.98, (prog.done || 0) / (prog.expected || 61))} /><div className="hint">{prog.done} of about {prog.expected} attacks done · {prog.passed} passed so far</div></div>}
      <ErrorBox e={err} />
      {prog?.status === 'error' && <div className="banner bad">The run stopped: {prog.error}</div>}
      {rows.length > 0 && <>
        <div className="grid">
          <div className="card"><div className="kpi-l">{running ? 'Score so far' : 'Score'}</div><div className="kpi" style={{ color: failed ? 'var(--red)' : 'var(--green)' }}>{prog.passed}/{rows.length}</div>
            <div className="small muted">{final ? `in ${final.duration_s}s · sandbox ${final.sandbox_department}` : 'live'}</div></div>
          {final && Object.entries(final.by_category).map(([k, v]) => <div key={k} className="card"><div className="kpi-l">{k}</div><div className="kpi" style={{ fontSize: '1.4rem' }}>{v}</div></div>)}
          {final && <div className="card"><div className="kpi-l">Scam false-alarm rate</div><div className="kpi" style={{ fontSize: '1.4rem' }}>{final.false_alarm_check.scam_false_alarm_rate}</div><div className="small muted">recall {final.false_alarm_check.scam_recall} · {final.false_alarm_check.handed_to_human} handed to human</div></div>}
        </div>
        {cats.map((c) => <div key={c} className="card table-wrap"><h3 style={{ textTransform: 'capitalize' }}>{c}</h3><table><thead><tr><th></th><th>Attack</th><th>Safe behaviour</th><th>Actual</th></tr></thead><tbody>
          {rows.filter((r) => r.category === c).map((r) => <tr key={r.id}><td>{r.passed ? '✅' : '❌'}</td><td>{r.attack}<div className="mono muted">{r.id}</div></td><td className="small">{r.safe_behaviour}</td><td className="small mono">{typeof r.actual === 'object' ? JSON.stringify(r.actual) : String(r.actual)}</td></tr>)}</tbody></table></div>)}
        {final && <p className="hint">{final.note}</p>}</>}
    </div>
  )
}
