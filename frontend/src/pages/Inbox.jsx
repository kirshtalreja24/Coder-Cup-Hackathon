import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { apiGet, apiPost, apiDel, when } from '../api'
import { useLang } from '../i18n'
import { ErrorBox, Spinner, useAsync } from '../ui'

const CH = { in_app: ['🔔', 'In-app'], sms: ['💬', 'SMS'], whatsapp: ['🟢', 'WhatsApp'], email: ['✉️', 'Email'] }

export default function Inbox() {
  const { t, localize } = useLang()
  const { data, loading, error, reload } = useAsync(() => apiGet('/notifications?limit=100'), [])
  const [busyId, setBusyId] = useState(null)
  const [clearBusy, setClearBusy] = useState(false)

  const mark = async (n) => {
    if (!n.read) {
      await apiPost(`/notifications/${n.id}/read`)
      reload()
    }
  }

  const removeNotification = async (e, n) => {
    e.stopPropagation()
    setBusyId(n.id)
    try {
      await apiDel(`/notifications/${n.id}`)
      reload()
    } catch {
      try {
        await apiPost(`/notifications/${n.id}/delete`)
        reload()
      } catch (err) {
        console.error(err)
      }
    } finally {
      setBusyId(null)
    }
  }

  const clearAllNotifications = async () => {
    setClearBusy(true)
    try {
      await apiDel('/notifications')
      reload()
    } catch {
      try {
        await apiPost('/notifications/clear')
        reload()
      } catch (err) {
        console.error(err)
      }
    } finally {
      setClearBusy(false)
    }
  }

  return (
    <div className="col">
      <div className="row spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2>🔔 {t('inbox')} {data?.unread > 0 && <span className="badge amber">{data.unread} new</span>}</h2>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="ghost small"
            onClick={async () => { await apiPost('/notifications/read-all'); reload() }}
            title={localize('تمام کو پڑھا ہوا نشان زد کریں', 'Tamam ko parha hua mark karein', 'Mark all read')}
          >
            ✓ {localize('سب پڑھیں', 'Sab parhein', 'Mark all read')}
          </button>
          {data?.items?.length > 0 && (
            <button
              className="ghost small"
              disabled={clearBusy}
              onClick={clearAllNotifications}
              style={{ color: 'var(--terracotta)', borderColor: 'rgba(166,93,73,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={localize('تمام پیغامات ہٹائیں', 'Tamam notifications hatayein', 'Clear all notifications')}
            >
              <Trash2 size={13} />
              <span>{clearBusy ? '...' : localize('سب ہٹائیں', 'Sab hatayein', 'Clear all')}</span>
            </button>
          )}
        </div>
      </div>
      <p className="hint">
        {localize(
          'ایپ کے نوٹیفیکیشنز اصلی ہیں۔ غیر ضروری پیغامات کو ڈیلیٹ کرنے کے لیے کراس یا ٹریش بٹن دبائیں۔',
          'In-app messages are real. Click remove icon to delete unwanted notifications.',
          'In-app messages are real. SMS, WhatsApp and email are simulated. Click remove on any unwanted notification to delete it.'
        )}
      </p>
      <ErrorBox e={error} />
      {loading && <Spinner />}
      {data?.items?.length === 0 && !loading && (
        <div className="card muted">
          {localize('کوئی نوٹیفکیشن موجود نہیں ہے۔', 'Koi notification nahi.', 'Nothing yet. Decisions and one-time codes appear here.')}
        </div>
      )}
      {data?.items?.map((n) => (
        <div
          key={n.id}
          onClick={() => mark(n)}
          className="card row"
          style={{
            cursor: 'pointer',
            textAlign: 'left',
            background: n.read ? 'var(--paper)' : 'var(--amber-soft)',
            color: 'var(--ink)',
            alignItems: 'flex-start',
            gap: 12,
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{CH[n.channel]?.[0]}</span>
          <span style={{ flex: 1 }}>
            <span className="small muted">
              {CH[n.channel]?.[1]}{n.simulated && ' · simulated'} · {when(n.created_at)}
            </span>
            <br />
            {n.body}
          </span>
          <div className="row" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {!n.read && n.channel === 'in_app' && <span className="badge amber">new</span>}
            <button
              type="button"
              className="btn ghost small"
              onClick={(e) => removeNotification(e, n)}
              disabled={busyId === n.id}
              title={localize('یہ نوٹیفکیشن ہٹائیں', 'Ye notification hatayein', 'Remove notification')}
              style={{
                padding: '4px 6px',
                height: 'auto',
                color: 'var(--terracotta)',
                background: 'rgba(166,93,73,0.08)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(166,93,73,0.2)',
                cursor: 'pointer'
              }}
              aria-label="Remove notification"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
