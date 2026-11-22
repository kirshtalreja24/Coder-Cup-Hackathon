import React from 'react'
import { Shield } from 'lucide-react'
import { useLang } from '../i18n'

export default function PrototypeBanner() {
  const { localize } = useLang()
  return (
    <div className="proto-ribbon" role="note">
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
    </div>
  )
}
