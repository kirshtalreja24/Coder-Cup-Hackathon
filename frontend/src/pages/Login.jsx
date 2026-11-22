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
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { BASE } from '../api'
import { useAuth, HOME, isRouteAllowed } from '../auth'
import PrototypeBanner from '../components/PrototypeBanner'
import { LangSwitch, useLang } from '../i18n'
import { Spinner } from '../ui'

export default function Login() {
  const { user, loading, authError, validateSession, loginUser } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const { t, rtl, localize } = useLang()

  const demoPersonas = [
    {
      key: 'citizen',
      role: localize('بیوہ خاتون (شہری)', 'Bewa Khatoon (Citizen)', 'Widow (Citizen)'),
      email: 'widow-clean@citizen.demo',
      desc: localize('صاف ریکارڈ — خودکار منظوری کا جائزہ', 'Saaf record — khudkar manzoori ka jaiza', 'Clean synthetic registry record — evaluates auto-approve flow'),
      icon: UserCheck,
      badge: localize('شہری', 'Citizen', 'Citizen Role')
    },
    {
      key: 'citizen-variant',
      role: localize('شہری (نام میں معمولی فرق)', 'Citizen (Naam mein farq)', 'Citizen (Name Variant)'),
      email: 'widow-variant@citizen.demo',
      desc: localize('ہجے کا فرق — اے آئی شک و انسانی جائزہ', 'Spelling mismatch — AI shak aur insani jaiza', 'Spelling mismatch / incomplete data — triggers AI doubt handoff'),
      icon: AlertTriangle,
      badge: localize('شہری', 'Citizen', 'Citizen Role')
    },
    {
      key: 'helper',
      role: localize('کمیونٹی مددگار', 'Community Helper', 'Community Helper'),
      email: 'helper@relief.demo',
      desc: localize('ایک فون سے متعدد خاندانوں کی مدد مع خودکار لاک', 'Aik phone se mukhtalif khandano ki madad', 'Single community phone managing 40 families with auto-lock'),
      icon: Users,
      badge: localize('مددگار', 'Helper', 'Helper Role')
    },
    {
      key: 'officer',
      role: localize('ریویو آفیسر', 'Review Officer', 'Review Officer'),
      email: 'officer1@relief.demo',
      desc: localize('جائزہ قطار، شکوک کی وجوہات اور انسانی فیصلے', 'Jaiza qataar aur insani faislay', 'Triage queue, uncertainty reasons, and human-in-the-loop actions'),
      icon: Briefcase,
      badge: localize('آفیسر', 'Officer', 'Officer Role')
    },
    {
      key: 'admin',
      role: localize('سسٹم ایڈمن', 'System Admin', 'System Admin'),
      email: 'admin@relief.demo',
      desc: localize('اہلیت کے قواعد کا ایڈیٹر، ڈیجیٹل ماڈل اور رسک ڈائل', 'Qawaid editor aur Digital Twin', 'Eligibility rules editor, Digital Twin replay, risk cost dial'),
      icon: Shield,
      badge: localize('ایڈمن', 'Admin', 'Admin Role')
    },
    {
      key: 'auditor',
      role: localize('بیرونی آڈیٹر', 'External Auditor', 'External Auditor'),
      email: 'auditor@relief.demo',
      desc: localize('کرپٹوگرافک ہیش چین اور فیصلوں کی آزادانہ جانچ', 'Cryptographic hash-chain aur jaiza', 'Cryptographic hash-chain verifier, tamper detection, decisions'),
      icon: FileSearch,
      badge: localize('آڈیٹر', 'Auditor', 'Auditor Role')
    }
  ]
  
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
      // keep only the KIND of failure; the words are chosen below in the language the person selected
      setErr({ offline: !!x.offline, status: x.status || 0 })
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
        <Spinner label={localize('سیشن کی تصدیق ہو رہی ہے…', 'Session ki tasdeeq ho rahi hai…', 'Verifying session security…')} />
      </div>
    )
  }

  // Prevent flashing login content if user is already authenticated without error
  if (user && !authError) {
    return null
  }

  return (
    <div className={`container narrow col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ paddingTop: 32, gap: 24 }}>
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
            {localize(
              'عوامی سروس جو فوری فیصلہ، مکمل وضاحت اور مکمل تحفظ فراہم کرے — بیواؤں، خاندانوں اور دھوکہ دہی کے خلاف دفاع کے لیے تیار کردہ۔',
              'Sarkari imdadi service jo faisla, mukammal wazahat aur tahaffuz faraham kare — bewaon aur khandano ke liye.',
              'Public-service rails that decide, explain, and protect — designed for widows, low-literacy households, and fraud defense.'
            )}
          </p>
        </div>
        <LangSwitch />
      </div>

      {/* Step 1: Role Selection Cards */}
      <div className="card col" style={{ gap: 16 }}>
        <div className="row spread">
          <div>
            <h3 style={{ margin: 0 }}>
              {localize('مرحلہ 1: اپنا کردار منتخب کریں', 'Marhala 1: Apna role muntakhib karein', 'Step 1: Select Your Role')}
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              {localize(
                'لاگ ان فارم کے لیے کردار منتخب کریں · دستی طور پر تفصیلات درج کرنا لازمی ہے',
                'Login form ke liye role muntakhib karein · Credentials manual darj karein',
                'Choose a role to configure the login form · Manual credential entry required'
              )}
            </div>
          </div>
          <span className="badge amber">
            {localize('کردار کا انتخاب', 'Role Selector', 'Role Selector')}
          </span>
        </div>

        <div className="grid">
          {demoPersonas.map((item) => {
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
                  textAlign: rtl ? 'right' : 'left',
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
                      <CheckCircle2 size={12} /> {localize('منتخب', 'Selected', 'Selected')}
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
              {selectedPersona
                ? localize(`مرحلہ 2: بطور ${selectedPersona.role} سائن ان کریں`, `Marhala 2: Batour ${selectedPersona.role} sign in karein`, `Step 2: Sign In as ${selectedPersona.role}`)
                : localize('مرحلہ 2: اکاؤنٹ میں سائن ان کریں', 'Marhala 2: Account mein sign in karein', 'Step 2: Account Sign In')}
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              {localize(
                'سسٹم میں داخل ہونے کے لیے یوزر نیم اور پاس ورڈ درج کریں',
                'System mein dakhil hone ke liye username aur password darj karein',
                'Enter account credentials to authenticate with the backend'
              )}
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
              {localize('تجرباتی لاگ ان کی تفصیلات (Reference):', 'Demo Reference Credentials:', 'Reference Demo Credentials for ' + selectedPersona.role + ':')}
            </div>
            <div className="subtle" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
              {localize('یوزر نیم / ای میل:', 'Username / Email:', 'Username / Email:')} <code className="mono">{selectedPersona.email}</code>
              <br />
              {localize('عام پاس ورڈ:', 'Demo Password:', 'Demo Password:')} <code className="mono">Demo#12345</code>
            </div>
          </div>
        )}

        <div>
          <label>{localize('ای میل یا یوزر نیم', 'Email ya username', 'Email Address')}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            placeholder="name@relief.demo"
            required
            dir="ltr"
          />
        </div>

        <div>
          <label>{localize('پاس ورڈ', 'Password', 'Password')}</label>
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder={localize('پاس ورڈ درج کریں (مثلاً Demo#12345)', 'Password darj karein (e.g. Demo#12345)', 'Enter password (e.g. Demo#12345)')}
            required
            dir="ltr"
          />
        </div>

        {authError && (
          <div className="banner bad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: '0.9rem' }}>
              {authError.status === 0
                ? localize('بھروسہ سرور تک رسائی نہیں ہو سکی۔ اپنا انٹرنیٹ یا سرور چیک کریں۔', 'Bharosa server tak rasai nahi ho saki. Apna internet ya server check karein.', 'Cannot reach the Bharosa server. Check your connection or API server.')
                : localize('تصدیقی سرور عارضی طور پر دستیاب نہیں۔', 'Tasdeeqi server aarzi taur par dastiyab nahi.', 'The authentication server is temporarily unavailable.')}
            </span>
            <button
              type="button"
              className="small"
              onClick={() => validateSession()}
              style={{ background: '#fff', color: 'var(--terracotta)', borderColor: 'var(--terracotta)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={12} />
              <span>{localize('دوبارہ کوشش کریں', 'Dobara koshish', 'Retry')}</span>
            </button>
          </div>
        )}
        {err && (
          <div className="banner bad" role="alert">
            {err.offline
              ? localize('سرور سے رابطہ نہیں ہو سکا۔ اپنا انٹرنیٹ چیک کریں۔', 'Server se rabta nahi ho saka. Apna internet check karein.', 'No connection to the server. Check your network.')
              : err.status === 401
                ? localize('ای میل یا پاس ورڈ غلط ہے۔ نیچے دی گئی مثال کے مطابق پورا ای میل لکھیں۔', 'Email ya password ghalat hai. Neeche di gayi misaal ke mutabiq poora email likhein.', 'Wrong email or password. Type the full email as in the example (for instance admin@relief.demo).')
                : err.status === 429
                  ? localize('بہت زیادہ ناکام کوششیں۔ چند منٹ بعد دوبارہ کوشش کریں۔', 'Bohat zyada nakam koshishein. Chand minute baad dobara koshish karein.', 'Too many failed attempts. Please wait a few minutes and try again.')
                  : localize('سائن ان نہیں ہو سکا۔ دوبارہ کوشش کریں۔', 'Sign in nahi ho saka. Dobara koshish karein.', 'Could not sign in. Please try again.')}
          </div>
        )}

        <button disabled={busy} type="submit" style={{ width: '100%' }}>
          <span>
            {busy
              ? localize('تصدیق کی جا رہی ہے…', 'Tasdeeq ki ja rahi hai…', 'Authenticating with Backend…')
              : localize('سائن ان کریں', 'Sign In karein', 'Sign In')}
          </span>
          <ArrowRight size={16} />
        </button>
      </form>

      {/* Useful Footer Links */}
      <div className="row spread small" style={{ padding: '0 4px' }}>
        <Link to="/public/scam" className="row" style={{ gap: 6 }}>
          <AlertTriangle size={15} style={{ color: 'var(--terracotta)' }} />
          <span>{localize('مشکوک ایس ایم ایس کی تصدیق کریں (عوامی سروس)', 'Mashkook SMS ki jaanch (Public check)', 'Verify a suspicious SMS (public check)')}</span>
        </Link>
        <a
          href={BASE + '/docs'}
          target="_blank"
          rel="noreferrer"
          className="row subtle"
          style={{ gap: 6 }}
        >
          <BookOpen size={15} />
          <span>{localize('API کی دستاویزات (Swagger)', 'API ki dastaweezat (Swagger)', 'API Documentation (Swagger)')}</span>
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
