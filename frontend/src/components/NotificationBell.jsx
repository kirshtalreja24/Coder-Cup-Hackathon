import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Trash2, Check, X, ExternalLink } from 'lucide-react'
import { api, apiGet, apiPost, apiDel, when } from '../api'
import { useLang } from '../i18n'

const CH = {
  in_app: ['🔔', 'In-app'],
  sms: ['💬', 'SMS'],
  whatsapp: ['🟢', 'WhatsApp'],
  email: ['✉️', 'Email']
}

export default function NotificationBell({ online }) {
  const { t, localize, rtl } = useLang()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const panelRef = useRef(null)

  const fetchUnread = () => {
    if (!online && !navigator.onLine) return
    api('/notifications?unread_only=true&limit=1')
      .then((d) => setUnread(d.unread || 0))
      .catch(() => {})
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/notifications?limit=20')
      setItems(data.items || [])
      setUnread(data.unread || 0)
    } catch {
      // offline or error
    } finally {
      setLoading(false)
    }
  }

  // Periodic poll for unread badge count
  useEffect(() => {
    fetchUnread()
    const timer = setInterval(fetchUnread, 30000)
    return () => clearInterval(timer)
  }, [online])

  // Fetch items when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Mark single as read
  const handleMarkRead = async (n) => {
    if (n.read) return
    try {
      await apiPost(`/notifications/${n.id}/read`)
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
      setUnread((prev) => Math.max(0, prev - 1))
    } catch (e) {
      console.error(e)
    }
  }

  // Remove single unwanted notification
  const handleRemove = async (e, n) => {
    e.stopPropagation()
    setRemovingId(n.id)
    try {
      await apiDel(`/notifications/${n.id}`)
      setItems((prev) => prev.filter((item) => item.id !== n.id))
      if (!n.read && n.channel === 'in_app') {
        setUnread((prev) => Math.max(0, prev - 1))
      }
    } catch {
      try {
        await apiPost(`/notifications/${n.id}/delete`)
        setItems((prev) => prev.filter((item) => item.id !== n.id))
        if (!n.read && n.channel === 'in_app') {
          setUnread((prev) => Math.max(0, prev - 1))
        }
      } catch (err) {
        console.error(err)
      }
    } finally {
      setRemovingId(null)
    }
  }

  // Mark all read
  const handleMarkAllRead = async () => {
    try {
      await apiPost('/notifications/read-all')
      setItems((prev) => prev.map((item) => ({ ...item, read: true })))
      setUnread(0)
    } catch (e) {
      console.error(e)
    }
  }

  // Clear all notifications
  const handleClearAll = async () => {
    try {
      await apiDel('/notifications')
      setItems([])
      setUnread(0)
    } catch {
      try {
        await apiPost('/notifications/clear')
        setItems([])
        setUnread(0)
      } catch (e) {
        console.error(e)
      }
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="badge"
        aria-label="Notifications"
        aria-expanded={open}
        title={localize('اطلاعات و نوٹیفیکیشنز', 'Notifications', 'Notifications')}
        style={{
          cursor: 'pointer',
          border: 'none',
          padding: '6px 10px',
          background: unread > 0 ? '#ffd98a' : 'rgba(255, 255, 255, 0.2)',
          color: unread > 0 ? '#2b1b00' : '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontWeight: 600,
          borderRadius: 'var(--radius-full)'
        }}
      >
        <Bell size={14} strokeWidth={2.2} />
        {unread > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{unread}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [rtl ? 'left' : 'right']: 0,
            width: 340,
            maxWidth: '90vw',
            background: '#fff',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08)',
            border: '1.5px solid var(--border-subtle, #e2e8f0)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--ink, #1a202c)',
            textAlign: rtl ? 'right' : 'left'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--forest-dark, #102B24)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.92rem' }}>
              <Bell size={15} style={{ color: 'var(--champagne, #D5B982)' }} />
              <span>{t('inbox')}</span>
              {unread > 0 && (
                <span
                  style={{
                    background: 'var(--amber, #E39B2B)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}
                >
                  {unread}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title={localize('سب پڑھیں', 'Sab parhein', 'Mark all read')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    padding: '3px 7px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <Check size={12} />
                  <span>{localize('سب پڑھیں', 'Mark all', 'All read')}</span>
                </button>
              )}

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title={localize('تمام پیغامات صاف کریں', 'Clear all notifications', 'Clear all')}
                  style={{
                    background: 'rgba(255, 100, 100, 0.2)',
                    border: 'none',
                    color: '#ffcdd2',
                    cursor: 'pointer',
                    padding: '3px 7px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <Trash2 size={12} />
                  <span>{localize('صاف کریں', 'Clear', 'Clear')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Items list */}
          <div
            style={{
              maxHeight: 330,
              overflowY: 'auto',
              padding: '6px 0',
              background: '#fafafa'
            }}
          >
            {loading && items.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
                {localize('لوڈ ہو رہا ہے...', 'Loading...', 'Loading notifications…')}
              </div>
            )}

            {!loading && items.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#777', fontSize: '0.85rem' }}>
                {localize('کوئی نوٹیفکیشن موجود نہیں ہے۔', 'Koi notification nahi.', 'No notifications right now.')}
              </div>
            )}

            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 14px',
                  borderBottom: '1px solid #edf2f7',
                  background: n.read ? '#fff' : 'var(--amber-soft, #FDF0D9)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: 1 }}>
                  {CH[n.channel]?.[0] || '🔔'}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: '#718096', marginBottom: 2 }}>
                    <span>{CH[n.channel]?.[1] || n.channel}</span>
                    {n.simulated && <span> · simulated</span>}
                    <span> · {when(n.created_at)}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.84rem',
                      color: '#1a202c',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                      fontWeight: n.read ? 400 : 600
                    }}
                  >
                    {n.body}
                  </div>
                </div>

                {/* Remove / delete unwanted notification button */}
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, n)}
                  disabled={removingId === n.id}
                  title={localize('یہ نوٹیفکیشن ہٹائیں', 'Ye notification hatayein', 'Remove unwanted notification')}
                  aria-label="Remove notification"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--terracotta, #c2593f)',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.7,
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '8px 14px',
              background: '#f1f5f9',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem'
            }}
          >
            <span style={{ color: '#64748b', fontSize: '0.76rem' }}>
              {localize('غیر ضروری پیغامات ٹریش سے ہٹائیں', 'Unwanted notifications can be removed', 'Click trash to remove unwanted notifications')}
            </span>
            <Link
              to="/inbox"
              onClick={() => setOpen(false)}
              style={{
                color: 'var(--forest-dark, #102B24)',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>{localize('مکمل ان باکس', 'Full Inbox', 'Full Inbox')}</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
