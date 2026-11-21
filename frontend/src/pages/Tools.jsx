import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Volume2,
  VolumeX,
  Mic as MicIcon,
  Square,
  Search,
  BookOpen,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  UserCheck,
  RotateCcw,
  Edit3,
  Languages,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Send,
  Radio
} from 'lucide-react'
import { api, apiPost, getToken } from '../api'
import { useLang } from '../i18n'
import {
  canListen,
  listen,
  playPrompt,
  speak,
  stop,
  replayLast,
  getVoiceStatus,
  onAudioState,
  PRE_RENDERED_PROMPTS
} from '../voice'
import { ErrorBox, MockTag } from '../ui'
import { VoiceAssistant } from '../components/VoiceAssistantModal'

const AREAS = [
  'Karachi East',
  'Karachi West',
  'Karachi Central',
  'Korangi',
  'Malir',
  'Hyderabad',
  'Sukkur',
  'Larkana',
  'Lahore',
  'Peshawar',
  'Quetta',
  'Multan'
]

const COLORS = {
  SCAM: ['stop', ShieldAlert],
  SUSPICIOUS: ['wait', AlertTriangle],
  LIKELY_REAL: ['good', ShieldCheck],
  UNSURE: ['human', UserCheck]
}

function Mic({ onText, lang = 'ur-PK' }) {
  const [rec, setRec] = useState(false)
  const stopRef = useRef(null)

  if (!canListen()) return null

  return (
    <button
      type="button"
      className={'btn small ' + (rec ? 'danger' : 'ghost')}
      onClick={() => {
        if (rec) {
          stopRef.current?.()
          return
        }
        setRec(true)
        stopRef.current = listen({
          lang,
          onResult: onText,
          onEnd: () => setRec(false),
          onError: () => setRec(false)
        })
      }}
      title="Speak message in Urdu"
    >
      {rec ? <Square size={14} /> : <MicIcon size={14} />}
      <span>{rec ? 'Listening…' : 'Speak'}</span>
    </button>
  )
}

