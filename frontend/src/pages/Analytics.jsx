import { apiGet, money, pct } from '../api'
import { BarList, ErrorBox, Spinner, useAsync } from '../ui'

const K = ({ l, v, sub, color }) => <div className="card"><div className="kpi-l">{l}</div><div className="kpi" style={{ color }}>{v}</div>{sub && <div className="small muted">{sub}</div>}</div>

export default function Analytics() {
  const a = useAsync(() => apiGet('/analytics'), [])
  const e = useAsync(() => apiGet('/eval'), [])
  if (a.loading || e.loading) return <Spinner />
  if (a.error || e.error) return <ErrorBox e={a.error || e.error} />
  const A = a.data, E = e.data, H = E.headline, sc = E.scam, cf = sc.confusion
  const hist = A.p_legit_histogram
  return (
    <div className="col">
      <h2>📊 Analytics & evaluation <span className="muted small">· {A.tenant}</span></h2>
      <div className="grid">
        <K l="Live cases" v={A.cases_live} sub={`${A.open_queue} waiting for a human`} />
        <K l="Auto-approve rate" v={pct(A.auto_rate, 1)} sub="only when very sure" />
        <K l="Human-review rate" v={pct(A.human_rate, 1)} sub="'I am not sure' handoffs" color="var(--blue)" />
        <K l="Wrong approvals (history)" v={H.wrong_approvals} sub="fraud paid, in synthetic replay" color={H.wrong_approvals ? 'var(--red)' : 'var(--green)'} />
        <K l="Genuine people declined by rule" v={H.genuine_declined} sub="policy, appealable. A wrongful block is a cost too" />
        <K l="Avg cost / case" v={money(H.avg_cost_per_case_pkr)} />
      </div>
      <div className="grid g2">
        <div className="card"><h3>Routing mix (all decisions)</h3><BarList rows={Object.entries(A.routes)} /></div>
        <div className="card"><h3>Confidence distribution</h3><div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 130 }}>{hist.map((n, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}><div style={{ height: Math.max(2, (n / Math.max(...hist, 1)) * 100), background: i >= 9 ? 'var(--green)' : i >= 5 ? 'var(--amber)' : 'var(--red)', borderRadius: 4 }} title={n} /><div className="hint">{i / 10}</div></div>)}</div><p className="hint">P(genuine) per decision. The spread shows the system is not blindly confident.</p></div>
      </div>
      <div className="grid g2">
        <div className="card"><h3>🎯 Calibration · does 90% mean 90%?</h3><div className="table-wrap"><table><thead><tr><th>Bin</th><th>n</th><th>Predicted</th><th>Actually genuine</th></tr></thead><tbody>{E.calibration.reliability_bins.map((b) => <tr key={b.bin}><td>{b.bin}</td><td>{b.n}</td><td>{pct(b.predicted)}</td><td>{pct(b.actual_genuine)}</td></tr>)}</tbody></table></div><p className="small">Brier score <b>{E.calibration.brier_score}</b> (lower is better)</p></div>
        <div className="card"><h3>🚨 Scam classifier · honest numbers</h3>
          <table><tbody><tr><td></td><th>flagged</th><th>not flagged</th></tr><tr><th>truly scam</th><td style={{ background: 'var(--green-soft)' }}>{cf.tp} caught</td><td style={{ background: 'var(--red-soft)' }}>{cf.fn} missed</td></tr><tr><th>truly real</th><td style={{ background: 'var(--red-soft)' }}>{cf.fp} FALSE ALARM</td><td style={{ background: 'var(--green-soft)' }}>{cf.tn} ok</td></tr></tbody></table>
          <p className="small">Recall {pct(sc.scam_recall)} · false-alarm rate <b>{pct(sc.false_alarm_rate)}</b> · {sc.handed_to_human} handed to a human (unsure) · cost PKR {sc.cost_model_pkr.total}</p><p className="hint">{sc.note}</p></div>
      </div>
      <div className="grid">
        <div className="card"><h3>📚 RAG</h3><p>Retrieval hit-rate <b>{E.rag.retrieval_hit_rate}</b></p><p>Abstains when out of scope <b>{E.rag.abstains_when_out_of_scope}</b></p></div>
        <div className="card"><h3>⚡ Service</h3><p>Requests <b>{E.service.requests}</b> · p50 <b>{E.service.latency_ms.p50}ms</b> · p95 <b>{E.service.latency_ms.p95}ms</b></p><p className="small">by status: {JSON.stringify(E.service.by_status)}</p></div>
        <div className="card"><h3>🤖 LLM</h3><p>{E.llm.enabled ? 'enabled' : 'not configured - using deterministic fallbacks'}</p><p className="small">calls {E.llm.calls} · ok {E.llm.ok} · failed {E.llm.fail} · avg {E.llm.avg_ms}ms</p><p className="small">OCR engine: {E.ocr_engine_available ? 'installed' : 'not on this server (QR + form cross-check used)'}</p></div>
      </div>
      {E.service.recent_errors?.length > 0 && <div className="card"><h3>Recent errors</h3>{E.service.recent_errors.map((x, i) => <div key={i} className="mono small">{x.at} {x.path} {x.error}</div>)}</div>}
    </div>
  )
}
