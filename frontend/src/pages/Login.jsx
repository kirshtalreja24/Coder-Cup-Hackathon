import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BASE, login } from '../api'
import { LangSwitch, useLang } from '../i18n'

const HOME = { citizen: '/c', helper: '/h', officer: '/s/queue', admin: '/s/rules', auditor: '/s/audit' }
const DEMO = [
  ['👩 Widow (citizen)', 'widow-clean@citizen.demo', 'Clean data - should auto-approve'],
  ['🧕 Citizen - name spelled differently', 'widow-variant@citizen.demo', 'Name variants / missing fields'],
  ['🧑‍🤝‍🧑 Helper (40 families, 1 phone)', 'helper@relief.demo', 'Helper Mode'],
  ['🧑‍💼 Department officer', 'officer1@relief.demo', 'Review queue, handoffs'],
  ['🛠️ Admin', 'admin@relief.demo', 'Rules, Twin, Risk dial, keys'],
  ['🔎 Auditor (read-only)', 'auditor@relief.demo', 'Audit chain, traces'],
]

export default function Login() {
  const nav = useNavigate()
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (e, p) => {
    setBusy(true); setErr('')
    try { const u = await login(e, p); nav(HOME[u.role]) } catch (x) { setErr(x.offline ? 'No connection to the server. Check the API address / internet.' : String(x.detail || x.message)) } finally { setBusy(false) }
  }
  return (
    <div className="container narrow col" style={{ paddingTop: 28 }}>
      <div className="proto-bar" style={{ borderRadius: 10 }}>{t('proto')}</div>
      <div className="row spread"><h1 style={{ margin: 0 }}>🛡️ {t('app')} <span className="muted small">بھروسہ</span></h1><div style={{ background: 'var(--green)', borderRadius: 10 }}><LangSwitch /></div></div>
      <p className="muted">Public-service rails that <b>decide, explain and protect</b>, and say "I am not sure" when they should. All data is synthetic.</p>
      <form className="card col" onSubmit={(e) => { e.preventDefault(); go(email.trim().toLowerCase(), pw) }}>
        <div><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required /></div>
        <div><label>Password</label><input value={pw} onChange={(e) => setPw(e.target.value)} type="password" autoComplete="current-password" required /></div>
        {err && <div className="banner bad">{err}</div>}
        <button disabled={busy}>{busy ? '…' : 'Log in'}</button>
      </form>
      <div className="card col">
        <h3>🎬 Demo accounts <span className="muted small">(password for all: <code>Demo#12345</code>)</span></h3>
        {DEMO.map(([label, em, hint]) => (
          <button key={em} className="ghost" style={{ textAlign: 'left' }} disabled={busy} onClick={() => go(em, 'Demo#12345')}>
            {label}<br /><span className="small muted" style={{ fontWeight: 400 }}>{hint}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <Link to="/public/scam">🚨 Check a suspicious message (no login)</Link>
        <a href={BASE + '/docs'} target="_blank" rel="noreferrer">📘 API docs (Swagger)</a>
      </div>
    </div>
  )
}
