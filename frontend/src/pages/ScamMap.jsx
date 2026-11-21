import { useState } from 'react'
import { apiGet, when } from '../api'
import { BarList, ErrorBox, LineChart, Spinner, useAsync } from '../ui'

export default function ScamMap() {
  const [days, setDays] = useState(30)
  const { data, loading, error, reload } = useAsync(() => apiGet('/scam/map?days=' + days), [days])
  const recent = useAsync(() => apiGet('/scam/recent?limit=12'), [])
  if (loading) return <Spinner />
  if (error) return <ErrorBox e={error} />
  const types = [...new Set(data.by_type.map((x) => x[0]))]
  const areas = data.by_area.map((x) => x[0])
  const max = Math.max(1, ...areas.flatMap((a) => types.map((t) => data.area_x_type[a]?.[t] || 0)))
  const days_pts = data.by_day.map(([d, n], i, arr) => ({ p: arr.length > 1 ? i / (arr.length - 1) : 0, n }))
  return (
    <div className="col">
      <div className="row spread"><h2>🗺️ Scam Map <span className="muted small">· built from classified messages</span></h2>
        <div className="row"><select style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 30, 60].map((d) => <option key={d} value={d}>last {d} days</option>)}</select><button className="ghost small" onClick={() => { reload(); recent.reload() }}>↻ live</button></div></div>
      <div className="grid">
        <div className="card"><div className="kpi-l">Messages checked</div><div className="kpi">{data.total_reports}</div></div>
        <div className="card"><div className="kpi-l">Flagged scam/suspicious</div><div className="kpi" style={{ color: 'var(--red)' }}>{data.flagged}</div></div>
        <div className="card"><div className="kpi-l">Rising areas</div><div className="kpi">{data.rising_areas.length}</div><div className="small">{data.rising_areas.map((r) => `${r.area} (${r.earlier}→${r.recent})`).join(', ') || 'none'}</div></div>
      </div>
      <div className="grid g2">
        <div className="card"><h3>By area</h3><BarList rows={data.by_area} color="var(--red)" /></div>
        <div className="card"><h3>By scam type</h3><BarList rows={data.by_type.map(([k, v]) => [k.replaceAll('_', ' '), v])} color="var(--amber)" /></div>
      </div>
      <div className="card table-wrap"><h3>Area × type heat map</h3><table><thead><tr><th>Area</th>{types.map((t) => <th key={t}>{t.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>
        {areas.map((a) => <tr key={a}><td><b>{a}</b></td>{types.map((t) => { const v = data.area_x_type[a]?.[t] || 0; return <td key={t} style={{ background: v ? `rgba(184,50,42,${0.12 + 0.7 * v / max})` : 'transparent', color: v / max > .6 ? '#fff' : 'inherit', textAlign: 'center' }}>{v || ''}</td> })}</tr>)}</tbody></table></div>
      {days_pts.length > 1 && <div className="card"><h3>Over time</h3><LineChart points={days_pts} series={[{ key: 'n', label: 'flagged per day', color: '#b8322a' }]} xLabel={`${data.by_day[0][0]} → ${data.by_day.at(-1)[0]}`} /></div>}
      <div className="card table-wrap"><h3>Latest reports</h3><table><thead><tr><th>When</th><th>Area</th><th>Verdict</th><th>Type</th><th>Text</th></tr></thead><tbody>{recent.data?.map((r) => <tr key={r.id}><td className="small">{when(r.at)}</td><td>{r.area}</td><td><span className={'badge ' + (r.verdict === 'SCAM' ? 'red' : r.verdict === 'SUSPICIOUS' ? 'amber' : r.verdict === 'UNSURE' ? 'blue' : '')}>{r.verdict}</span></td><td className="small">{r.type}</td><td className="small">{r.text}</td></tr>)}</tbody></table></div>
      <p className="hint">{data.note}</p>
    </div>
  )
}
