import { useState } from 'react'
import {
  Settings,
  Users,
  Key,
  Webhook,
  CreditCard,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  ExternalLink,
  Shield,
  Activity,
  Zap,
  RefreshCw,
  Clock
} from 'lucide-react'
import { apiDel, apiGet, apiPost, apiPut, apiPatch, BASE } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync } from '../ui'

export default function Admin() {
  const [tab, setTab] = useState('users')

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>System Administration</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            Caseworker access control, REST credentials, webhook pipelines, and departmental capacity
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['users', 'Staff & Caseworkers'],
            ['keys', 'Developer API Keys'],
            ['hooks', 'Webhooks & Dispatcher'],
            ['plan', 'Department Quota']
          ]}
        />
      </div>

      {tab === 'users' && <UsersSection />}
      {tab === 'keys' && <KeysSection />}
      {tab === 'hooks' && <HooksSection />}
      {tab === 'plan' && <PlanSection />}
    </div>
  )
}

function UsersSection() {
  const u = useAsync(() => apiGet('/admin/users'), [])
  const [f, setF] = useState({ email: '', name: '', role: 'officer', password: '' })
  const [err, setErr] = useState(null)
  const [filter, setFilter] = useState('')
  const rows = (u.data || []).filter((x) => x.role !== 'citizen' || filter)

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Create User Card */}
      <div className="card col" style={{ gap: 14 }}>
        <h3 style={{ margin: 0 }}>Provision Staff & Caseworker Accounts</h3>
        <div className="row" style={{ gap: 10 }}>
          <input
            placeholder="Official email (e.g. officer@relief.gov)"
            style={{ flex: 1.5, minWidth: 200 }}
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          <input
            placeholder="Full Name"
            style={{ flex: 1, minWidth: 160 }}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <select
            style={{ width: 'auto', minWidth: 130 }}
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value })}
          >
            {['citizen', 'helper', 'officer', 'admin', 'auditor'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input
            placeholder="Password (8+ chars)"
            type="password"
            style={{ flex: 1, minWidth: 160 }}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
          <button
            disabled={!f.email || !f.name || !f.password}
            onClick={async () => {
              try {
                await apiPost('/admin/users', f)
                setF({ email: '', name: '', role: 'officer', password: '' })
                u.reload()
              } catch (e) {
                setErr(e)
              }
            }}
          >
            <Plus size={16} />
            <span>Create</span>
          </button>
        </div>
        <ErrorBox e={err} />
      </div>

      {/* Users Table */}
      <div className="card col" style={{ gap: 14, padding: 0 }}>
        <div className="row spread" style={{ padding: '18px 20px 0' }}>
          <h3 style={{ margin: 0 }}>Active User Directory</h3>
          <label
            className="row small subtle"
            style={{
              margin: 0,
              gap: 8,
              cursor: 'pointer',
              background: 'var(--ivory-alt)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <input
              type="checkbox"
              style={{ width: 16, height: 16, minHeight: 16 }}
              checked={!!filter}
              onChange={(e) => setFilter(e.target.checked ? '1' : '')}
            />
            <span>Include citizen claimant accounts</span>
          </label>
        </div>

        {u.loading && <Spinner label="Loading staff registry…" />}

        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td style={{ fontWeight: 600 }}>{x.name}</td>
                  <td className="small subtle mono">{x.email}</td>
                  <td>
                    <select
                      style={{ width: 'auto', minHeight: 34, padding: '4px 8px' }}
                      value={x.role}
                      onChange={async (e) => {
                        try {
                          await apiPatch('/admin/users/' + x.id, { role: e.target.value })
                          u.reload()
                        } catch (er) {
                          setErr(er)
                        }
                      }}
                    >
                      {['citizen', 'helper', 'officer', 'admin', 'auditor'].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className={'small ' + (x.is_active ? 'ghost' : 'danger')}
                      onClick={async () => {
                        try {
                          await apiPatch('/admin/users/' + x.id, { is_active: !x.is_active })
                          u.reload()
                        } catch (er) {
                          setErr(er)
                        }
                      }}
                    >
                      {x.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KeysSection() {
  const k = useAsync(() => apiGet('/admin/api-keys'), [])
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState(null)
  const [err, setErr] = useState(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card col" style={{ gap: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>Public REST API Credentials</h3>
          <p className="small subtle" style={{ margin: '4px 0 0' }}>
            Authenticate with header <code className="mono">X-API-Key: bh_...</code> against{' '}
            <code className="mono">/v1/*</code> endpoints. Interactive docs:{' '}
            <a href={BASE + '/docs'} target="_blank" rel="noreferrer">
              Swagger UI <ExternalLink size={12} style={{ display: 'inline' }} />
            </a>{' '}
            ·{' '}
            <a href={BASE + '/openapi.json'} target="_blank" rel="noreferrer">
              OpenAPI JSON
            </a>
          </p>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Key name or consumer (e.g. 'Sindh Relief Dashboard')"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={!name}
            onClick={async () => {
              try {
                setFresh(
                  await apiPost('/admin/api-keys', {
                    name,
                    scopes: [
                      'public:read',
                      'scam:check',
                      'eligibility:precheck',
                      'policy:ask',
                      'mock:nadra',
                      'mock:raast'
                    ]
                  })
                )
                setName('')
                k.reload()
              } catch (e) {
                setErr(e)
              }
            }}
          >
            <Plus size={16} />
            <span>Generate Key</span>
          </button>
        </div>

        {fresh && (
          <div className="banner ok">
            <CheckCircle2 size={18} />
            <div>
              Copy key now (never displayed again):{' '}
              <b className="mono" style={{ color: 'var(--forest-dark)' }}>
                {fresh.api_key}
              </b>
            </div>
          </div>
        )}

        <ErrorBox e={err} />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Consumer Name</th>
                <th>Prefix</th>
                <th>Granted Scopes</th>
                <th>Requests</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {k.data?.map((x) => (
                <tr key={x.id}>
                  <td style={{ fontWeight: 600 }}>{x.name}</td>
                  <td className="mono subtle">{x.prefix}…</td>
                  <td className="small subtle">{x.scopes.join(', ')}</td>
                  <td className="mono">{x.usage_count}</td>
                  <td>
                    {x.active ? (
                      <button
                        className="danger small"
                        onClick={async () => {
                          await apiDel('/admin/api-keys/' + x.id)
                          k.reload()
                        }}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="badge red">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function HooksSection() {
  const w = useAsync(() => apiGet('/admin/webhooks'), [])
  const j = useAsync(() => apiGet('/admin/jobs'), [])
  const [url, setUrl] = useState('')
  const [fresh, setFresh] = useState(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Webhooks */}
      <div className="card col" style={{ gap: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>Outbound Event Webhooks</h3>
          <p className="small subtle" style={{ margin: '4px 0 0' }}>
            Signed with HMAC-SHA256 (<code className="mono">X-Bharosa-Signature</code>) and dispatched with exponential backoff retries.
          </p>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Webhook destination HTTPS URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            disabled={!url}
            onClick={async () => {
              setFresh(await apiPost('/admin/webhooks', { url, events: ['*'] }))
              setUrl('')
              w.reload()
            }}
          >
            <Plus size={16} />
            <span>Register Webhook</span>
          </button>
        </div>

        {fresh && (
          <div className="banner ok">
            <CheckCircle2 size={18} />
            <div>
              HMAC Signing Secret (store safely):{' '}
              <b className="mono" style={{ color: 'var(--forest-dark)' }}>
                {fresh.secret}
              </b>
            </div>
          </div>
        )}

        <div className="col" style={{ gap: 8 }}>
          {w.data?.map((x) => (
            <div
              key={x.id}
              className="card flat col"
              style={{
                gap: 8,
                padding: 12,
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div className="row spread">
                <b className="mono small" style={{ color: 'var(--forest)' }}>
                  {x.url}
                </b>
                <span className="small subtle">Events: {x.events.join(', ')}</span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {x.recent?.map((r, i) => (
                  <span
                    key={i}
                    className={'badge ' + (r.ok ? '' : 'red')}
                    style={{ fontSize: '0.72rem' }}
                  >
                    {r.event} {r.status ?? 'fail'}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background Jobs */}
      <div className="card col" style={{ gap: 14 }}>
        <div className="row spread">
          <div>
            <h3 style={{ margin: 0 }}>Asynchronous Job Workers</h3>
            <span className="small subtle">SMS notification dispatch & webhook queue</span>
          </div>
          <button
            className="btn ghost small"
            onClick={async () => {
              await apiPost('/admin/jobs/run-now')
              j.reload()
            }}
          >
            <Play size={14} />
            <span>Trigger Workers Now</span>
          </button>
        </div>

        <div className="row" style={{ gap: 8 }}>
          {Object.entries(j.data?.counts || {}).map(([k, v]) => (
            <span key={k} className="badge" style={{ background: 'var(--sage-soft)' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <Json data={j.data?.recent || []} max={180} />
      </div>
    </div>
  )
}

function PlanSection() {
  const t = useAsync(() => apiGet('/admin/tenant'), [])
  if (t.loading) return <Spinner label="Loading subscription & quota telemetry…" />
  const x = t.data

  return (
    <div className="card col" style={{ gap: 16 }}>
      <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Department Plan & Monthly Quota</h3>
          <span className="small subtle">Tenant: {x.name}</span>
        </div>
        <span className="badge" style={{ textTransform: 'uppercase' }}>
          {x.plan} Tier
        </span>
      </div>

      <div className="grid">
        <div className="card flat col" style={{ gap: 4, padding: 14 }}>
          <div className="kpi-l">Current Plan</div>
          <div className="kpi" style={{ textTransform: 'capitalize' }}>
            {x.plan}
          </div>
        </div>
        <div className="card flat col" style={{ gap: 4, padding: 14 }}>
          <div className="kpi-l">Monthly Claim Quota</div>
          <div className="kpi">
            {x.usage_this_month} / {x.monthly_quota}
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <div className="row spread small subtle">
          <span>Quota Consumption</span>
          <span className="mono">
            {Math.round((x.usage_this_month / Math.max(1, x.monthly_quota)) * 100)}%
          </span>
        </div>
        <div className="bar">
          <i
            style={{
              width:
                Math.min(100, (x.usage_this_month / Math.max(1, x.monthly_quota)) * 100) + '%'
            }}
          />
        </div>
        <span className="small subtle">
          Incoming claims will receive HTTP 429 when quota is fully saturated.
        </span>
      </div>

      <div className="row" style={{ gap: 10, paddingTop: 6 }}>
        {['free', 'pro', 'enterprise'].map((p) => (
          <button
            key={p}
            className={x.plan === p ? '' : 'ghost'}
            style={{ textTransform: 'capitalize' }}
            onClick={async () => {
              await apiPut('/admin/tenant/plan', { plan: p })
              t.reload()
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
