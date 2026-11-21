import {
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Terminal,
  ShieldCheck,
  Code2,
  FileCheck
} from 'lucide-react'
import { BASE } from '../api'
import { useAsync, Spinner } from '../ui'
import { apiGet } from '../api'

export default function About() {
  const a = useAsync(() => apiGet('/about', { auth: false }), [])

  if (a.loading) return <Spinner label="Loading architectural blueprint…" />
  const x = a.data

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Title */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>System Blueprint: Real vs Simulated</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Complete architectural transparency regarding live production engines versus synthetic sandbox data
          </div>
        </div>
      </div>

      {/* Prototype Status Alert */}
      <div className="banner bad">
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <b>{x?.status || 'PROTOTYPE DEMONSTRATION ONLY'}</b>
          <div style={{ marginTop: 2 }}>
            This application is built for Coder's Cup '26 AI Hackathon. All individuals, CNIC registry entries, biometric images, Raast payment rails, and SMS messages are completely synthetic.
          </div>
        </div>
      </div>

      {/* Two Column Contrast: Real vs Simulated */}
      <div className="grid g2">
        <div className="card col" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--forest)' }} />
            <h3 style={{ margin: 0 }}>Fully Functional Engines (Real Code)</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {x?.real?.map((r, i) => (
              <li key={i} className="small" style={{ marginBottom: 6 }}>
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="card col" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <AlertTriangle size={20} style={{ color: 'var(--gold-dark)' }} />
            <h3 style={{ margin: 0 }}>Synthetic Simulators (Marked MOCK)</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {x?.simulated?.map((r, i) => (
              <li key={i} className="small" style={{ marginBottom: 6 }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Curl for Judges */}
      <div className="card col" style={{ gap: 14 }}>
        <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Terminal size={18} style={{ color: 'var(--forest)' }} />
            <h3 style={{ margin: 0 }}>Judge Evaluation: Direct CLI Verification</h3>
          </div>
          <span className="mock-tag">cURL Ready</span>
        </div>

        <pre className="trace" style={{ margin: 0 }}>
          {`# 1. Staff Authentication
curl -s -X POST ${BASE}/auth/login \\
  -d "username=officer1@relief.demo&password=Demo#12345"

# 2. Server-side RBAC & Access Control
curl -i ${BASE}/audit

# 3. Public REST API with Pre-seeded Key
curl -s ${BASE}/v1/status \\
  -H "X-API-Key: bh_demo_public_key_mock_0001"

# 4. Instant Scam Verification (Unauthenticated)
curl -s -X POST ${BASE}/public/scam-check \\
  -H "Content-Type: application/json" \\
  -d '{"text":"BISP relief approved. Send CNIC and fee Rs 500","sender":"0300"}'`}
        </pre>

        <div className="row" style={{ gap: 14, paddingTop: 6 }}>
          <a
            href={BASE + '/docs'}
            target="_blank"
            rel="noreferrer"
            className="row small"
            style={{ gap: 4 }}
          >
            <span>Interactive Swagger UI</span>
            <ExternalLink size={13} />
          </a>
          <a
            href={BASE + '/openapi.json'}
            target="_blank"
            rel="noreferrer"
            className="row small subtle"
            style={{ gap: 4 }}
          >
            <span>OpenAPI Schema JSON</span>
            <ExternalLink size={13} />
          </a>
          <a
            href={BASE + '/health'}
            target="_blank"
            rel="noreferrer"
            className="row small subtle"
            style={{ gap: 4 }}
          >
            <span>/health check</span>
            <ExternalLink size={13} />
          </a>
          <a
            href={BASE + '/metrics'}
            target="_blank"
            rel="noreferrer"
            className="row small subtle"
            style={{ gap: 4 }}
          >
            <span>Prometheus /metrics</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  )
}
