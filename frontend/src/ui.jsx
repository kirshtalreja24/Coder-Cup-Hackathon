import { useEffect, useState } from 'react'

export const MockTag = ({ children = 'MOCK' }) => <span className="mock-tag" title="Simulated: no real person, no real money">{children}</span>

const STATUS_COLOR = { paid: '', approved: '', closed: 'grey', declined: 'red', rejected: 'red', needs_proof: 'amber', needs_consent: 'amber', awaiting_human: 'blue', escalated: 'red', draft: 'grey', awaiting_payment_consent: 'amber' }
export const StatusBadge = ({ s }) => <span className={'badge ' + (STATUS_COLOR[s] ?? '')}>{(s || '').replaceAll('_', ' ')}</span>

// One shared look for every decision route: [result tone, icon, spoken prompt id]
export const ROUTE_UI = {
  AUTO_APPROVE: ['good', '✅', 'approved'], APPROVED_WAITING_PAYMENT_CONSENT: ['wait', '⏳', 'need_proof'], ASK_PROOF: ['wait', '📷', 'need_proof'],
  HUMAN_REVIEW: ['human', '🤝', 'human_review'], DECLINE_WITH_APPEAL: ['stop', '🛑', 'declined_appeal'], NEEDS_CONSENT: ['wait', '🔒', 'consent_identity'],
}

const ROUTE_COLOR = { AUTO_APPROVE: '', ASK_PROOF: 'amber', HUMAN_REVIEW: 'blue', DECLINE_WITH_APPEAL: 'red', NEEDS_CONSENT: 'amber' }
export const RouteBadge = ({ r }) => <span className={'badge ' + (ROUTE_COLOR[r] ?? 'grey')}>{(r || '').replaceAll('_', ' ')}</span>

export function useAsync(fn, deps = []) {
  const [state, set] = useState({ loading: true, data: null, error: null })
  const run = async () => {
    set((s) => ({ ...s, loading: true, error: null }))
    try { set({ loading: false, data: await fn(), error: null }) } catch (e) { set({ loading: false, data: null, error: e }) }
  }
  useEffect(() => { run() }, deps) // eslint-disable-line
  return { ...state, reload: run }
}

export const Spinner = ({ label = 'Loading…' }) => <div className="muted" style={{ padding: 12 }}>⏳ {label}</div>
export const ErrorBox = ({ e }) => e ? <div className="banner bad">⚠ {e.offline ? 'No connection. Your saved work is safe.' : (typeof e.detail === 'string' ? e.detail : e.message)}</div> : null

export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs-inline">{tabs.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>
}

export const Json = ({ data, max = 360 }) => <pre className="trace" style={{ maxHeight: max }}>{JSON.stringify(data, null, 2)}</pre>

export function Bar({ value, color }) {
  return <div className="bar"><i style={{ width: Math.max(0, Math.min(100, value * 100)) + '%', background: color }} /></div>
}

// minimal SVG line chart (no chart library: keeps the bundle tiny for weak connections)
export function LineChart({ points, series, width = 640, height = 260, xLabel, yLabel, yMax, marks = [], hideX }) {
  const pad = { l: 56, r: 14, t: 12, b: 36 }
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b
  const ymax = yMax || Math.max(...series.flatMap((s) => points.map((p) => p[s.key] ?? 0))) * 1.05 || 1
  const x = (v) => pad.l + v * W
  const y = (v) => pad.t + H - (v / ymax) * H
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label={yLabel}>
      {[0, .25, .5, .75, 1].map((g) => <g key={g}><line x1={pad.l} x2={width - pad.r} y1={y(g * ymax)} y2={y(g * ymax)} stroke="var(--line)" /><text x={pad.l - 6} y={y(g * ymax) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(g * ymax).toLocaleString()}</text></g>)}
      {series.map((s) => <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2.5" points={points.map((p) => `${x(p.p)},${y(Math.min(p[s.key] ?? 0, ymax))}`).join(' ')} />)}
      {marks.map((m) => <g key={m.label}><line x1={x(m.p)} x2={x(m.p)} y1={pad.t} y2={pad.t + H} stroke={m.color} strokeDasharray="5 4" /><text x={x(m.p) - 4} y={pad.t + 12} textAnchor="end" fontSize="10" fill={m.color}>{m.label}</text></g>)}
      {!hideX && [0, .25, .5, .75, 1].map((g) => <text key={g} x={x(g)} y={height - 18} textAnchor="middle" fontSize="10" fill="var(--muted)">{g}</text>)}
      <text x={width / 2} y={height - 3} textAnchor="middle" fontSize="11" fill="var(--muted)">{xLabel}</text>
      {series.map((s, i) => <g key={s.key}><rect x={pad.l + 8 + i * 150} y={pad.t + 2} width="10" height="10" fill={s.color} /><text x={pad.l + 22 + i * 150} y={pad.t + 11} fontSize="11" fill="var(--ink)">{s.label}</text></g>)}
    </svg>
  )
}

export function BarList({ rows, max, color = 'var(--green)' }) {
  const m = max || Math.max(1, ...rows.map((r) => r[1]))
  return <div className="col" style={{ gap: 6 }}>{rows.map(([k, v]) => <div key={k}><div className="row spread small"><span>{k}</span><b>{v}</b></div><div className="bar"><i style={{ width: (v / m) * 100 + '%', background: color }} /></div></div>)}</div>
}
