import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, money, pct, when } from '../api'
import { ErrorBox, RouteBadge, Spinner, StatusBadge, useAsync, Bar } from '../ui'

const PRI = { 1: ['P1 urgent', 'red'], 2: ['P2 high', 'amber'], 3: ['P3 normal', 'blue'], 4: ['P4 low', 'grey'] }

export default function Queue() {
  const [sort, setSort] = useState('priority')
  const [waiting, setWaiting] = useState(false)
  const { data, loading, error, reload } = useAsync(() => apiGet(`/queue?sort=${sort}&include_waiting=${waiting}`), [sort, waiting])
  return (
    <div className="col">
      <div className="row spread"><h2>🧑‍💼 Review queue <span className="muted small">· cases where the system said "I am not sure"</span></h2>
        <div className="row"><label className="row small" style={{ margin: 0 }}><input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={waiting} onChange={(e) => setWaiting(e.target.checked)} /> include waiting-for-proof</label>
          <select style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}><option value="priority">Sort: priority</option><option value="confidence">Sort: least confident first</option><option value="age">Sort: oldest first</option></select>
          <button className="ghost small" onClick={reload}>↻</button></div></div>
      <ErrorBox e={error} />{loading && <Spinner />}
      {data && <div className="card table-wrap"><table><thead><tr><th>Priority</th><th>Case</th><th>Status</th><th>AI said</th><th>P(genuine)</th><th>Why it's here</th><th>Amount</th><th>Opened</th></tr></thead><tbody>
        {data.items.map((c) => <tr key={c.id}><td><span className={'badge ' + PRI[c.priority]?.[1]}>{PRI[c.priority]?.[0]}</span></td>
          <td><Link to={'/s/case/' + c.id}>#{c.id.slice(0, 6)}</Link></td><td><StatusBadge s={c.status} /></td><td><RouteBadge r={c.route} /></td>
          <td style={{ minWidth: 110 }}>{pct(c.p_legit)}<Bar value={c.p_legit ?? 0} color={c.p_legit > .9 ? 'var(--green)' : c.p_legit > .5 ? 'var(--amber)' : 'var(--red)'} /></td>
          <td className="small">{c.headline || '-'}</td><td>{money(c.amount)}</td><td className="small">{when(c.created_at)}</td></tr>)}
        {data.items.length === 0 && <tr><td colSpan="8" className="muted">🎉 Queue is empty. New "not sure" cases appear here with the notes attached.</td></tr>}</tbody></table></div>}
    </div>
  )
}
