import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, apiPut, getUser, money, pct } from '../api'
import { ErrorBox, LineChart, Spinner, useAsync } from '../ui'

// Same maths as backend decision.action_costs (so sliders react instantly). The server remains the source of truth.
function costs(p, c) {
  const wa = c.wrong_approval
  const auto = (1 - p) * wa
  const human = c.human_review + p * c.delay_harm_human + (1 - p) * wa * c.human_residual_error
  const p2 = p + (1 - p) * c.proof_gain
  const after = Math.min((1 - p2) * wa, c.human_review + p2 * c.delay_harm_human + (1 - p2) * wa * c.human_residual_error)
  const ask = c.ask_proof + p * c.delay_harm_proof + after
  return { auto, human, ask }
}
const LABEL = { wrong_approval: ['Wrong approval', 'PKR lost if we approve someone not genuine', 0, 200000, 1000], human_review: ['Human review', 'PKR cost of one officer review', 0, 2000, 10], ask_proof: ['Ask for proof', 'effort for the citizen', 0, 500, 5], delay_harm_human: ['Delay harm (human)', 'harm to a GENUINE person who waits', 0, 2000, 10], wrongful_block: ['Wrongful block', 'harm of declining a genuine person', 0, 20000, 100], auto_payment_limit: ['Auto-payment limit', 'above this a human must approve', 0, 100000, 1000] }

export default function RiskDial() {
  const me = getUser()
  const { data, loading, error, reload } = useAsync(() => apiGet('/risk/dial'), [])
  const [c, setC] = useState(null)
  const [msg, setMsg] = useState(null)
  const [twin, setTwin] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { if (data) setC({ ...data.cost_matrix, auto_payment_limit: data.cost_matrix.auto_payment_limit ?? 30000 }) }, [data])
  const curve = useMemo(() => c ? Array.from({ length: 101 }, (_, i) => { const p = i / 100; const k = costs(p, c); return { p, auto: k.auto, human: k.human, ask: k.ask } }) : [], [c])
  const thr = useMemo(() => { if (!c) return null; const p = 1 - (c.human_review + c.delay_harm_human) / (c.wrong_approval * (1 - c.human_residual_error) + c.delay_harm_human); return p }, [c])
  if (loading || !c) return <Spinner />
  const diff = Object.fromEntries(Object.keys(LABEL).filter((k) => c[k] !== data.cost_matrix[k] && !(k === 'auto_payment_limit' && c[k] === 30000 && data.cost_matrix[k] == null)).map((k) => [k, c[k]]))
  return (
    <div className="col">
      <div className="row spread"><h2>🎚️ Risk Dial · the cost of being wrong</h2></div>
      <div className="banner info">A wrong approval is worse than a slow one. For every case the system estimates <b>P(genuine)</b> and picks the cheapest of: act alone · ask for proof · hand to a human. These are the numbers behind that choice.</div>
      <ErrorBox e={err} />{msg && <div className="banner ok">{msg}</div>}
      <div className="grid g2">
        <div className="card col"><h3>Cost matrix (PKR-equivalent)</h3>
          {Object.entries(LABEL).map(([k, [l, hint, mn, mx, st]]) => <div key={k}><div className="row spread"><label style={{ margin: 0 }}>{l}</label><b>{Number(c[k]).toLocaleString()}</b></div><input type="range" min={mn} max={mx} step={st} value={c[k]} disabled={me.role === 'auditor'} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} /><div className="hint">{hint}</div></div>)}
          <div className="row"><button className="ghost" onClick={async () => { try { setTwin(await apiPost('/rules/twin', { cost_matrix: diff })) } catch (e) { setErr(e) } }}>🧪 Preview on past cases (Twin)</button>
            {me.role === 'admin' && <button onClick={async () => { try { await apiPut('/risk/dial', { cost_matrix: c }); setMsg('Saved and audited. The next decision uses these costs.'); reload() } catch (e) { setErr(e) } }}>💾 Save to live</button>}</div></div>
        <div className="card col"><h3>Break-even: when may the system act alone?</h3>
          <div className="kpi" style={{ color: 'var(--green)' }}>P ≥ {pct(thr, 2)}</div>
          <p className="small">Auto-approve only when the system is at least this sure the claimant is genuine. Because a wrong approval ({money(c.wrong_approval)}) costs <b>{Math.round(c.wrong_approval / c.human_review)}×</b> a review ({money(c.human_review)}), the "act alone" zone is very narrow.</p>
          <LineChart points={curve} series={[{ key: 'auto', label: 'Auto-approve', color: '#b8322a' }, { key: 'ask', label: 'Ask proof', color: '#e39b2b' }, { key: 'human', label: 'Human review', color: '#2b6cb0' }]} xLabel="P(claimant is genuine)" yLabel="expected cost PKR" yMax={Math.max(2000, c.human_review * 12)} marks={[{ p: thr, label: 'auto zone starts', color: '#0f5c4d' }]} />
          <p className="hint">Lines = expected cost of each action. The lowest line wins at that confidence level.</p></div>
      </div>
      {twin && <div className="card col"><h3>🧪 Effect on {twin.cases_replayed} past (synthetic) cases</h3><div className="grid">
        {[['Auto-approve rate', pct(twin.before.auto_rate), pct(twin.after.auto_rate)], ['Wrong approvals', twin.before.wrong_approvals, twin.after.wrong_approvals], ['Genuine people declined', twin.before.wrongful_declines, twin.after.wrongful_declines], ['Genuine people waiting', twin.before.genuine_people_waiting, twin.after.genuine_people_waiting], ['Total cost', money(twin.before.total_cost_pkr), money(twin.after.total_cost_pkr)]].map(([l, a, b]) => <div key={l} className="card flat"><div className="kpi-l">{l}</div><div><span className="muted">{a}</span> → <b className="kpi" style={{ fontSize: '1.3rem' }}>{b}</b></div></div>)}</div>
        {twin.summary.map((s, i) => <div key={i} className="banner info">{s}</div>)}</div>}
    </div>
  )
}
