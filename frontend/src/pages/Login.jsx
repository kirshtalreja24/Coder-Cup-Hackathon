import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
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
  FileSearch,
  CheckCircle2
} from 'lucide-react'
import { BASE } from '../api'
import { useAuth, HOME, isRouteAllowed } from '../auth'
import PrototypeBanner from '../components/PrototypeBanner'
import { LangSwitch, useLang } from '../i18n'
import { Spinner } from '../ui'

const DEMO = [
  {
    key: 'citizen',
    role: 'Widow (Citizen)',
    email: 'widow-clean@citizen.demo',
    desc: 'Clean synthetic registry record — evaluates auto-approve flow',
    icon: UserCheck,
    badge: 'Citizen Role'
  },
  {
    key: 'citizen-variant',
    role: 'Citizen (Name Variant)',
    email: 'widow-variant@citizen.demo',
    desc: 'Spelling mismatch / incomplete data — triggers AI doubt handoff',
    icon: AlertTriangle,
    badge: 'Citizen Role'
  },
  {
    key: 'helper',
    role: 'Community Helper',
    email: 'helper@relief.demo',
    desc: 'Single community phone managing 40 families with auto-lock',
    icon: Users,
    badge: 'Helper Role'
  },
  {
    key: 'officer',
    role: 'Review Officer',
    email: 'officer1@relief.demo',
    desc: 'Triage queue, uncertainty reasons, and human-in-the-loop actions',
    icon: Briefcase,
    badge: 'Officer Role'
  },
  {
    key: 'admin',
    role: 'System Admin',
    email: 'admin@relief.demo',
    desc: 'Eligibility rules editor, Digital Twin replay, risk cost dial',
    icon: Shield,
    badge: 'Admin Role'
  },
  {
    key: 'auditor',
    role: 'External Auditor',
    email: 'auditor@relief.demo',
    desc: 'Cryptographic hash-chain verifier, tamper detection, decisions',
    icon: FileSearch,
    badge: 'Auditor Role'
  }
]

export default function Login() {
  const { user, loading, authError, validateSession, loginUser } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const { t } = useLang()
  
  const [selectedPersona, setSelectedPersona] = useState(null)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // If already authenticated with a valid session and no auth error, redirect away from /login
  useEffect(() => {
    if (!loading && user && !authError) {
      const fromPath = loc.state?.from?.pathname || (typeof loc.state?.from === 'string' ? loc.state.from : null)
      if (fromPath && isRouteAllowed(fromPath, user.role)) {
        nav(fromPath, { replace: true })
      } else {
        nav(HOME[user.role] || '/login', { replace: true })
      }
    }
  }, [user, loading, authError, nav, loc.state])

  // Select persona handler: updates selection and reference info, does NOT authenticate or navigate
  const handleSelectPersona = (item) => {
    setSelectedPersona(item)
    setEmail(item.email)
    setPw('')
    setErr('')
  }

  const go = async (e, p) => {
    setBusy(true)
    setErr('')
    try {
      const u = await loginUser(e, p)
      const fromPath = loc.state?.from?.pathname || (typeof loc.state?.from === 'string' ? loc.state.from : null)
      if (fromPath && isRouteAllowed(fromPath, u.role)) {
        nav(fromPath, { replace: true })
      } else {
        nav(HOME[u.role], { replace: true })
      }
    } catch (x) {
      setErr(
        x.offline
          ? 'No connection to the server. Check the API address or network.'
          : String(x.detail || x.message || 'Invalid username or password')
      )
    } finally {
      setBusy(false)
    }
  }

  // Display clean loading indicator while restoring or verifying session
  if (loading) {
    return (
      <div
        className="container center col"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          paddingTop: 64
        }}
      >
        <Spinner label="Verifying session security…" />
      </div>
    )
  }

  // Prevent flashing login content if user is already authenticated without error
  if (user && !authError) {
    return null
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

      {/* Step 1: Role Selection Cards */}
      <div className="card col" style={{ gap: 16 }}>
        <div className="row spread">
          <div>
            <h3 style={{ margin: 0 }}>Step 1: Select Your Role</h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Choose a role to configure the login form · Manual credential entry required
            </div>
          </div>
          <span className="badge amber">Role Selector</span>
        </div>

        <div className="grid">
          {DEMO.map((item) => {
            const Icon = item.icon
            const isSelected = selectedPersona?.email === item.email
            return (
              <button
                key={item.email}
                type="button"
                className="bigbtn"
                style={{
                  minHeight: 120,
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: 16,
                  gap: 8,
                  borderColor: isSelected ? 'var(--forest, #173D32)' : undefined,
                  borderWidth: isSelected ? 2 : 1,
                  background: isSelected ? 'rgba(23, 61, 50, 0.06)' : undefined,
                  boxShadow: isSelected ? '0 0 0 1px var(--forest, #173D32)' : undefined,
                  cursor: 'pointer'
                }}
                disabled={busy}
                onClick={() => handleSelectPersona(item)}
              >
                <div className="row spread" style={{ width: '100%' }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon size={18} style={{ color: isSelected ? 'var(--forest)' : 'var(--forest-dark)' }} />
                    <b style={{ fontSize: '0.98rem', color: 'var(--forest-dark)' }}>{item.role}</b>
                  </div>
                  {isSelected ? (
                    <span className="badge" style={{ background: 'var(--forest)', color: '#fff', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={12} /> Selected
                    </span>
                  ) : (
                    <span className="mock-tag">{item.badge}</span>
                  )}
                </div>
                <div className="small subtle" style={{ fontWeight: 400, lineHeight: 1.35 }}>
                  {item.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2: Main Login Form */}
      <form
        className="card col"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          go(email.trim().toLowerCase(), pw)
        }}
      >
        <div className="row spread">
          <div>
            <h3 style={{ margin: 0 }}>
              {selectedPersona ? `Step 2: Sign In as ${selectedPersona.role}` : 'Step 2: Account Sign In'}
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              Enter account credentials to authenticate with the backend
            </div>
          </div>
          {selectedPersona && (
            <span className="badge" style={{ background: '#eaf4ee', color: 'var(--forest)' }}>
              {selectedPersona.badge}
            </span>
          )}
        </div>

        {selectedPersona && (
          <div
            style={{
              background: 'rgba(196, 154, 86, 0.08)',
              border: '1px solid var(--champagne, #C49A56)',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: '0.88rem'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--forest-dark)', marginBottom: 4 }}>
              Reference Demo Credentials for {selectedPersona.role}:
            </div>
            <div className="subtle" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
              Username / Email: <code className="mono">{selectedPersona.email}</code>
              <br />
              Demo Password: <code className="mono">Demo#12345</code>
            </div>
          </div>
        )}

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
            placeholder="Enter password (e.g. Demo#12345)"
            required
          />
        </div>

        {authError && (
          <div className="banner bad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: '0.9rem' }}>{authError.message}</span>
            <button
              type="button"
              className="small"
              onClick={() => validateSession()}
              style={{ background: '#fff', color: 'var(--terracotta)', borderColor: 'var(--terracotta)', flexShrink: 0 }}
            >
              🔄 Retry
            </button>
          </div>
        )}
        {err && <div className="banner bad">{err}</div>}

        <button disabled={busy} type="submit" style={{ width: '100%' }}>
          <span>{busy ? 'Authenticating with Backend…' : 'Sign In'}</span>
          <ArrowRight size={16} />
        </button>
      </form>

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
