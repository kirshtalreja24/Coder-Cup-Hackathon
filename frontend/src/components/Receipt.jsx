import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, BASE, getToken } from '../api'
import { useLang } from '../i18n'

// A signed receipt for the latest decision. Anyone can scan the QR / open the link and verify it without logging in.
// It contains no personal data: only the decision, rule version, time and the audit-log entry that recorded it.
export default function Receipt({ caseId }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [qr, setQr] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!open || data) return
    let url
    ;(async () => {
      try {
        setData(await api(`/cases/${caseId}/receipt`))
        const r = await fetch(`${BASE}/cases/${caseId}/receipt.png`, { headers: { Authorization: 'Bearer ' + getToken() } })
        if (r.ok) { url = URL.createObjectURL(await r.blob()); setQr(url) }
      } catch (e) { setErr(e) }
    })()
    return () => url && URL.revokeObjectURL(url)
  }, [open, caseId]) // eslint-disable-line

  if (!open) return <button className="ghost" onClick={() => setOpen(true)}>🧾 {t('receipt')}</button>
  return (
    <div className="card col" style={{ alignItems: 'center', textAlign: 'center' }}>
      <h3>🧾 {t('receipt')}</h3>
      {err && <div className="banner bad">Receipt unavailable ({err.offline ? 'offline' : String(err.detail || err.message)})</div>}
      {qr ? <img src={qr} alt="Receipt QR code" width="220" height="220" style={{ borderRadius: 12, border: '1px solid var(--line)' }} /> : !err && <p className="muted">⏳</p>}
      {data && <>
        <p className="small">{t('receiptnote')}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn small" to={`/verify?t=${encodeURIComponent(data.token)}`}>✔ {t('verify')}</Link>
          {qr && <a className="btn small ghost" href={qr} download="decision-receipt.png">⬇ PNG</a>}
          <button className="small ghost" onClick={() => navigator.clipboard?.writeText(data.verify_url)}>📋 link</button>
        </div>
        <code className="mono muted" style={{ wordBreak: 'break-all', fontSize: '.7rem' }}>{data.token.slice(0, 40)}…</code>
      </>}
    </div>
  )
}
