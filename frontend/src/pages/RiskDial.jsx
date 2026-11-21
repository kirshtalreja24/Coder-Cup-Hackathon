import { useEffect, useMemo, useState } from 'react'
import {
  Sliders,
  Play,
  Save,
  AlertTriangle,
  TrendingUp,
  Info,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'
import { apiGet, apiPost, apiPut, getUser, money, pct } from '../api'
import { ErrorBox, LineChart, Spinner, useAsync } from '../ui'

// Real-time cost modeling mirroring the backend decision matrix
function costs(p, c) {
  const wa = c.wrong_approval
  const auto = (1 - p) * wa
  const human = c.human_review + p * c.delay_harm_human + (1 - p) * wa * c.human_residual_error
  const p2 = p + (1 - p) * c.proof_gain
  const after = Math.min(
    (1 - p2) * wa,
    c.human_review + p2 * c.delay_harm_human + (1 - p2) * wa * c.human_residual_error
  )
  const ask = c.ask_proof + p * c.delay_harm_proof + after
  return { auto, human, ask }
}

const LABEL = {
  wrong_approval: ['Wrong Approval Loss', 'Financial loss incurred if an illegitimate claimant is approved', 0, 200000, 1000],
  human_review: ['Human Review Operational Cost', 'Direct staff overhead cost per manual caseworker adjudication', 0, 2000, 10],
  ask_proof: ['Proof Request Friction', 'Administrative and citizen burden of submitting supplemental proof', 0, 500, 5],
  delay_harm_human: ['Delay Harm (Human Triage)', 'Societal welfare cost of a genuine claimant waiting in queue', 0, 2000, 10],
  wrongful_block: ['Wrongful Denial Harm', 'Harm inflicted by incorrectly declining an eligible household', 0, 20000, 100],
  auto_payment_limit: ['Autonomous Disbursement Cap', 'Maximum amount allowed for zero-touch auto-clearance', 0, 100000, 1000]
}

export default function RiskDial() {
  const me = getUser()
  const { data, loading, error, reload } = useAsync(() => apiGet('/risk/dial'), [])
  const [c, setC] = useState(null)
  const [msg, setMsg] = useState(null)
  const [twin, setTwin] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (data)
      setC({ ...data.cost_matrix, auto_payment_limit: data.cost_matrix.auto_payment_limit ?? 30000 })
  }, [data])

  const curve = useMemo(
    () =>
      c
        ? Array.from({ length: 101 }, (_, i) => {
            const p = i / 100
            const k = costs(p, c)
            return { p, auto: k.auto, human: k.human, ask: k.ask }
          })
        : [],
    [c]
  )

  const thr = useMemo(() => {
    if (!c) return null
    const p =
      1 -
      (c.human_review + c.delay_harm_human) /
        (c.wrong_approval * (1 - c.human_residual_error) + c.delay_harm_human)
    return p
  }, [c])

  if (loading || !c) return <Spinner label="Loading risk calibration model…" />

  const diff = Object.fromEntries(
    Object.keys(LABEL)
      .filter(
        (k) =>
          c[k] !== data.cost_matrix[k] &&
          !(k === 'auto_payment_limit' && c[k] === 30000 && data.cost_matrix[k] == null)
      )
      .map((k) => [k, c[k]])
  )

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Title */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Risk Dial & Decision Economics</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Configuring the societal and financial loss matrix that guides when AI acts alone vs requests human review
          </div>
        </div>
      </div>

      <div className="banner info">
        <Info size={18} />
        <div>
          A wrong approval is worse than a slow one. For every case the system estimates <b>P(genuine)</b> and selects the mathematically lowest-expected-loss route: autonomous clearance, proof solicitation, or human officer triage.
        </div>
      </div>

      <ErrorBox e={err} />
      {msg && (
        <div className="banner ok">
          <CheckCircle2 size={18} />
          <div>{msg}</div>
        </div>
      )}

      {/* Grid: Sliders & Break-Even Chart */}
      <div className="grid g2">
        {/* Cost Sliders */}
        <div className="card col" style={{ gap: 16 }}>
          <div className="card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Loss Matrix Parameters (PKR)</h3>
          </div>

          {Object.entries(LABEL).map(([k, [l, hint, mn, mx, st]]) => (
            <div key={k} className="col" style={{ gap: 4 }}>
              <div className="row spread">
                <label style={{ margin: 0 }}>{l}</label>
                <b className="mono" style={{ color: 'var(--forest)' }}>
                  PKR {Number(c[k]).toLocaleString()}
                </b>
              </div>
              <input
                type="range"
                min={mn}
                max={mx}
                step={st}
                value={c[k]}
                disabled={me.role === 'auditor'}
                onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })}
              />
              <div className="small subtle">{hint}</div>
            </div>
          ))}

          <div className="row spread" style={{ paddingTop: 8 }}>
            <button
              className="btn ghost"
              onClick={async () => {
                try {
                  setTwin(await apiPost('/rules/twin', { cost_matrix: diff }))
                } catch (e) {
                  setErr(e)
                }
              }}
            >
              <Play size={16} />
              <span>Simulate on Past Cases (Twin)</span>
            </button>

            {me.role === 'admin' && (
              <button
                onClick={async () => {
                  try {
                    await apiPut('/risk/dial', { cost_matrix: c })
                    setMsg('Cost parameters audited and applied to all upcoming decision evaluations.')
                    reload()
                  } catch (e) {
                    setErr(e)
                  }
                }}
              >
                <Save size={16} />
                <span>Save to Production</span>
              </button>
            )}
          </div>
        </div>

        {/* Break-even Chart */}
        <div className="card col" style={{ gap: 14 }}>
          <div className="card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Autonomous Threshold Equilibrium</h3>
          </div>

          <div className="row spread">
            <div className="kpi" style={{ color: 'var(--forest)' }}>
              P ≥ {pct(thr, 2)}
            </div>
            <span className="badge amber">Narrow Clearance Band</span>
          </div>

          <p className="small subtle" style={{ margin: 0 }}>
            The system acts autonomously only when confidence exceeds this threshold. Because a fraudulent payout ({money(c.wrong_approval)}) costs <b>{Math.round(c.wrong_approval / c.human_review)}×</b> a caseworker review ({money(c.human_review)}), the autonomous zone remains prudently stringent.
          </p>

          <LineChart
            points={curve}
            series={[
              { key: 'auto', label: 'Auto-Approve Loss', color: '#A65D49' },
              { key: 'ask', label: 'Ask Proof Cost', color: '#C49A56' },
              { key: 'human', label: 'Human Review Cost', color: '#2F5C8F' }
            ]}
            xLabel="P(Claimant is genuine)"
            yLabel="Expected Loss (PKR)"
            yMax={Math.max(2000, c.human_review * 12)}
            marks={[{ p: thr, label: 'Auto-approve zone', color: '#173D32' }]}
          />

          <p className="small subtle" style={{ margin: 0 }}>
            The operational policy executes whichever curve is lowest at the claimant's computed probability level.
          </p>
        </div>
      </div>

      {/* Digital Twin Simulation Breakdown */}
      {twin && (
        <div className="card col" style={{ gap: 16, border: '1.5px solid var(--forest)' }}>
          <div className="card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>
              Simulated Impact on {twin.cases_replayed} Historical Claims
            </h3>
          </div>

          <div className="grid">
            {[
              ['Auto-Approve Clearance Rate', pct(twin.before.auto_rate), pct(twin.after.auto_rate)],
              ['Wrong Approvals Incurred', twin.before.wrong_approvals, twin.after.wrong_approvals],
              ['Genuine Households In Queue', twin.before.genuine_people_waiting, twin.after.genuine_people_waiting],
              ['Total Expected Program Loss', money(twin.before.total_cost_pkr), money(twin.after.total_cost_pkr)]
            ].map(([l, a, b]) => (
              <div key={l} className="card flat" style={{ padding: 14 }}>
                <div className="kpi-l" style={{ fontSize: '0.74rem' }}>{l}</div>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <span className="subtle small">{a}</span>
                  <ArrowRight size={12} className="subtle" />
                  <b className="kpi" style={{ fontSize: '1.35rem', color: 'var(--forest-dark)' }}>
                    {b}
                  </b>
                </div>
              </div>
            ))}
          </div>

          {twin.summary?.map((s, i) => (
            <div key={i} className="banner info">
              <Info size={16} />
              <div>{s}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
