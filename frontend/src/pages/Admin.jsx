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
import { useLang } from '../i18n'

export default function Admin() {
  const { t, rtl, lang, localize } = useLang()
  const [tab, setTab] = useState('users')

  return (
    <div className={`col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ gap: 20 }}>
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>{localize('نظام کی انتظامیہ', 'System Administration', 'System Administration')}</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            {localize(
              'کیس ورکرز کے اختیارات، REST اسناد، ویب ہکس اور محکمانہ گنجائش',
              'Caseworkers ke ikhtiyarat, REST credentials, webhooks aur quota',
              'Caseworker access control, REST credentials, webhook pipelines, and departmental capacity'
            )}
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['users', localize('عملہ اور کیس ورکرز', 'Amla aur Caseworkers', 'Staff & Caseworkers')],
            ['keys', localize('ڈویلپر API چابیاں', 'Developer API Keys', 'Developer API Keys')],
            ['hooks', localize('ویب ہکس اور ڈسپیچر', 'Webhooks aur Dispatcher', 'Webhooks & Dispatcher')],
            ['plan', localize('محکمانہ کوٹہ و پلان', 'Mehkamana Quota', 'Department Quota')]
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
  const { rtl, localize } = useLang()
  const u = useAsync(() => apiGet('/admin/users'), [])
  const [f, setF] = useState({ email: '', name: '', role: 'officer', password: '' })
  const [err, setErr] = useState(null)
  const [filter, setFilter] = useState('')
  const rows = (u.data || []).filter((x) => x.role !== 'citizen' || filter)

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Create User Card */}
      <div className="card col" style={{ gap: 14 }}>
        <h3 style={{ margin: 0 }}>
          {localize('عملے اور کیس ورکر کے اکاؤنٹس تیار کریں', 'Amla aur caseworker accounts tayyar karein', 'Provision Staff & Caseworker Accounts')}
        </h3>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            placeholder={localize('سرکاری ای میل (مثلاً officer@relief.gov)', 'Sarkari email (maslan officer@relief.gov)', 'Official email (e.g. officer@relief.gov)')}
            style={{ flex: 1.5, minWidth: 200 }}
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          <input
            placeholder={localize('پورا نام', 'Poora Naam', 'Full Name')}
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
              <option key={r} value={r}>
                {r === 'citizen' ? localize('شہری (citizen)', 'Citizen', 'Citizen') :
                 r === 'helper' ? localize('مددگار (helper)', 'Helper', 'Helper') :
                 r === 'officer' ? localize('افسر (officer)', 'Officer', 'Officer') :
                 r === 'admin' ? localize('ایڈمن (admin)', 'Admin', 'Admin') :
                 localize('آڈیٹر (auditor)', 'Auditor', 'Auditor')}
              </option>
            ))}
          </select>
          <input
            placeholder={localize('پاس ورڈ (8+ حروف)', 'Password (8+ chars)', 'Password (8+ chars)')}
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
            <span>{localize('اکاؤنٹ بنائیں', 'Account banayein', 'Create')}</span>
          </button>
        </div>
        <ErrorBox e={err} />
      </div>

      {/* Users Table */}
      <div className="card col" style={{ gap: 14, padding: 0 }}>
        <div className="row spread" style={{ padding: '18px 20px 0', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{localize('فعال صارفین کی ڈائریکٹری', 'Faal sarfeen ki directory', 'Active User Directory')}</h3>
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
            <span>{localize('شہری درخواست گزاروں کے اکاؤنٹس بھی دکھائیں', 'Citizen accounts bhi shamil karein', 'Include citizen claimant accounts')}</span>
          </label>
        </div>

        {u.loading && <Spinner label={localize('عملے کی فہرست لوڈ ہو رہی ہے…', 'Amla ki fehrist load ho rahi hai…', 'Loading staff registry…')} />}

        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{localize('نام', 'Naam', 'Name')}</th>
                <th>{localize('ای میل ایڈریس', 'Email Address', 'Email Address')}</th>
                <th>{localize('تفویض کردہ کردار', 'Assigned Role', 'Assigned Role')}</th>
                <th>{localize('اکاؤنٹ کی حیثیت', 'Account Status', 'Account Status')}</th>
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
                        <option key={r} value={r}>
                          {r === 'citizen' ? localize('شہری (citizen)', 'Citizen', 'Citizen') :
                           r === 'helper' ? localize('مددگار (helper)', 'Helper', 'Helper') :
                           r === 'officer' ? localize('افسر (officer)', 'Officer', 'Officer') :
                           r === 'admin' ? localize('ایڈمن (admin)', 'Admin', 'Admin') :
                           localize('آڈیٹر (auditor)', 'Auditor', 'Auditor')}
                        </option>
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
                      {x.is_active ? localize('فعال', 'Active', 'Active') : localize('غیر فعال', 'Disabled', 'Disabled')}
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
  const { localize } = useLang()
  const k = useAsync(() => apiGet('/admin/api-keys'), [])
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState(null)
  const [err, setErr] = useState(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card col" style={{ gap: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>{localize('عوامی REST API اسناد', 'Public REST API Credentials', 'Public REST API Credentials')}</h3>
          <p className="small subtle" style={{ margin: '4px 0 0' }}>
            {localize('ہیڈر X-API-Key کے ساتھ /v1/* اینڈ پوائنٹس پر تصدیق کریں۔ تعاملی دستاویزات:', 'Header X-API-Key ke sath authenticate karein. Docs:', 'Authenticate with header X-API-Key: bh_... against /v1/* endpoints. Interactive docs:')}{' '}
            <a href={BASE + '/docs'} target="_blank" rel="noreferrer">
              Swagger UI <ExternalLink size={12} style={{ display: 'inline' }} />
            </a>{' '}
            ·{' '}
            <a href={BASE + '/openapi.json'} target="_blank" rel="noreferrer">
              OpenAPI JSON
            </a>
          </p>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 260 }}
            placeholder={localize("چابی کا نام یا صارف (مثلاً 'سندھ ریلیف ڈیش بورڈ')", "Key name ya consumer (maslan 'Sindh Relief Dashboard')", "Key name or consumer (e.g. 'Sindh Relief Dashboard')")}
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
            <span>{localize('چابی تیار کریں', 'Key generate karein', 'Generate Key')}</span>
          </button>
        </div>

        {fresh && (
          <div className="banner ok" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <div>
              {localize('چابی ابھی کاپی کریں (دوبارہ نہیں دکھائی جائے گی):', 'Key abhi copy karein (dobara nahi dikhayi jayegi):', 'Copy key now (never displayed again):')}{' '}
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
                <th>{localize('صارف کا نام', 'Consumer Name', 'Consumer Name')}</th>
                <th>{localize('سابقہ', 'Prefix', 'Prefix')}</th>
                <th>{localize('اجازت کے دائرے', 'Granted Scopes', 'Granted Scopes')}</th>
                <th>{localize('درخواستیں', 'Requests', 'Requests')}</th>
                <th>{localize('حیثیت', 'Status', 'Status')}</th>
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
                        {localize('منسوخ کریں', 'Mansookh karein', 'Revoke')}
                      </button>
                    ) : (
                      <span className="badge red">{localize('منسوخ شدہ', 'Revoked', 'Revoked')}</span>
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
  const { localize } = useLang()
  const w = useAsync(() => apiGet('/admin/webhooks'), [])
  const j = useAsync(() => apiGet('/admin/jobs'), [])
  const [url, setUrl] = useState('')
  const [fresh, setFresh] = useState(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Webhooks */}
      <div className="card col" style={{ gap: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>{localize('آؤٹ باؤنڈ ایونٹ ویب ہکس', 'Outbound Event Webhooks', 'Outbound Event Webhooks')}</h3>
          <p className="small subtle" style={{ margin: '4px 0 0' }}>
            {localize('HMAC-SHA256 کے ساتھ دستخط شدہ اور خودکار دوبارہ کوششوں کے ساتھ بھیجے جاتے ہیں۔', 'HMAC-SHA256 ke sath signed aur retries ke sath dispatched.', 'Signed with HMAC-SHA256 (X-Bharosa-Signature) and dispatched with exponential backoff retries.')}
          </p>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 260 }}
            placeholder={localize('ویب ہک کی منزل کا HTTPS URL', 'Webhook destination HTTPS URL', 'Webhook destination HTTPS URL')}
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
            <span>{localize('ویب ہک رجسٹر کریں', 'Webhook register karein', 'Register Webhook')}</span>
          </button>
        </div>

        {fresh && (
          <div className="banner ok" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <div>
              {localize('HMAC دستخطی راز (محفوظ رکھیں):', 'HMAC Signing Secret (mehfooz rakhein):', 'HMAC Signing Secret (store safely):')}{' '}
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
              <div className="row spread" style={{ flexWrap: 'wrap', gap: 6 }}>
                <b className="mono small" style={{ color: 'var(--forest)' }}>
                  {x.url}
                </b>
                <span className="small subtle">{localize('ایونٹس:', 'Events:', 'Events:')} {x.events.join(', ')}</span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
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
        <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>{localize('پس منظر کے اسسٹنٹ ورکرز', 'Background Jobs', 'Asynchronous Job Workers')}</h3>
            <span className="small subtle">{localize('ایس ایم ایس اطلاعات اور ویب ہک کی ترسیل', 'SMS aur webhook delivery queue', 'SMS notification dispatch & webhook queue')}</span>
          </div>
          <button
            className="btn ghost small"
            onClick={async () => {
              await apiPost('/admin/jobs/run-now')
              j.reload()
            }}
          >
            <Play size={14} />
            <span>{localize('ورکرز ابھی چلائیں', 'Workers abhi chalayein', 'Trigger Workers Now')}</span>
          </button>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
  const { localize } = useLang()
  const t = useAsync(() => apiGet('/admin/tenant'), [])
  if (t.loading) return <Spinner label={localize('سبسکرپشن اور کوٹہ لوڈ ہو رہا ہے…', 'Quota telemetry load ho rahi hai…', 'Loading subscription & quota telemetry…')} />
  const x = t.data

  return (
    <div className="card col" style={{ gap: 16 }}>
      <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>{localize('محکمانہ منصوبہ اور ماہانہ کوٹہ', 'Department Plan & Quota', 'Department Plan & Monthly Quota')}</h3>
          <span className="small subtle">{localize('ادارہ:', 'Idara:', 'Tenant:')} {x.name}</span>
        </div>
        <span className="badge" style={{ textTransform: 'uppercase' }}>
          {x.plan} {localize('درجہ', 'Tier', 'Tier')}
        </span>
      </div>

      <div className="grid">
        <div className="card flat col" style={{ gap: 4, padding: 14 }}>
          <div className="kpi-l">{localize('موجودہ پلان', 'Mojooda Plan', 'Current Plan')}</div>
          <div className="kpi" style={{ textTransform: 'capitalize' }}>
            {x.plan}
          </div>
        </div>
        <div className="card flat col" style={{ gap: 4, padding: 14 }}>
          <div className="kpi-l">{localize('ماہانہ درخواستوں کا کوٹہ', 'Mahana Darkhast Quota', 'Monthly Claim Quota')}</div>
          <div className="kpi">
            {x.usage_this_month} / {x.monthly_quota}
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <div className="row spread small subtle">
          <span>{localize('کوٹہ کا استعمال', 'Quota ka istemal', 'Quota Consumption')}</span>
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
          {localize('کوٹہ مکمل ہونے پر آنے والی درخواستوں کو HTTP 429 جواب دیا جائے گا۔', 'Quota mukammal hone par HTTP 429 diya jayega.', 'Incoming claims will receive HTTP 429 when quota is fully saturated.')}
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
