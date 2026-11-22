import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLang } from '../i18n'

export default function PrototypeBanner() {
  const { localize } = useLang()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('bh_dismiss_proto_warning') === 'true'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem('bh_dismiss_proto_warning', 'true')
    } catch {}
  }

  return (
    <div className="proto-ribbon" role="note" style={{ position: 'relative', paddingRight: 36 }}>
      <span className="proto-pill">
        {localize('صرف تجرباتی نمونہ', 'Prototype Only', 'PROTOTYPE ONLY')}
      </span>
      <span>
        {localize(
          'کوڈرز کپ 26 اے آئی ہیکاتھون · صرف فرضی و تجرباتی ریکارڈز · سرکاری سروس نہیں',
          "Coder's Cup '26 AI Hackathon · Synthetic Records · Sarkari Service Nahi",
          "Coder's Cup '26 AI Hackathon · Synthetic Records Only · Not an Official Service"
        )}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Remove warning message"
        title={localize('وارننگ میسج ہٹائیں', 'Warning message hatayein', 'Remove warning message')}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: 'var(--ivory)',
          cursor: 'pointer',
          padding: '2px 4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
          borderRadius: 4
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

