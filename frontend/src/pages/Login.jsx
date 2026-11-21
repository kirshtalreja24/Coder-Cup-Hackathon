import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield,
  Key,
  Mail,
  Lock,
  ArrowRight,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  UserCheck,
  Users,
  Briefcase,
  FileSearch
} from 'lucide-react'
import { BASE, login } from '../api'
import PrototypeBanner from '../components/PrototypeBanner'
import { LangSwitch, useLang } from '../i18n'

const HOME = {
  citizen: '/c',
  helper: '/h',
  officer: '/s/queue',
  admin: '/s/rules',
  auditor: '/s/audit'
}

const DEMO = [
  {
    role: 'Widow (Citizen)',
    email: 'widow-clean@citizen.demo',
    desc: 'Clean synthetic registry record — evaluates auto-approve flow',
    icon: UserCheck,
    badge: 'Auto-Approve'
  },
  {
    role: 'Citizen (Name Variant)',
    email: 'widow-variant@citizen.demo',
    desc: 'Spelling mismatch / incomplete data — triggers AI doubt handoff',
    icon: AlertTriangle,
    badge: 'Triage / Proof'
  },
  {
    role: 'Community Helper',
    email: 'helper@relief.demo',
    desc: 'Single community phone managing 40 families with auto-lock',
    icon: Users,
    badge: 'Helper Mode'
  },
  {
    role: 'Review Officer',
    email: 'officer1@relief.demo',
    desc: 'Triage queue, uncertainty reasons, and human-in-the-loop actions',
    icon: Briefcase,
    badge: 'Operations'
  },
  {
    role: 'System Admin',
    email: 'admin@relief.demo',
    desc: 'Eligibility rules editor, Digital Twin replay, risk cost dial',
    icon: Shield,
    badge: 'Controls'
  },
  {
    role: 'External Auditor',
    email: 'auditor@relief.demo',
    desc: 'Cryptographic hash-chain verifier, tamper detection, decisions',
    icon: FileSearch,
    badge: 'Audit Trail'
  }
]

export default function Login() {
  const nav = useNavigate()
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (e, p) => {
    setBusy(true)
    setErr('')
    try {
      const u = await login(e, p)
      nav(HOME[u.role])
    } catch (x) {
      setErr(
        x.offline
          ? 'No connection to the server. Check the API address or network.'
          : String(x.detail || x.message)
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container narrow col" style={{ paddingTop: 32, gap: 24 }}>
      {/* Prototype Banner */}
      <PrototypeBanner />

      {/* Hero Header */}
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 4 }}>
            <span className="brand-badge">
              <Shield size={22} strokeWidth={2.2} />
            </span>
            <h1 style={{ margin: 0 }}>BHAROSA</h1>
            <span className="brand-urdu" style={{ fontSize: '1.4rem' }}>
              بھروسہ
            </span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Public-service rails that <b>decide, explain, and protect</b> — designed for widows, low-literacy households, and fraud defense.
          </p>
        </div>
        <LangSwitch />
      </div>

      {/* Main Login Form */}
      <form
        className="card col"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          go(email.trim().toLowerCase(), pw)
        }}
      >
        <h3 style={{ margin: 0 }}>Account Sign In</h3>

        <div>
          <label>Email Address</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            placeholder="name@relief.demo"
            required
          />
        </div>

        <div>
          <label>Password</label>
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>

        {err && <div className="banner bad">{err}</div>}

        <button disabled={busy} type="submit" style={{ width: '100%' }}>
          <span>{busy ? 'Authenticating…' : 'Sign In'}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      {/* Judge One-Click Demo Personas */}
      <div className="card col" style={{ gap: 16 }}>
        <div className="row spread">
          <div>
            <h3 style={{ margin: 0 }}>One-Click Demo Personas</h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Prepared for judges · Password for all: <code className="mono">Demo#12345</code>
            </div>
          </div>
          <span className="badge amber">Instant Switch</span>
        </div>

        <div className="grid">
          {DEMO.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.email}
                className="bigbtn"
                style={{
                  minHeight: 120,
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: 16,
                  gap: 8
                }}
                disabled={busy}
                onClick={() => go(item.email, 'Demo#12345')}
              >
                <div className="row spread" style={{ width: '100%' }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon size={18} style={{ color: 'var(--forest)' }} />
                    <b style={{ fontSize: '0.98rem', color: 'var(--forest-dark)' }}>{item.role}</b>
                  </div>
                  <span className="mock-tag">{item.badge}</span>
                </div>
                <div className="small subtle" style={{ fontWeight: 400, lineHeight: 1.35 }}>
                  {item.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Useful Footer Links */}
      <div className="row spread small" style={{ padding: '0 4px' }}>
        <Link to="/public/scam" className="row" style={{ gap: 6 }}>
          <AlertTriangle size={15} style={{ color: 'var(--terracotta)' }} />
          <span>Verify a suspicious SMS (public check)</span>
        </Link>
        <a
          href={BASE + '/docs'}
          target="_blank"
          rel="noreferrer"
          className="row subtle"
          style={{ gap: 6 }}
        >
          <BookOpen size={15} />
          <span>API Documentation (Swagger)</span>
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
