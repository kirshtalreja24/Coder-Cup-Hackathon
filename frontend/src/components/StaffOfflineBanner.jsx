import React, { useState } from 'react'
import { WifiOff, X } from 'lucide-react'
import { useLang } from '../i18n'

export default function StaffOfflineBanner({ online, pend, onOpenSyncCenter }) {
  const { t, localize } = useLang()
  const [dismissed, setDismissed] = useState(false)
  if (online || dismissed) return null

  return (
    <div style={{ padding: '0 24px 16px 24px' }}>
      <div
        className="banner offline"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--amber-soft, #FDF0D9)',
          border: '1.5px solid var(--amber, #E39B2B)'
        }}
        onClick={onOpenSyncCenter}
        role="alert"
      >
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <WifiOff size={20} style={{ color: 'var(--gold-dark, #92400E)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--forest-dark, #0D2318)' }}>
              {localize('آف لائن موڈ — مقامی طور پر کام جاری ہے', 'Offline Mode — Local kaam jaari hai', 'Offline Mode — Working Locally')}
            </strong>
            <div className="small subtle" style={{ marginTop: 2 }}>
              {t('saved_offline')} ({pend} {localize('باقی', 'baqi', 'pending')})
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn small"
            style={{
              background: 'var(--forest, #173D32)',
              color: '#FFFEFA',
              fontSize: '0.78rem',
              padding: '6px 14px'
            }}
            onClick={(e) => {
              e.stopPropagation()
              onOpenSyncCenter()
            }}
          >
            {localize('سنک سینٹر', 'Sync Center', 'Sync Center')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDismissed(true)
            }}
            title={localize('وارننگ ہٹائیں', 'Warning hatayein', 'Dismiss warning')}
            aria-label="Dismiss offline warning"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gold-dark, #92400E)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.8
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
