import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, when } from '../api'
import { ROUTE_UI, RouteBadge } from '../ui'

// Public page: verify a decision receipt without logging in. Shows only non-personal facts.
export default function Verify() {
  const [params, setParams] = useSearchParams()
  const [token, setToken] = useState(params.get('t') || '')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)

  const check = async (t = token) => {
    if (!t.trim()) return
    setBusy(true)
    try { setRes(await api('/public/verify-receipt?t=' + encodeURIComponent(t.trim()), { auth: false })) } catch (e) { setRes({ valid: false, message: e.offline ? 'No connection. Try again when you are online.' : String(e.detail || e.message) }) } finally { setBusy(false) }
  }
  useEffect(() => { if (params.get('t')) check(params.get('t')) }, []) // eslint-disable-line

  const tone = res ? (res.valid ? (ROUTE_UI[res.route]?.[0] || 'good') : 'stop') : null
  return (
    <div className="container narrow col" style={{ paddingTop: 24 }}>
      <div className="proto-bar" style={{ borderRadius: 10 }}>PROTOTYPE · MOCK data only</div>
      <h1>🧾 Verify a decision receipt</h1>
      <p className="muted">A receipt proves what a decision was, which rule version made it, and that it was recorded in the system's tamper-evident log. It contains no name, ID number or other personal data.</p>
      <div className="card col">
        <label>Receipt code (or scan its QR)</label>
        <textarea value={token} onChange={(e) => setToken(e.target.value)} style={{ minHeight: 70, fontFamily: 'monospace', fontSize: '.8rem' }} />
        <button disabled={busy || !token.trim()} onClick={() => { setParams({ t: token.trim() }); check() }}>{busy ? '⏳' : '🔍'} Verify</button>
      </div>
      {res && (
        <div className={'result ' + tone}>
          <div className="ico">{res.valid ? '✅' : '❌'}</div>
          <h2>{res.valid ? 'Valid receipt' : 'NOT valid'}</h2>
          <p>{res.message}</p>
          {res.valid && (
            <table style={{ textAlign: 'left', background: 'transparent' }}><tbody>
              <tr><th>Decision</th><td><RouteBadge r={res.route} /></td></tr>
              <tr><th>Rule version</th><td>v{res.rule_version}</td></tr>
              <tr><th>Confidence</th><td>{Math.round(res.confidence * 100)}%</td></tr>
              <tr><th>Decided</th><td>{when(res.decided_at)}</td></tr>
              <tr><th>Case reference</th><td className="mono">{res.case_ref}</td></tr>
              <tr><th>In audit log</th><td>{res.audit_entry_found ? '✔ yes (hash-chained)' : 'not found'}</td></tr>
            </tbody></table>
          )}
        </div>
      )}
      <Link to="/login">← Back to the app</Link>
    </div>
  )
}
