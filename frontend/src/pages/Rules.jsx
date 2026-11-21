import { useEffect, useState } from 'react'
import {
  FileText,
  Play,
  Send,
  RotateCcw,
  History,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp
} from 'lucide-react'
import { apiGet, apiPost, getUser, money, pct, when } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync } from '../ui'

const OPS = ['>=', '<=', '>', '<', '==', '!=']

function Diff({ a, b }) {
  const rows = []
  const ca = Object.fromEntries(a.conditions.map((c) => [c.id, c])),
    cb = Object.fromEntries(b.conditions.map((c) => [c.id, c]))
  if (a.amount !== b.amount) rows.push(`amount: ${a.amount} → ${b.amount}`)
  for (const id of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
    if (!ca[id]) rows.push(`+ added "${cb[id].label}"`)
    else if (!cb[id]) rows.push(`- removed "${ca[id].label}"`)
    else if (
      JSON.stringify([ca[id].op, ca[id].value, ca[id].hard, ca[id].any_of]) !==
      JSON.stringify([cb[id].op, cb[id].value, cb[id].hard, cb[id].any_of])
    )
      rows.push(
        `~ ${ca[id].label}: ${ca[id].op ?? 'any_of'} ${JSON.stringify(ca[id].value ?? ca[id].any_of)} → ${cb[id].op ?? 'any_of'} ${JSON.stringify(cb[id].value ?? cb[id].any_of)}`
      )
  }
  return rows.length ? (
    <ul className="small" style={{ margin: '6px 0', paddingLeft: 18 }}>
      {rows.map((r, i) => (
        <li key={i} className="mono" style={{ color: 'var(--terracotta-dark)' }}>
          {r}
        </li>
      ))}
    </ul>
  ) : (
    <p className="subtle small" style={{ margin: '4px 0 0' }}>
      No modifications vs live production rule.
    </p>
  )
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

  useEffect(() => {
    if (pub.data && !draft) setDraft(JSON.parse(JSON.stringify(pub.data.definition)))
  }, [pub.data])

  if (pub.loading || !draft) return <Spinner label="Loading live policy rule engine…" />

  const setCond = (i, patch) =>
    setDraft({
      ...draft,
      conditions: draft.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c))
    })

  const run = async (fn) => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  const runTwin = () => run(async () => setTwin(await apiPost('/rules/twin', { definition: draft })))

  const publish = () =>
    run(async () => {
      const d = await apiPost('/rules/draft', { definition: draft, note: 'edited in policy editor' })
      const r = await apiPost(`/rules/${d.id}/publish`)
      setMsg(
        `Published successfully as live rule v${r.published_version} (was v${r.previous_version}). Effective immediately across all endpoints without code changes or downtime.`
      )
      pub.reload()
      list.reload()
      setTwin(null)
    })

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Header */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ margin: 0 }}>Eligibility Rules & Digital Twin</h2>
            <span className="badge">Live: v{pub.data.version}</span>
          </div>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Deterministic policy configuration · Simulates impact on past cases before committing to live traffic
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['edit', 'Rule Editor & Digital Twin'],
            ['versions', 'Version Registry'],
            ['json', 'Raw Policy Schema']
          ]}
        />
      </div>

      <ErrorBox e={err} />
      {msg && (
        <div className="banner ok">
          <CheckCircle2 size={18} />
          <div>{msg}</div>
        </div>
      )}

      {tab === 'edit' && (
        <>
          <div className="card col" style={{ gap: 16 }}>
            <div className="row">
              <div style={{ flex: 2, minWidth: 220 }}>
                <label>Relief Programme Title</label>
                <input
                  disabled={!admin}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label>Disbursement Amount (PKR)</label>
                <input
                  disabled={!admin}
                  type="number"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rule Condition</th>
                    <th>Registry Fact Source</th>
                    <th>Comparison & Threshold</th>
                    <th>Strict Hard Filter?</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.conditions.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.label}</td>
                      <td className="mono subtle small">
                        {c.fact || 'Any of: ' + c.any_of?.map((a) => a.fact).join(' | ')}
                      </td>
                      <td>
                        {c.fact ? (
                          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                            <select
                              disabled={!admin}
                              style={{ width: 74, minHeight: 36, padding: '4px 8px' }}
                              value={c.op}
                              onChange={(e) => setCond(i, { op: e.target.value })}
                            >
                              {OPS.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                            <input
                              disabled={!admin}
                              style={{ width: 140, minHeight: 36, padding: '4px 8px' }}
                              value={c.value}
                              onChange={(e) => {
                                const v = e.target.value
                                setCond(i, {
                                  value: isNaN(Number(v)) || v === '' ? v : Number(v)
                                })
                              }}
                            />
                          </div>
                        ) : (
                          <span className="subtle small">Compound rule group</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!admin}
                          style={{ width: 18, height: 18, minHeight: 18 }}
                          checked={c.hard}
                          onChange={(e) => setCond(i, { hard: e.target.checked })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="card flat"
              style={{
                background: 'var(--ivory-alt)',
                border: '1px solid var(--border-subtle)',
                padding: 14
              }}
            >
              <b className="small" style={{ color: 'var(--forest-dark)' }}>
                Proposed Changes vs Live v{pub.data.version}:
              </b>
              <Diff a={pub.data.definition} b={draft} />
            </div>

            <div className="row spread">
              <div className="row" style={{ gap: 10 }}>
                <button disabled={busy} onClick={runTwin}>
                  <Play size={16} />
                  <span>Simulate on Past Cases (Digital Twin)</span>
                </button>
                {admin && (
                  <button className="warn" disabled={busy} onClick={publish}>
                    <Send size={16} />
                    <span>Publish to Live System</span>
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => {
                    setDraft(JSON.parse(JSON.stringify(pub.data.definition)))
                    setTwin(null)
                  }}
                >
                  <RotateCcw size={16} />
                  <span>Reset</span>
                </button>
              </div>

              {!admin && (
                <span className="small subtle">
                  Read-only mode for Officers & Auditors. Twin simulation available.
                </span>
              )}
            </div>
          </div>

          {/* Digital Twin Simulation Results */}
          {twin && (
            <div className="card col" style={{ gap: 16, border: '1.5px solid var(--forest)' }}>
              <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    Digital Twin Replay Results · {twin.cases_replayed} Cases Evaluated
                  </h3>
                  <span className="small subtle">
                    Zero modifications applied to production — purely simulated counterfactuals
                  </span>
                </div>
                <span className="badge grey">Counterfactual Replay</span>
              </div>

              <div className="grid">
                {[
                  ['Auto-Approved', twin.before.routes.AUTO_APPROVE || 0, twin.after.routes.AUTO_APPROVE || 0],
                  ['Escalated to Humans', twin.before.routes.HUMAN_REVIEW || 0, twin.after.routes.HUMAN_REVIEW || 0],
                  ['Proof Requested', twin.before.routes.ASK_PROOF || 0, twin.after.routes.ASK_PROOF || 0],
                  ['Declined (Appealable)', twin.before.routes.DECLINE_WITH_APPEAL || 0, twin.after.routes.DECLINE_WITH_APPEAL || 0],
                  ['Wrong Approvals (Fraud Paid)', twin.before.wrong_approvals, twin.after.wrong_approvals],
                  ['Genuine Claimants Declined', twin.before.genuine_declined_by_rule, twin.after.genuine_declined_by_rule],
                  ['Newly Blocked Genuine Claimants', 0, twin.after.wrongful_declines],
                  ['Auto-Spend Total', money(twin.before.auto_spend_pkr), money(twin.after.auto_spend_pkr)],
                  ['Total Expected Loss', money(twin.before.total_cost_pkr), money(twin.after.total_cost_pkr)]
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

              {twin.summary.map((s, i) => (
                <div key={i} className={'banner ' + (s.startsWith('WARNING') ? 'bad' : 'info')}>
                  <AlertTriangle size={18} />
                  <div>{s}</div>
                </div>
              ))}

              <div>
                <b className="small" style={{ color: 'var(--forest-dark)' }}>
                  {twin.changed_cases} Claims Would Experience Route Changes:
                </b>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  {twin.transitions.map((t, i) => (
                    <span key={i} className="badge blue">
                      {t.from} → {t.to}: {t.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'versions' && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Published At</th>
                <th>Audit Note</th>
                <th>Changes vs Current</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    v{r.version}
                  </td>
                  <td>
                    <span className={'badge ' + (r.status === 'published' ? '' : 'grey')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="small subtle">{when(r.published_at)}</td>
                  <td className="small">{r.note}</td>
                  <td>
                    <Diff a={pub.data.definition} b={r.definition} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'json' && (
        <div className="card col" style={{ gap: 12 }}>
          <p className="small muted" style={{ margin: 0 }}>
            Declarative JSON schema. Missing facts default to UNKNOWN and trigger human triage rather than silent pass.
          </p>
          <textarea
            style={{ minHeight: 340, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            disabled={!admin}
            value={JSON.stringify(draft, null, 2)}
            onChange={(e) => {
              try {
                setDraft(JSON.parse(e.target.value))
                setErr(null)
              } catch {
                /* keep typing */
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
