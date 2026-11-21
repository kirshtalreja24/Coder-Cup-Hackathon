import { apiGet, apiPost, when } from '../api'
import { useLang } from '../i18n'
import { ErrorBox, Spinner, useAsync } from '../ui'

const CH = { in_app: ['🔔', 'In-app'], sms: ['💬', 'SMS'], whatsapp: ['🟢', 'WhatsApp'], email: ['✉️', 'Email'] }

export default function Inbox() {
  const { t } = useLang()
  const { data, loading, error, reload } = useAsync(() => apiGet('/notifications?limit=100'), [])
  const mark = async (n) => { if (!n.read) { await apiPost(`/notifications/${n.id}/read`); reload() } }
  return (
    <div className="col">
      <div className="row spread"><h2>🔔 {t('inbox')} {data?.unread > 0 && <span className="badge amber">{data.unread} new</span>}</h2>
        <button className="ghost small" onClick={async () => { await apiPost('/notifications/read-all'); reload() }}>✓ mark all read</button></div>
      <p className="hint">In-app messages are real. SMS, WhatsApp and email are <b>simulated</b>: they are written here instead of being sent, so the channel logic can be shown without any real message.</p>
      <ErrorBox e={error} />{loading && <Spinner />}
      {data?.items.length === 0 && <div className="card muted">Nothing yet. Decisions and one-time codes appear here.</div>}
      {data?.items.map((n) => (
        <button key={n.id} onClick={() => mark(n)} className="card row" style={{ textAlign: 'left', background: n.read ? 'var(--paper)' : 'var(--amber-soft)', color: 'var(--ink)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.6rem' }}>{CH[n.channel]?.[0]}</span>
          <span style={{ flex: 1 }}><span className="small muted">{CH[n.channel]?.[1]}{n.simulated && ' · simulated'} · {when(n.created_at)}</span><br />{n.body}</span>
          {!n.read && n.channel === 'in_app' && <span className="badge amber">new</span>}
        </button>
      ))}
    </div>
  )
}