export function ScamPage({ pub }) {
  const { t, lang } = useLang()
  const [text, setText] = useState('')
  const [sender, setSender] = useState('')
  const [area, setArea] = useState('Karachi East')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [samples, setSamples] = useState([])
  const [pasteNotice, setPasteNotice] = useState(false)

  useEffect(() => {
    api('/demo/scenarios', { auth: false })
      .then((d) => setSamples(d.scam_samples || []))
      .catch(() => {})
  }, [])

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const clip = await navigator.clipboard.readText()
        if (clip) {
          setText(clip)
          setPasteNotice(true)
          setTimeout(() => setPasteNotice(false), 2200)
          return
        }
      }
      setPasteNotice('empty')
      setTimeout(() => setPasteNotice(false), 2200)
    } catch {
      setPasteNotice('denied')
      setTimeout(() => setPasteNotice(false), 3000)
    }
  }

  const check = async (overrideText, overrideSender) => {
    const textToCheck = (overrideText ?? text).trim()
    const senderToCheck = (overrideSender ?? sender).trim()
    if (!textToCheck) return

    setBusy(true)
    setErr(null)
    setRes(null)
    try {
      const r = await apiPost(
        pub || !getToken() ? '/public/scam-check' : '/scam/check',
        { text: textToCheck, sender: senderToCheck || null, area, report: true },
        { auth: !pub }
      )
      setRes(r)
      const a = r.advice?.[lang === 'ur' ? 'ur' : 'en'] || r.advice?.en
      if (r.verdict === 'SCAM' || r.verdict === 'SUSPICIOUS') {
        playPrompt('scam_alert', a, lang === 'ur' ? 'ur' : 'en')
      } else if (r.verdict === 'LIKELY_REAL') {
        playPrompt('scam_ok', a, lang === 'ur' ? 'ur' : 'en')
      } else {
        speak(a, lang === 'ur' ? 'ur' : 'en')
      }
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  // Determine outcome mode: 'suspicious', 'safe', or 'uncertain'
  const outcomeMode = !res
    ? null
    : res.verdict === 'LIKELY_REAL'
    ? 'safe'
    : res.verdict === 'UNSURE' || res.handoff
    ? 'uncertain'
    : 'suspicious'

  return (
    <div className="col narrow" style={{ gap: 24, maxWidth: 760, margin: '0 auto' }}>
      {/* Page Title & Subtitle */}
      <div className="card flat" style={{ background: 'linear-gradient(135deg, var(--forest-soft) 0%, var(--card) 100%)', border: '1.5px solid rgba(23, 61, 50, 0.15)', padding: '24px 28px' }}>
        <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="badge" style={{ background: 'var(--forest)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                CITIZEN PROTECTION
              </span>
              {pub && (
                <span className="badge" style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)', fontSize: '0.75rem' }}>
                  Public Service · No Login Required
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--forest-dark)', lineHeight: 1.25 }}>
              Is this relief message real?
            </h1>
            <div style={{ fontSize: '1.15rem', color: 'var(--forest)', fontWeight: 600, marginTop: 4, direction: 'rtl', textAlign: 'left' }}>
              کیا یہ امدادی پیغام اصلی ہے؟
            </div>
            <p className="small muted" style={{ margin: '8px 0 0', maxWidth: 560, lineHeight: 1.5 }}>
              Verify suspicious SMS, WhatsApp messages, and phone numbers before sending money or sharing your CNIC. Government relief is always free.
            </p>
          </div>

          {pub && (
            <Link to="/login" className="btn small ghost" style={{ alignSelf: 'flex-start' }}>
              Citizen Log In <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Safety Instructions Card */}
      <div className="card" style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '20px 22px' }}>
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <Sparkles size={18} style={{ color: 'var(--gold-dark)' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--forest-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            3 Essential Safety Rules
          </h3>
        </div>

        <div className="admin-grid-3" style={{ gap: 12 }}>
          <div style={{ background: 'var(--ivory)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.25rem' }}>🛡️</span>
              <b style={{ color: 'var(--forest-dark)', fontSize: '0.9rem' }}>Relief is Always Free</b>
            </div>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
              The government never charges any registration, processing, or wallet transfer fee.
            </p>
          </div>

          <div style={{ background: 'var(--ivory)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.25rem' }}>🔢</span>
              <b style={{ color: 'var(--forest-dark)', fontSize: '0.9rem' }}>8171 is Sole Sender</b>
            </div>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
              Official BISP/Ehsaas notifications come only from 4-digit shortcode <b>8171</b>, never an 11-digit mobile number.
            </p>
          </div>

          <div style={{ background: 'var(--ivory)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.25rem' }}>🔒</span>
              <b style={{ color: 'var(--forest-dark)', fontSize: '0.9rem' }}>Never Share Your PIN</b>
            </div>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
              No officer, shopkeeper, or agent will ever ask for your ATM PIN or biometric OTP.
            </p>
          </div>
        </div>
      </div>

      {/* Message Input Area */}
      <div className="card col" style={{ gap: 18, border: '1.5px solid var(--forest)', boxShadow: '0 4px 16px rgba(23, 61, 50, 0.08)' }}>
        <div className="row spread" style={{ alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--forest-dark)', marginBottom: 2 }}>
              Paste or type the message you received
            </label>
            <div className="small subtle">
              ہمیں وہ پیغام دکھائیں جو آپ کو ملا ہے (SMS یا WhatsApp)
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn small ghost"
              onClick={handlePaste}
              title="Paste from clipboard"
              style={{ fontWeight: 600 }}
            >
              <span>📋 Paste message</span>
            </button>
            <Mic onText={(x) => setText((p) => (p ? p + ' ' + x : x))} />
          </div>
        </div>

        {pasteNotice && (
          <div className="small banner" style={{ background: pasteNotice === 'denied' ? 'var(--terracotta-soft)' : 'var(--sage-soft)', margin: 0 }}>
            {pasteNotice === 'denied'
              ? 'Clipboard access denied by browser. Please paste using Ctrl+V or Cmd+V.'
              : pasteNotice === 'empty'
              ? 'Clipboard was empty. Please copy a message first.'
              : 'Message pasted successfully from clipboard!'}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. BISP relief approved for your CNIC. Send Rs 500 fee to JazzCash 0300-1234567 to activate your Rs 25,000 cash grant..."
            dir="auto"
            style={{
              fontSize: '1.05rem',
              minHeight: 140,
              lineHeight: 1.5,
              padding: '14px 16px',
              borderRadius: 'var(--radius)',
              border: '1.5px solid var(--border)',
              background: '#fff'
            }}
          />
          {text && (
            <div className="row spread" style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--muted)' }}>
              <span>{text.length} characters</span>
              <button
                type="button"
                className="btn ghost small"
                style={{ padding: '2px 8px', height: 'auto', fontSize: '0.75rem' }}
                onClick={() => { setText(''); setRes(null); }}
              >
                Clear text
              </button>
            </div>
          )}
        </div>

        {/* Sender & Area Selection */}
        <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Sender Shortcode / Phone Number (Optional)
            </label>
            <input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="e.g. 8171 or 0300-1112223"
              style={{ background: '#fff' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Your District / Area
            </label>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={{ background: '#fff' }}>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Analyze Action Button */}
        <div className="row spread" style={{ paddingTop: 4 }}>
          <button
            className="btn"
            style={{
              padding: '14px 28px',
              fontSize: '1.05rem',
              fontWeight: 700,
              background: 'var(--forest)',
              color: '#fff',
              flex: 1,
              maxWidth: 320
            }}
            disabled={busy || !text.trim()}
            onClick={() => check()}
          >
            <Search size={18} />
            <span>{busy ? 'Verifying with Scam Engine…' : 'Analyze Message'}</span>
          </button>

          <span className="small muted" style={{ alignSelf: 'center' }}>
            Multi-signal AI + rule check
          </span>
        </div>

        {/* Preset Example Cards */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
          <div className="small subtle" style={{ fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tap an example message to test:
          </div>
          <div className="col" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn ghost small"
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                background: 'var(--terracotta-soft)',
                border: '1px solid rgba(166, 93, 73, 0.25)',
                padding: '10px 14px'
              }}
              onClick={() => {
                const sampleText = 'BISP Relief Rs 25000 approved for you. Reply with CNIC and fee Rs 500 to JazzCash 0300-7654321 to receive payment.'
                const sampleSender = '0300-1112223'
                setText(sampleText)
                setSender(sampleSender)
                check(sampleText, sampleSender)
              }}
            >
              <span className="badge red small" style={{ marginRight: 6 }}>🚨 FAKE FEE SCAM</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--terracotta-dark)' }}>
                [0300-1112223] "BISP Relief Rs 25000 approved... Send fee Rs 500 to JazzCash..."
              </span>
            </button>

            <button
              type="button"
              className="btn ghost small"
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                background: 'var(--forest-soft)',
                border: '1px solid rgba(23, 61, 50, 0.2)',
                padding: '10px 14px'
              }}
              onClick={() => {
                const sampleText = 'Your relief payment of Rs 25000 is ready at your nearest retailer. Take your original ID. No charges apply.'
                const sampleSender = '8171'
                setText(sampleText)
                setSender(sampleSender)
                check(sampleText, sampleSender)
              }}
            >
              <span className="badge green small" style={{ marginRight: 6 }}>🛡️ OFFICIAL 8171</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--forest-dark)' }}>
                [8171] "Your relief payment of Rs 25000 is ready at your nearest retailer. Take original ID. No charges apply."
              </span>
            </button>

            <button
              type="button"
              className="btn ghost small"
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                background: 'var(--gold-soft)',
                border: '1px solid rgba(196, 154, 86, 0.3)',
                padding: '10px 14px'
              }}
              onClick={() => {
                const sampleText = 'Government relief status update: Please verify your application record with your village counselor.'
                const sampleSender = '0312-9876543'
                setText(sampleText)
                setSender(sampleSender)
                check(sampleText, sampleSender)
              }}
            >
              <span className="badge amber small" style={{ marginRight: 6 }}>⚠️ UNCERTAIN CASE</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--gold-dark)' }}>
                [0312-9876543] "Government relief status update: Please verify your application record..."
              </span>
            </button>
          </div>
        </div>
      </div>

      <ErrorBox e={err} />

      {/* 3 DISTINCT RESULT OUTCOMES */}
      {res && (
        <div className="col" style={{ gap: 16 }}>
          {/* Outcome 1: SUSPICIOUS / FRAUD DETECTED */}
          {outcomeMode === 'suspicious' && (
            <div
              className="card col"
              style={{
                background: 'var(--terracotta-soft)',
                border: '2px solid var(--terracotta)',
                padding: '28px 26px',
                borderRadius: 'var(--radius-xl)',
                gap: 20
              }}
            >
              <div className="row spread" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--terracotta)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <ShieldAlert size={32} />
                  </div>
                  <div>
                    <span className="badge red" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>
                      STRONG WARNING · HIGH FRAUD RISK
                    </span>
                    <h2 style={{ margin: '4px 0 0', color: 'var(--terracotta-dark)', fontSize: '1.6rem' }}>
                      Suspicious — Do Not Pay or Reply
                    </h2>
                    <div style={{ color: 'var(--terracotta-dark)', fontSize: '1.1rem', direction: 'rtl', textAlign: 'left', fontWeight: 600, marginTop: 2 }}>
                      خبردار: یہ پیغام دھوکہ دہی لگتا ہے۔ جواب نہ دیں اور پیسے نہ بھیجیں۔
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--terracotta-dark)' }}>
                    {Math.round((res.score ?? 0.95) * 100)}%
                  </div>
                  <div className="small subtle">Risk Score</div>
                </div>
              </div>

              {/* Plain Language Explanation */}
              <div style={{ background: '#fff', padding: '16px 20px', borderRadius: 'var(--radius)', border: '1px solid rgba(166, 93, 73, 0.3)' }}>
                <div className="row spread" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                  <b style={{ color: 'var(--terracotta-dark)', fontSize: '0.95rem' }}>AI Explanation:</b>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => speak(res.advice?.[lang === 'ur' ? 'ur' : 'en'] || res.advice?.en, lang === 'ur' ? 'ur' : 'en')}
                    title="Listen in speech"
                  >
                    <Volume2 size={14} />
                    <span>Listen</span>
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.5, color: '#1a1a1a' }}>
                  {res.advice?.[lang === 'ur' ? 'ur' : 'en'] || res.advice?.en}
                </p>
              </div>

              {/* Detected Scam Indicators */}
              <div>
                <b style={{ color: 'var(--terracotta-dark)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Detected Scam Indicators:
                </b>
                <div className="col" style={{ gap: 8, marginTop: 8 }}>
                  {res.reasons?.map((r, i) => (
                    <div
                      key={i}
                      className="row spread"
                      style={{
                        background: 'rgba(255, 255, 255, 0.8)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid rgba(166, 93, 73, 0.2)'
                      }}
                    >
                      <div className="row" style={{ gap: 8 }}>
                        <XCircle size={16} style={{ color: 'var(--terracotta)' }} />
                        <span style={{ fontSize: '0.9rem', color: '#1a1a1a' }}>{r.text}</span>
                      </div>
                      <span className="mono bold" style={{ color: 'var(--terracotta)', fontSize: '0.85rem' }}>
                        +{Math.abs(r.weight)} risk
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What the user should do next */}
              <div style={{ background: '#fff', padding: '18px 20px', borderRadius: 'var(--radius)', border: '1.5px solid var(--terracotta)' }}>
                <h4 style={{ margin: '0 0 10px', color: 'var(--terracotta-dark)', fontSize: '1.05rem' }}>
                  What You Should Do Next:
                </h4>
                <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6, fontSize: '0.95rem', color: '#1a1a1a' }}>
                  <li><b>Do NOT send any money or fee</b> via JazzCash, EasyPaisa, or bank transfer under any circumstances.</li>
                  <li><b>Do NOT click any web link</b> or provide your CNIC or ATM PIN.</li>
                  <li><b>Block this phone number</b> immediately on your mobile device.</li>
                  <li>If you wish to check real relief status, dial official helpline <b>8171</b> or visit your local Tehsil office.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Outcome 2: PROBABLY SAFE (NOT A GUARANTEE) */}
          {outcomeMode === 'safe' && (
            <div
              className="card col"
              style={{
                background: 'var(--forest-soft)',
                border: '2px solid var(--forest)',
                padding: '28px 26px',
                borderRadius: 'var(--radius-xl)',
                gap: 20
              }}
            >
              <div className="row spread" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--forest)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <span className="badge green" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>
                      CONSISTENT WITH OFFICIAL NOTIFICATIONS
                    </span>
                    <h2 style={{ margin: '4px 0 0', color: 'var(--forest-dark)', fontSize: '1.6rem' }}>
                      Probably Safe — Official Channel Match
                    </h2>
                    <div style={{ color: 'var(--forest-dark)', fontSize: '1.1rem', direction: 'rtl', textAlign: 'left', fontWeight: 600, marginTop: 2 }}>
                      یہ پیغام بظاہر سرکاری چینل سے مطابقت رکھتا ہے۔
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--forest-dark)' }}>
                    {Math.round((res.score ?? 0.12) * 100)}%
                  </div>
                  <div className="small subtle">Risk Score (Low)</div>
                </div>
              </div>

              {/* CRITICAL EXPLICIT DISCLAIMER: NOT A GUARANTEE */}
              <div
                style={{
                  background: 'var(--gold-soft)',
                  border: '1.5px solid var(--gold)',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius)',
                  color: 'var(--gold-dark)'
                }}
              >
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <AlertTriangle size={18} style={{ color: 'var(--gold-dark)', flexShrink: 0 }} />
                  <b style={{ fontSize: '0.95rem' }}>Important: Not a Guarantee of Authenticity</b>
                </div>
                <p className="small" style={{ margin: 0, lineHeight: 1.5, color: '#4a3b1a' }}>
                  This AI evaluation assesses pattern similarity against known relief templates. It is <b>not an official guarantee</b>. Phone numbers can occasionally be spoofed. Never share your private ATM PIN, OTP, or mobile wallet password with anyone.
                </p>
              </div>

              {/* Plain Language Explanation */}
              <div style={{ background: '#fff', padding: '16px 20px', borderRadius: 'var(--radius)', border: '1px solid rgba(23, 61, 50, 0.2)' }}>
                <div className="row spread" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                  <b style={{ color: 'var(--forest-dark)', fontSize: '0.95rem' }}>AI Explanation:</b>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => speak(res.advice?.[lang === 'ur' ? 'ur' : 'en'] || res.advice?.en, lang === 'ur' ? 'ur' : 'en')}
                    title="Listen in speech"
                  >
                    <Volume2 size={14} />
                    <span>Listen</span>
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.5, color: '#1a1a1a' }}>
                  {res.advice?.[lang === 'ur' ? 'ur' : 'en'] || res.advice?.en}
                </p>
              </div>

              {/* Detected Indicators */}
              <div>
                <b style={{ color: 'var(--forest-dark)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Verified Attributes:
                </b>
                <div className="col" style={{ gap: 8, marginTop: 8 }}>
                  {res.reasons?.map((r, i) => (
                    <div
                      key={i}
                      className="row spread"
                      style={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid rgba(23, 61, 50, 0.15)'
                      }}
                    >
                      <div className="row" style={{ gap: 8 }}>
                        <CheckCircle2 size={16} style={{ color: 'var(--forest)' }} />
                        <span style={{ fontSize: '0.9rem', color: '#1a1a1a' }}>{r.text}</span>
                      </div>
                      <span className="mono bold" style={{ color: 'var(--forest)', fontSize: '0.85rem' }}>
                        {r.weight} risk
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What the user should do next */}
              <div style={{ background: '#fff', padding: '18px 20px', borderRadius: 'var(--radius)', border: '1.5px solid var(--forest)' }}>
                <h4 style={{ margin: '0 0 10px', color: 'var(--forest-dark)', fontSize: '1.05rem' }}>
                  What You Should Do Next:
                </h4>
                <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6, fontSize: '0.95rem', color: '#1a1a1a' }}>
                  <li><b>Verify sender shortcode</b>: Confirm the message arrived strictly from <b>8171</b> in your phone's SMS app.</li>
                  <li><b>Visit an authorized retailer</b>: Bring your original CNIC to an official biometric center or bank agent.</li>
                  <li><b>Never pay any agent fee</b>: Authorized retailers are paid by the government and cannot deduct any fee from your payment.</li>
                  <li>If retailer demands a fee, refuse and immediately report them by calling <b>8171</b>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Outcome 3: UNCERTAIN / HUMAN VERIFICATION RECOMMENDED */}
          {outcomeMode === 'uncertain' && (
            <div
              className="card col"
              style={{
                background: 'var(--gold-soft)',
                border: '2px solid var(--gold)',
                padding: '28px 26px',
                borderRadius: 'var(--radius-xl)',
                gap: 20
              }}
            >
              <div className="row spread" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--gold-dark)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <UserCheck size={32} />
                  </div>
                  <div>
                    <span className="badge amber" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>
                      SYSTEM ABSTAINED · HUMAN VERIFICATION REQUIRED
                    </span>
                    <h2 style={{ margin: '4px 0 0', color: 'var(--gold-dark)', fontSize: '1.6rem' }}>
                      Uncertain — Verification Recommended
                    </h2>
                    <div style={{ color: 'var(--gold-dark)', fontSize: '1.1rem', direction: 'rtl', textAlign: 'left', fontWeight: 600, marginTop: 2 }}>
                      غیر یقینی — تصدیق کے لیے ہیلپ لائن 8171 سے رابطہ کریں۔
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold-dark)' }}>
                    {Math.round((res.score ?? 0.48) * 100)}%
                  </div>
                  <div className="small subtle">Moderate Uncertainty</div>
                </div>
              </div>

              {/* Explain why the system abstained */}
              <div style={{ background: '#fff', padding: '16px 20px', borderRadius: 'var(--radius)', border: '1px solid rgba(196, 154, 86, 0.3)' }}>
                <div className="row spread" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                  <b style={{ color: 'var(--gold-dark)', fontSize: '0.95rem' }}>Why the AI Abstained:</b>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => speak(res.advice?.[lang === 'ur' ? 'ur' : 'en'] || res.advice?.en, lang === 'ur' ? 'ur' : 'en')}
                    title="Listen in speech"
                  >
                    <Volume2 size={14} />
                    <span>Listen</span>
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.5, color: '#1a1a1a' }}>
                  {res.advice?.[lang === 'ur' ? 'ur' : 'en'] || res.advice?.en}
                </p>
                <p className="small muted" style={{ margin: '8px 0 0', lineHeight: 1.45 }}>
                  The message lacks distinct official signatures or blatant fraud keywords. Rather than guessing, the system abstains and advises human confirmation.
                </p>
              </div>

              {/* Detected Indicators */}
              <div>
                <b style={{ color: 'var(--gold-dark)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Analysis Notes:
                </b>
                <div className="col" style={{ gap: 8, marginTop: 8 }}>
                  {res.reasons?.map((r, i) => (
                    <div
                      key={i}
                      className="row spread"
                      style={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid rgba(196, 154, 86, 0.2)'
                      }}
                    >
                      <div className="row" style={{ gap: 8 }}>
                        <Info size={16} style={{ color: 'var(--gold-dark)' }} />
                        <span style={{ fontSize: '0.9rem', color: '#1a1a1a' }}>{r.text}</span>
                      </div>
                      <span className="mono bold" style={{ color: 'var(--gold-dark)', fontSize: '0.85rem' }}>
                        {r.weight > 0 ? `+${r.weight}` : r.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What the user should do next */}
              <div style={{ background: '#fff', padding: '18px 20px', borderRadius: 'var(--radius)', border: '1.5px solid var(--gold)' }}>
                <h4 style={{ margin: '0 0 10px', color: 'var(--gold-dark)', fontSize: '1.05rem' }}>
                  What You Should Do Next:
                </h4>
                <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6, fontSize: '0.95rem', color: '#1a1a1a' }}>
                  <li><b>Pause and take no immediate action</b>: Do not reply, click any link, or send money.</li>
                  <li><b>Call the Official 8171 Helpline</b>: A human support officer will check your CNIC in the official national database.</li>
                  <li><b>Visit your local Tehsil office</b>: In-person staff can look up your genuine status without any cost.</li>
                  <li>Keep your CNIC and phone safe while awaiting official verification.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Inspection Rationale & Model Signals (Expandable for judges) */}
          <details className="card" style={{ padding: '16px 20px', background: 'var(--card)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--forest-dark)', fontSize: '0.95rem' }}>
              Technical Inspection Signals & Model Rationale (For Evaluators)
            </summary>
            <div className="col" style={{ gap: 8, marginTop: 12 }}>
              <div className="row spread" style={{ fontSize: '0.85rem' }}>
                <span className="muted">Decision Protocol:</span>
                <span className="mono bold">Dual Layer (Heuristic Rules + Naive Bayes / NLP)</span>
              </div>
              <div className="row spread" style={{ fontSize: '0.85rem' }}>
                <span className="muted">Rule Engine Score:</span>
                <span className="mono bold">{res.rule_score ?? '—'}</span>
              </div>
              <div className="row spread" style={{ fontSize: '0.85rem' }}>
                <span className="muted">ML Confidence Score:</span>
                <span className="mono bold">{res.ml_score ?? '—'}</span>
              </div>
              <div className="row spread" style={{ fontSize: '0.85rem' }}>
                <span className="muted">Fraud Pattern Classification:</span>
                <span className="mono bold">{res.scam_type || 'unclassified'}</span>
              </div>
              <div className="row spread" style={{ fontSize: '0.85rem' }}>
                <span className="muted">Official Designated Helpline:</span>
                <span className="mono bold">{res.helpline || '8171'}</span>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

export function AskPage() {
  const { t, lang } = useLang()

  return (
    <div className="col" style={{ gap: 20, maxWidth: 840, margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <h1 style={{ margin: '0 0 6px', color: 'var(--forest-dark)', fontSize: '1.9rem', fontWeight: 800 }}>
          {lang === 'ur' ? 'بھروسہ آواز و پالیسی معاون' : 'Bharosa Voice & Policy Assistant'}
        </h1>
        <p className="subtle" style={{ margin: 0, fontSize: '0.98rem', maxWidth: 620, marginInline: 'auto' }}>
          {lang === 'ur'
            ? 'پالیسی کے سوالات، امدادی رہنمائی اور مستند تصدیق کے لیے اپنی زبان میں بولیں یا سنیں۔'
            : 'Official policy questions answered with verifiable citations. Speak or listen in Urdu, Roman Urdu, or English.'}
        </p>
      </div>

      <VoiceAssistant inline={true} />
    </div>
  )
}
