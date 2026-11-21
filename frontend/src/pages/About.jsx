import { BASE } from '../api'
import { useAsync, Spinner } from '../ui'
import { apiGet } from '../api'

export default function About() {
  const a = useAsync(() => apiGet('/about', { auth: false }), [])
  if (a.loading) return <Spinner />
  const x = a.data
  return (
    <div className="col"><h2>ℹ️ What is real, what is simulated</h2>
      <div className="banner bad"><b>{x?.status}</b> Nothing here is an official service. All people, IDs, payments and messages are synthetic.</div>
      <div className="grid g2"><div className="card"><h3>✅ Real (working code)</h3><ul>{x?.real.map((r) => <li key={r}>{r}</li>)}</ul></div>
        <div className="card"><h3>🎭 Simulated (clearly marked MOCK)</h3><ul>{x?.simulated.map((r) => <li key={r}>{r}</li>)}</ul></div></div>
      <div className="card col"><h3>For judges: try it with curl</h3><pre className="trace">{`# login
curl -s -X POST ${BASE}/auth/login -d "username=officer1@relief.demo&password=Demo#12345"
# no token -> 401, wrong role -> 403 (server-side RBAC)
curl -i ${BASE}/audit
# public API with the demo API key
curl -s ${BASE}/v1/status -H "X-API-Key: bh_demo_public_key_mock_0001"
# scam check, no login
curl -s -X POST ${BASE}/public/scam-check -H "Content-Type: application/json" \\
  -d '{"text":"BISP relief approved. Send CNIC and fee Rs 500","sender":"0300"}'`}</pre>
        <p><a href={BASE + '/docs'} target="_blank" rel="noreferrer">Swagger UI</a> · <a href={BASE + '/openapi.json'} target="_blank" rel="noreferrer">openapi.json</a> · <a href={BASE + '/health'} target="_blank" rel="noreferrer">/health</a> · <a href={BASE + '/metrics'} target="_blank" rel="noreferrer">/metrics</a></p></div></div>
  )
}
