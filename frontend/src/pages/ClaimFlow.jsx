import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  CreditCard,
  Users as UsersIcon,
  Camera,
  FileCheck,
  ShieldCheck,
  Send,
  ArrowLeft,
  ArrowRight,
  Volume2,
  Mic as MicIcon,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Plus,
  Minus,
  Edit2,
  Sparkles,
  WifiOff,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Clock,
  HelpCircle,
  UserCheck,
  Shield,
  Receipt,
  HeartHandshake,
  Delete
} from 'lucide-react'
import { api, apiPost, BASE } from '../api'
import { useLang } from '../i18n'
import { EMPTY_FORM, clearDraft, flush, loadDraft, queueClaim, saveDraft, shrinkImage } from '../offline'
import { canListen, listen, playPrompt, speak, spokenNumber, stop } from '../voice'
import { ErrorBox, MockTag } from '../ui'
import Recourse from '../components/Recourse'
import DecisionReceipt from '../components/Receipt'

const DISTRICTS = [
  'Karachi East',
  'Karachi West',
  'Karachi Central',
  'Hyderabad',
  'Sukkur',
  'Larkana',
  'Lahore',
  'Multan',
  'Faisalabad',
  'Rawalpindi',
  'Peshawar',
  'Mardan',
  'Quetta',
  'Turbat',
  'Islamabad'
]

// 7 Wizard steps with clear icons and bilingual labels
const WIZARD_STEPS = [
  { id: 1, key: 'personal', title: 'Personal Info', urdu: 'ذاتی معلومات', roman: 'Zaati Maloomat', icon: User },
  { id: 2, key: 'identity', title: 'CNIC Identity', urdu: 'شناختی کارڈ', roman: 'Shanakhti Card (CNIC)', icon: CreditCard },
  { id: 3, key: 'household', title: 'Household', urdu: 'گھرانہ و آمدنی', roman: 'Gharana aur Aamdani', icon: UsersIcon },
  { id: 4, key: 'document', title: 'ID Photo', urdu: 'کارڈ کی تصویر', roman: 'Card ki Tasveer', icon: Camera },
  { id: 5, key: 'review', title: 'Review', urdu: 'درخواست کا جائزہ', roman: 'Darkhast ka Jaiza', icon: FileCheck },
  { id: 6, key: 'consent', title: 'Consent', urdu: 'آپ کی اجازت', roman: 'Aap ki Ijazat', icon: ShieldCheck },
  { id: 7, key: 'submit', title: 'Confirmation', urdu: 'حتمی تصدیق', roman: 'Hatmi Tasdeeq', icon: Send }
]

const PROMPTS = {
  1: 'say_name',
  2: 'say_cnic',
  3: 'say_income',
  4: 'take_photo',
  6: 'consent_identity'
}

const RESULT_UI = {
  AUTO_APPROVE: ['good', CheckCircle2, 'approved'],
  APPROVED_WAITING_PAYMENT_CONSENT: ['wait', AlertTriangle, 'need_proof'],
  ASK_PROOF: ['wait', Camera, 'need_proof'],
  HUMAN_REVIEW: ['human', UsersIcon, 'human_review'],
  DECLINE_WITH_APPEAL: ['stop', XCircle, 'declined_appeal'],
  NEEDS_CONSENT: ['wait', ShieldCheck, 'consent_identity']
}

function fmtCnic(d) {
  if (!d) return ''
  d = d.replace(/\D/g, '').slice(0, 13)
  return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join('-')
}

// Accessible tactile microphone button with speech recording pulse
function MicButton({ onText, numeric, label = 'Speak' }) {
  const [rec, setRec] = useState(false)
  const stopRef = useRef(null)

  if (!canListen()) return null

  const toggle = () => {
    if (rec) {
      stopRef.current?.()
      return
    }
    stop()
    setRec(true)
    stopRef.current = listen({
      lang: 'ur-PK',
      onResult: (x) => onText(numeric ? spokenNumber(x) : x),
      onEnd: () => setRec(false),
      onError: () => setRec(false)
    })
  }

  return (
    <div className="mic-container" style={{ margin: '8px 0' }}>
      <button
        type="button"
        className={'mic ' + (rec ? 'rec' : '')}
        aria-label="Speak in Urdu"
        onClick={toggle}
        title={rec ? 'Tap to finish speaking' : 'Tap to speak in Urdu'}
        style={{ width: 68, height: 68 }}
      >
        {rec ? <Square size={24} /> : <MicIcon size={28} />}
      </button>
      <span className="small muted">
        {rec ? 'Listening in Urdu… tap to stop' : label}
      </span>
    </div>
  )
}

// Tactile Touch Keypad for CNIC and Currency
function TouchPad({ value, onChange, max = 13 }) {
  const press = (k) => {
    if (k === 'DEL') onChange(value.slice(0, -1))
    else if (value.length < max) onChange(value + k)
  }

  return (
    <div className="numpad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'].map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button type="button" key={k} onClick={() => press(k)} aria-label={k === 'DEL' ? 'Delete digit' : `Digit ${k}`}>
            {k === 'DEL' ? <Delete size={18} style={{ verticalAlign: 'middle' }} /> : k}
          </button>
        )
      )}
    </div>
  )
}

export default function ClaimFlow({ helper }) {
  const { t, lang, rtl, localize } = useLang()
  const nav = useNavigate()
  const family = helper ? JSON.parse(sessionStorage.getItem('bh_family') || 'null') : null

  // 1-indexed step: 1 to 7
  const [step, setStep] = useState(1)
  const [d, setD] = useState(() => {
    const s = loadDraft()
    return s && s.forFamily === (family?.id || null) ? s.d : EMPTY_FORM
  })
  const [photo, setPhoto] = useState(() => loadDraft()?.photo || null)
  const [compressing, setCompressing] = useState(false)
  const [consent, setConsent] = useState({ identity: false, documents: false, payment: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null)
  const [queued, setQueued] = useState(false)
  const [demos, setDemos] = useState(null)
  const cameraRef = useRef()
  const galleryRef = useRef()

  const setField = (k, v) => setD((p) => ({ ...p, [k]: v }))
  const L = lang === 'ur' ? 'ur' : lang === 'roman' ? 'roman' : 'en'

  // Persist draft on every modification
  useEffect(() => {
    saveDraft({ d, photo, forFamily: family?.id || null })
  }, [d, photo])

  // Play audio prompt on step change
  useEffect(() => {
    if (!result && PROMPTS[step]) {
      playPrompt(PROMPTS[step], 'Step ' + step, L)
    }
    return stop
  }, [step]) // eslint-disable-line

  // Step validation rules
  const isStepValid = () => {
    if (step === 1) return d.name.trim().length > 1 && !!d.marital_status
    if (step === 2) return d.cnic.replace(/\D/g, '').length === 13
    if (step === 3) return d.monthly_income !== '' && Number(d.household_size) >= 1 && !!d.district
    if (step === 4) return true // Photo is encouraged but not strictly blocking if claimant has no camera
    if (step === 5) return true // Review screen
    if (step === 6) return helper || consent.identity // Consent to identity check is mandatory
    return true
  }

  // Pre-configured hackathon judge scenarios
  const loadDemo = async () => {
    if (!demos) {
      try {
        setDemos((await api('/demo/scenarios', { auth: false })).scenarios)
      } catch (e) {
        setErr(e)
      }
    }
  }

  const applyDemo = async (s) => {
    const f = s.form
    setD({
      ...EMPTY_FORM,
      ...f,
      cnic: String(f.cnic || ''),
      monthly_income: String(f.monthly_income ?? ''),
      household_size: Number(f.household_size) || 4
    })
    setPhoto(null)
    if (s.sample_card_url) {
      try {
        const b = await (await fetch(BASE + s.sample_card_url)).blob()
        const r = new FileReader()
        r.onload = () => setPhoto(r.result)
        r.readAsDataURL(b)
      } catch {}
    }
    // Jump directly to Step 5 (Review Application)
    setStep(5)
  }

  // Process and compress image locally for 2G/3G low-bandwidth connections
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    try {
      const shrunk = await shrinkImage(file)
      setPhoto(shrunk)
    } catch {
      // Fallback: direct base64
      const reader = new FileReader()
      reader.onload = () => setPhoto(reader.result)
      reader.readAsDataURL(file)
    } finally {
      setCompressing(false)
    }
  }

  const payload = () => ({
    ...d,
    monthly_income: d.monthly_income === '' ? null : Number(d.monthly_income),
    cnic: d.cnic,
    household_size: Number(d.household_size),
    gender: undefined
  })

  // Final submission workflow
  const submitClaim = async () => {
    setBusy(true)
    setErr(null)
    const body = payload()
    // A helper never sends consent flags: only the family's own one-time code can grant consent (the server ignores flags from helpers anyway)
    const flags = helper
      ? {}
      : {
          identity: consent.identity,
          documents: consent.documents,
          case_history: consent.documents,
          payment: consent.payment
        }

    try {
      if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline: true })

      // Step 1: Create Case with idempotency key
      const created = await apiPost('/cases', { data: body, citizen_id: family?.id }, {
        headers: { 'Idempotency-Key': 'c-' + Date.now() }
      })

      // Step 2: Upload document if attached
      if (photo) {
        const blob = await (await fetch(photo)).blob()
        const fd = new FormData()
        fd.append('file', blob, 'id.jpg')
        await api(`/cases/${created.id}/documents`, { method: 'POST', formData: fd, timeout: 40000 })
      }

      // Step 3: Submit for automated decisioning
      const r = await apiPost(`/cases/${created.id}/submit`, { consent: flags }, { timeout: 40000 })
      setResult({ ...r, caseId: created.id })
      clearDraft()

      const ui = RESULT_UI[r.route] || RESULT_UI.HUMAN_REVIEW
      playPrompt(ui[2], r.reason_user?.[L], L)
    } catch (e) {
      if (e.offline) {
        queueClaim({ data: body, consent: flags, photo, citizen_id: family?.id })
        clearDraft()
        setQueued(true)
        playPrompt('offline_saved', t('saved_offline'), L)
      } else {
        setErr(e)
      }
    } finally {
      setBusy(false)
    }
  }

  // Retake photo action on proof request
  const retakePhoto = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const small = await shrinkImage(f)
      const blob = await (await fetch(small)).blob()
      const fd = new FormData()
      fd.append('file', blob, 'id.jpg')
      const up = await api(`/cases/${result.caseId}/documents`, {
        method: 'POST',
        formData: fd,
        timeout: 40000
      })
      const r = await apiPost(`/cases/${result.caseId}/submit`, {}, { timeout: 40000 })
      setResult({ ...r, caseId: result.caseId, note: up.message?.[L] })
      const ui = RESULT_UI[r.route] || RESULT_UI.HUMAN_REVIEW
      playPrompt(ui[2], r.reason_user?.[L], L)
    } catch (x) {
      setErr(x)
    } finally {
      setBusy(false)
    }
  }

  // Offline Saved Confirmation View
  if (queued) {
    return (
      <div className="col narrow" style={{ gap: 20 }}>
        <div className="result wait">
          <div className="result-icon-wrapper">
            <WifiOff size={40} />
          </div>
          <h2>{t('saved_offline')}</h2>
          <p className="subtle" style={{ margin: 0 }}>
            {localize(
              'انٹرنیٹ کنکشن نہیں ہے، لیکن آپ کا کام محفوظ ہے۔ جیسے ہی نیٹ بحال ہوگا یہ خودبخود محکمہ کو بھیج دیا جائے گا۔',
              'Internet connection nahi hai, lekin aap ka kaam mehfooz hai. Net aane par yeh khud-ba-khud bhej diya jayega.',
              'No internet connection. Your relief application is securely saved on this device and will automatically sync once connectivity returns.'
            )}
          </p>
          <button
            onClick={() => {
              flush()
              nav(helper ? '/h' : '/c')
            }}
          >
            {localize('ٹھیک ہے (مکمل کریں)', 'Theek hai (Mukammal karein)', 'OK (Done)')}
          </button>
        </div>
      </div>
    )
  }

  // Result & Decision Notice View (Step 7 Complete)
  if (result) {
    const isApprove = result.route === 'AUTO_APPROVE'
    const isHumanReview = result.route === 'HUMAN_REVIEW'
    const isAskProof = result.route === 'ASK_PROOF'
    const isDecline = result.route === 'DECLINE_WITH_APPEAL'
    const reason = result.reason_user?.[lang === 'roman' ? 'roman' : lang === 'ur' ? 'ur' : 'en'] || result.reason_user?.en || ''

    return (
      <div className="col narrow" style={{ gap: 20 }}>
        {/* Approved State */}
        {isApprove && (
          <div className="decision-card approved" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="decision-header">
              <div className="decision-icon-pill">
                <CheckCircle2 size={30} strokeWidth={2.4} />
              </div>
              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div className="row spread">
                  <span className="badge" style={{ background: 'var(--forest)', color: '#FFFEFA' }}>
                    {localize('درخواست منظور', 'Darkhast Manzoor', 'Application Approved')}
                  </span>
                  <button
                    type="button"
                    className="btn ghost icon-btn small"
                    onClick={() => speak(reason, L)}
                    title={localize('آواز میں سنیں', 'Awaz mein sunein', 'Read aloud')}
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
                <h3 className="decision-title">
                  {localize('امداد کی درخواست خودکار طور پر منظور', 'Imdad ki darkhast khudkar tor par manzoor', 'Relief Claim Approved')}
                </h3>
                <p className="decision-reason">{reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Under Human Review State — Never make uncertain look like approval */}
        {isHumanReview && (
          <div className="decision-card under-review" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="decision-header">
              <div className="decision-icon-pill">
                <Clock size={30} strokeWidth={2.4} />
              </div>
              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div className="row spread">
                  <span className="badge amber">
                    {localize('انسانی افسر کا جائزہ', 'Insani officer ka jaiza', 'Under Human Welfare Review')}
                  </span>
                  <button
                    type="button"
                    className="btn ghost icon-btn small"
                    onClick={() => speak(reason, L)}
                    title={localize('آواز میں سنیں', 'Awaz mein sunein', 'Read aloud')}
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
                <h3 className="decision-title">
                  {localize('سرکاری افسر کی تصدیق درکار ہے', 'Sarkari officer ki tasdeeq darkaar hai', 'Assigned for Officer Review')}
                </h3>
                <p className="decision-reason">{reason}</p>
              </div>
            </div>

            <div className="human-review-callout row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <UserCheck size={20} style={{ flex: 'none', marginTop: 2, color: 'var(--gold-dark)' }} />
              <div className="col" style={{ gap: 4 }}>
                <b style={{ color: 'var(--forest-dark)' }}>
                  {localize('اہم: یہ ابھی حتمی فیصلہ نہیں ہے۔', 'Ahem: Yeh abhi hatmi faisla nahi hai.', 'Important: This is not an approval yet.')}
                </b>
                <span>
                  {localize(
                    'آپ کی درخواست ایک سرکاری ویلفیئر افسر کے پاس جانچ کے لیے قطار میں ہے۔ افسر آپ کے کاغذات اور معاشی حالات کا دستی جائزہ لے کر حتمی فیصلہ کرے گا۔',
                    'Aap ki darkhast ek sarkari welfare officer ke paas jaanch ke liye qataar mein hai. Officer dastavez ka jaiza le kar hatmi faisla karega.',
                    'A human welfare officer needs to review this application before a final decision can be made. No payment has been scheduled yet.'
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Needs Proof State */}
        {isAskProof && (
          <div className="decision-card needs-proof" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="decision-header">
              <div className="decision-icon-pill">
                <Camera size={30} strokeWidth={2.4} />
              </div>
              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div className="row spread">
                  <span className="badge amber">
                    {localize('مزید معلومات درکار', 'Mazeed maloomat darkaar', 'More Information Required')}
                  </span>
                  <button
                    type="button"
                    className="btn ghost icon-btn small"
                    onClick={() => speak(reason, L)}
                    title={localize('آواز میں سنیں', 'Awaz mein sunein', 'Read aloud')}
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
                <h3 className="decision-title">
                  {localize('شناختی کارڈ کی واضح تصویر درکار ہے', 'Shanakhti card ki wazeh tasveer darkaar hai', 'Clearer Photo Required')}
                </h3>
                <p className="decision-reason">{reason}</p>
              </div>
            </div>

            <label
              className="btn"
              style={{
                background: 'var(--terracotta)',
                textAlign: 'center',
                cursor: 'pointer',
                justifyContent: 'center',
                marginTop: 6
              }}
            >
              <Camera size={18} />
              <span>{t('takephoto')}</span>
              <input type="file" accept="image/*" capture="environment" hidden onChange={retakePhoto} />
            </label>
          </div>
        )}

        {/* Decline State */}
        {isDecline && (
          <div className="decision-card rejected" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="decision-header">
              <div className="decision-icon-pill">
                <XCircle size={30} strokeWidth={2.4} />
              </div>
              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div className="row spread">
                  <span className="badge red">
                    {localize('درخواست مسترد', 'Darkhast mustared', 'Relief Not Approved')}
                  </span>
                  <button
                    type="button"
                    className="btn ghost icon-btn small"
                    onClick={() => speak(reason, L)}
                    title={localize('آواز میں سنیں', 'Awaz mein sunein', 'Read aloud')}
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
                <h3 className="decision-title">
                  {localize('امداد کی درخواست منظور نہیں ہوئی', 'Imdad ki darkhast manzoor nahi hui', 'Application Not Approved')}
                </h3>
                <p className="decision-reason">{reason}</p>
              </div>
            </div>

            <button
              type="button"
              className="btn warn"
              style={{ justifyContent: 'center', marginTop: 6 }}
              onClick={async () => {
                await apiPost(`/cases/${result.caseId}/appeal?note=please re-check`)
                nav(helper ? '/h' : '/c/cases/' + result.caseId)
              }}
            >
              <RotateCcw size={16} />
              <span>{t('appeal')}</span>
            </button>
          </div>
        )}

        {/* Payment Confirmation (When payment is returned by backend) */}
        {result.payment && (
          <div className="payment-card">
            <div className="row spread">
              <div className="simulated-payment-banner">
                <Shield size={14} />
                <span>SIMULATED PAYMENT — NO REAL MONEY TRANSFERRED</span>
              </div>
              <span className="badge" style={{ background: 'var(--sage-soft)', color: 'var(--forest-dark)' }}>
                Disbursed (Simulated)
              </span>
            </div>

            <div className="col" style={{ gap: 4 }}>
              <span className="payment-metric-label">Simulated Grant Payout</span>
              <div className="payment-amount-large">
                PKR {result.payment.amount?.toLocaleString()}
              </div>
            </div>

            <div className="payment-metric-grid">
              <div className="payment-metric-item">
                <span className="payment-metric-label">Transaction Reference</span>
                <span className="payment-metric-value mono" style={{ fontSize: '1rem' }}>
                  {result.payment.reference}
                </span>
              </div>
              <div className="payment-metric-item">
                <span className="payment-metric-label">Payment Rail</span>
                <span className="payment-metric-value">
                  {result.payment.rail || 'MOCK-RAAST'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* What would change this decision, and the signed, publicly verifiable receipt */}
        <Recourse items={result.reason_user?.recourse} />
        {result.decision_id && <DecisionReceipt caseId={result.caseId} />}
        {helper && result.route === 'NEEDS_CONSENT' && (
          <div className="banner offline">Ask the family for their one-time code on the family page, then submit again.</div>
        )}

        <ErrorBox e={err} />

        {/* Navigation to Full Case View & Receipt */}
        <div className="col" style={{ gap: 10 }}>
          <Link
            className="btn"
            style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: '1.05rem' }}
            to={helper ? '/h' : '/c/cases/' + result.caseId}
          >
            <Receipt size={18} />
            <span>Track 7-Stage Status & View Receipt (مکمل ریکارڈ دیکھیں)</span>
            <ArrowRight size={18} />
          </Link>

          <Link
            className="btn ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            to={helper ? '/h' : '/c'}
          >
            Return to Home (مرکزی صفحہ پر جائیں)
          </Link>
        </div>

        {/* Audit trail accordion */}
        {result.steps?.length > 0 && (
          <details className="card" style={{ padding: 18 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--forest-dark)' }}>
              {t('why')} · Algorithmic Triage Audit Trail ({result.steps.length} steps)
            </summary>
            <ul className="step-list" dir="ltr" style={{ marginTop: 12 }}>
              {result.steps.map((s, i) => (
                <li key={i} className={s.outcome === 'denied' ? 'denied' : ''}>
                  <b style={{ color: 'var(--forest-dark)' }}>{s.tool}</b>
                  <div style={{ marginTop: 2 }}>{s.summary}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  const currentStepDef = WIZARD_STEPS[step - 1]
  const CurrentStepIcon = currentStepDef.icon

  return (
    <div className="col narrow" style={{ gap: 18 }}>
      {/* Helper Context Banner */}
      {family && (
        <div className="banner info">
          <UsersIcon size={18} />
          <span>
            Helping Community Family: <b>{family.name}</b>
          </span>
        </div>
      )}

      {/* Stepper Header */}
      <div className="wizard-stepper-container">
        <div className="row spread">
          <div>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">
                {localize(`مرحلہ ${step} از 7`, `Step ${step} of 7`, `Step ${step} of 7`)}
              </span>
              <span className="small subtle" style={{ fontWeight: 600 }}>
                {localize(currentStepDef.urdu, currentStepDef.roman, currentStepDef.title)}
              </span>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <span className="small subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} style={{ color: 'var(--evergreen)' }} />
              <span>{localize('خودکار محفوظ', 'Auto-saved', 'Auto-saved')}</span>
            </span>
            <button
              type="button"
              className="btn ghost small"
              onClick={loadDemo}
              title="Loads test scenarios for evaluation"
            >
              <Sparkles size={14} />
              <span>{localize('ڈیمو', 'Demo', 'Demo')}</span>
            </button>
          </div>
        </div>

        {/* Horizontal Visual Step Indicators */}
        <div className="wizard-steps-nav">
          {WIZARD_STEPS.map((s) => {
            const IconComp = s.icon
            const isCompleted = step > s.id
            const isActive = step === s.id
            return (
              <div
                key={s.id}
                className={`wizard-step-pill ${isActive ? 'active' : ''} ${
                  isCompleted ? 'completed' : ''
                }`}
                onClick={() => {
                  // Allow jumping back to earlier steps
                  if (s.id < step) setStep(s.id)
                }}
                style={{ cursor: s.id < step ? 'pointer' : 'default' }}
                title={s.title}
              >
                <span className="wizard-step-number">
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : s.id}
                </span>
                <span className="small" style={{ display: isActive ? 'inline' : 'none' }}>
                  {localize(s.urdu, s.roman, s.title)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Stepper Progress Bar Line */}
        <div className="bar" style={{ height: 4 }}>
          <i
            style={{
              width: `${(step / 7) * 100}%`,
              background: 'var(--forest)'
            }}
          />
        </div>
      </div>

      {/* Quick Judge Demo Scenarios Selector */}
      {demos && (
        <div className="card col" style={{ gap: 8, background: 'var(--ivory-alt)' }}>
          <div className="small muted" style={{ fontWeight: 600 }}>
            Select Judge Evaluation Scenario:
          </div>
          {demos.map((s) => (
            <button
              key={s.key}
              className="btn ghost small"
              style={{ textAlign: 'left', justifyContent: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => applyDemo(s)}
            >
              <ArrowRight size={13} style={{ color: 'var(--champagne)' }} />
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Single-Task Wizard Card */}
      <div className="wizard-task-card" dir={rtl ? 'rtl' : 'ltr'}>
        {/* Step Header */}
        <div className="wizard-task-header">
          <div>
            <h2>
              {step === 1 && localize('آپ کی ذاتی معلومات', 'Apni maloomat darj karein', 'Personal Information')}
              {step === 2 && localize('شناختی کارڈ نمبر (CNIC)', 'Shanakhti card number (CNIC)', 'Identity Verification')}
              {step === 3 && localize('گھرانہ اور ماہانہ آمدنی', 'Gharana aur mahana aamdani', 'Household & Socio-Economic Information')}
              {step === 4 && localize('شناختی کارڈ کی تصویر', 'Shanakhti card ki tasveer', 'Document Upload (CNIC Front)')}
              {step === 5 && localize('درخواست کا جائزہ', 'Darkhast ka jaiza', 'Review Application')}
              {step === 6 && localize('آپ کی صریح اجازت (Consent)', 'Aap ki sarih ijazat (Consent)', 'Consent & Data Authorization')}
              {step === 7 && localize('حتمی تصدیق اور جمع', 'Hatmi tasdeeq aur jama', 'Submit Claim')}
            </h2>
            <div className="urdu-title">
              {step === 1 && localize('نام اور ازدواجی حیثیت درج کریں', 'Naam aur marital status darj karein', 'Enter legal name and marital status')}
              {step === 2 && localize('13 ہندسوں کا قومی شناختی کارڈ نمبر درج کریں', '13 digits ka CNIC number darj karein', 'Enter 13-digit CNIC number')}
              {step === 3 && localize('آمدنی، افراد کی تعداد اور ضلع منتخب کریں', 'Aamdani, afraad ki tadaad aur zila muntakhib karein', 'Select income, family size and district')}
              {step === 4 && localize('صاف اور چاروں کونے دکھائی دینے والی تصویر', 'Saaf aur charon koney dikhai dene wali tasveer', 'Upload clear photo showing all 4 corners')}
              {step === 5 && localize('جمع کرانے سے پہلے تمام معلومات چیک کریں', 'Jama karwane se pehle tamaam maloomat check karein', 'Review all details before submission')}
              {step === 6 && localize('صرف وہی ڈیٹا شیئر کریں جس کی آپ اجازت دیں', 'Sirf wahi data share karein jis ki aap ijazat dein', 'Share only what you explicitly authorize')}
              {step === 7 && localize('تصدیق کریں اور امدادی رقم کا فیصلہ دیکھیں', 'Tasdeeq karein aur imdadi raqam ka faisla dekhein', 'Confirm and view instant relief decision')}
            </div>
          </div>

          <button
            type="button"
            className="btn ghost icon-btn small"
            onClick={() => {
              if (PROMPTS[step]) {
                playPrompt(PROMPTS[step], 'Step ' + step, L)
              } else {
                speak(
                  localize(
                    'براہ کرم تمام معلومات کا جائزہ لیں اور آگے بڑھیں۔',
                    'Barahe karam tamaam maloomat ka jaiza lein aur aage barhein.',
                    'Please review your details and proceed to authorize consent.'
                  ),
                  L
                )
              }
            }}
            title={localize('ہدایات سنیں', 'Hidayat sunein', 'Listen to step instructions')}
          >
            <Volume2 size={18} />
          </button>
        </div>

        {/* STEP 1: Personal Information */}
        {step === 1 && (
          <div className="col" style={{ gap: 20 }}>
            {/* Full Name */}
            <div>
              <div className="row spread" style={{ marginBottom: 6 }}>
                <label style={{ margin: 0 }}>
                  {t('name')} <span style={{ color: 'var(--terracotta)' }}>*</span>
                </label>
                <span className="small subtle">{localize('لازمی فیلڈ', 'Lazmi field', 'Required')}</span>
              </div>
              <input
                value={d.name}
                onChange={(e) => setField('name', e.target.value)}
                dir="auto"
                placeholder="e.g. Fatima Bibi / فاطمہ بی بی"
                autoFocus
                style={{ fontSize: '1.1rem', padding: '12px 14px' }}
              />
              <p className="wizard-explanation-text" style={{ marginTop: 6 }}>
                {localize(
                  'شناختی کارڈ کے مطابق اپنا نام درج کریں یا بول کر بتائیں۔',
                  'Shanakhti card ke mutabiq apna naam darj karein ya bol kar batayein.',
                  'Enter your full legal name as it appears on official records.'
                )}
              </p>
              <MicButton onText={(x) => setField('name', x)} label={localize('نام بولیں', 'Naam bolein', 'Tap to speak name')} />
            </div>

            {/* Father / Husband Name */}
            <div>
              <div className="row spread" style={{ marginBottom: 6 }}>
                <label style={{ margin: 0 }}>
                  {t('father')} <span className="small subtle">({localize('اختیاری', 'Ikhtiyari', 'Optional')})</span>
                </label>
                <span className="small subtle">{localize('اختیاری', 'Ikhtiyari', 'Optional')}</span>
              </div>
              <input
                value={d.father_name}
                onChange={(e) => setField('father_name', e.target.value)}
                dir="auto"
                placeholder="Father's or husband's name"
                style={{ fontSize: '1.05rem' }}
              />
              <p className="wizard-explanation-text" style={{ marginTop: 6 }}>
                {localize(
                  'والد یا شوہر کا نام شناختی تصدیق کو آسان بناتا ہے۔',
                  'Walid ya shohar ka naam shanakhti tasdeeq ko aasan banata hai.',
                  'Optional. Helps distinguish common names during identity matching.'
                )}
              </p>
              <MicButton onText={(x) => setField('father_name', x)} label={localize('والد کا نام بولیں', 'Walid ka naam bolein', "Tap to speak father's name")} />
            </div>

            {/* Marital Status */}
            <div>
              <div className="row spread" style={{ marginBottom: 8 }}>
                <label style={{ margin: 0 }}>
                  {t('status')} <span style={{ color: 'var(--terracotta)' }}>*</span>
                </label>
                <span className="small subtle">{localize('ایک منتخب کریں', 'Aik muntakhib karein', 'Select one')}</span>
              </div>

              <div className="status-option-grid">
                {[
                  ['widowed', HeartHandshake, t('widow')],
                  ['married', UsersIcon, t('married')],
                  ['single', User, t('single')]
                ].map(([v, IconComponent, label]) => (
                  <button
                    type="button"
                    key={v}
                    className={`status-option-btn ${d.marital_status === v ? 'selected' : ''}`}
                    onClick={() => setField('marital_status', v)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                  >
                    <IconComponent size={26} strokeWidth={1.8} style={{ color: d.marital_status === v ? 'var(--forest)' : 'var(--ink-secondary)', margin: '6px 0' }} />
                    <span className="option-title">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Identity Verification (CNIC) */}
        {step === 2 && (
          <div className="col" style={{ gap: 16 }}>
            <div className="row spread">
              <label style={{ margin: 0 }}>
                {t('cnic')} <span style={{ color: 'var(--terracotta)' }}>*</span>
              </label>
              <span className="small subtle">
                {d.cnic.replace(/\D/g, '').length} / 13 digits
              </span>
            </div>

            {/* Large Formatted CNIC Card Display */}
            <div
              className="card flat"
              style={{
                background: 'var(--ivory-alt)',
                border: '2px solid var(--border)',
                textAlign: 'center',
                padding: '16px'
              }}
            >
              <div
                className="kpi mono"
                style={{
                  letterSpacing: 3,
                  fontSize: '2.1rem',
                  color: d.cnic.replace(/\D/g, '').length === 13 ? 'var(--forest)' : 'var(--forest-dark)',
                  margin: 0
                }}
                dir="ltr"
              >
                {fmtCnic(d.cnic) || '_____-_______-_'}
              </div>
              <div className="small subtle" style={{ marginTop: 6 }}>
                {d.cnic.replace(/\D/g, '').length === 13 ? (
                  <span style={{ color: 'var(--forest)', fontWeight: 600 }}>
                    <Check size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {localize('13 ہندسے مکمل ہیں', '13 digits complete', '13 digits complete')}
                  </span>
                ) : (
                  localize('طریقہ کار: 5 ہندسے - 7 ہندسے - 1 ہندسہ', 'Format: 5 digits - 7 digits - 1 digit', 'Format: 5 digits - 7 digits - 1 digit')
                )}
              </div>
            </div>

            {/* Tactile Touch Keypad */}
            <TouchPad
              value={d.cnic.replace(/\D/g, '')}
              onChange={(v) => setField('cnic', v)}
              max={13}
            />

            <MicButton
              numeric
              onText={(x) => setField('cnic', x.slice(0, 13))}
              label={localize('شناختی کارڈ کے ہندسے بولیں', 'Shanakhti card ke number bolein', 'Speak CNIC digits')}
            />
          </div>
        )}

        {/* STEP 3: Household & Socio-Economic Information */}
        {step === 3 && (
          <div className="col" style={{ gap: 20 }}>
            {/* Monthly Income */}
            <div>
              <div className="row spread" style={{ marginBottom: 6 }}>
                <label style={{ margin: 0 }}>
                  {t('income')} (PKR) <span style={{ color: 'var(--terracotta)' }}>*</span>
                </label>
                <span className="small subtle">{localize('ماہانہ', 'Mahana', 'Monthly')}</span>
              </div>

              <div
                className="card flat"
                style={{
                  background: 'var(--ivory-alt)',
                  border: '1.5px solid var(--border)',
                  textAlign: 'center',
                  padding: '12px'
                }}
              >
                <div
                  className="kpi mono"
                  style={{ fontSize: '2.2rem', color: 'var(--forest)', margin: 0 }}
                  dir="ltr"
                >
                  PKR {Number(d.monthly_income || 0).toLocaleString()}
                </div>
              </div>

              <TouchPad
                value={String(d.monthly_income)}
                onChange={(v) => setField('monthly_income', v)}
                max={7}
              />
              <MicButton
                numeric
                onText={(x) => setField('monthly_income', x.slice(0, 7))}
                label={localize('ماہانہ آمدنی بول کر بتائیں', 'Mahana aamdani bol kar batayein', 'Speak monthly income amount')}
              />
            </div>

            {/* Household Size */}
            <div>
              <div className="row spread" style={{ marginBottom: 8 }}>
                <label style={{ margin: 0 }}>
                  {t('household')} <span style={{ color: 'var(--terracotta)' }}>*</span>
                </label>
                <span className="small subtle">Members</span>
              </div>

              <div
                className="card flat row spread"
                style={{
                  background: 'var(--paper)',
                  border: '1.5px solid var(--border)',
                  padding: '16px 24px',
                  justifyContent: 'space-around'
                }}
              >
                <button
                  type="button"
                  className="btn ghost icon-btn"
                  style={{ width: 54, height: 54, borderRadius: '50%' }}
                  onClick={() => setField('household_size', Math.max(1, Number(d.household_size) - 1))}
                  title="Decrease"
                >
                  <Minus size={24} />
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div className="kpi" style={{ fontSize: '3.4rem', color: 'var(--forest-dark)', margin: 0 }}>
                    {d.household_size}
                  </div>
                  <div className="small subtle">{localize('خاندان کے افراد', 'Khandan ke afraad', 'Household members')}</div>
                </div>

                <button
                  type="button"
                  className="btn ghost icon-btn"
                  style={{ width: 54, height: 54, borderRadius: '50%' }}
                  onClick={() => setField('household_size', Math.min(20, Number(d.household_size) + 1))}
                  title="Increase"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            {/* District */}
            <div>
              <label style={{ marginBottom: 6 }}>
                {t('district')} <span style={{ color: 'var(--terracotta)' }}>*</span>
              </label>
              <select
                value={d.district}
                onChange={(e) => setField('district', e.target.value)}
                style={{ fontSize: '1.05rem', padding: '12px 14px' }}
              >
                {DISTRICTS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 4: Document Upload (CNIC Front Photo) */}
        {step === 4 && (
          <div className="col" style={{ gap: 18 }}>
            {/* Visual Document Guidelines (Acceptable vs Unacceptable) */}
            <div>
              <div className="small subtle" style={{ fontWeight: 600, marginBottom: 8 }}>
                {localize('شناختی کارڈ کی تصویر کا معیار:', 'Tasveer ka mayaar:', 'Acceptable Document Guidelines:')}
              </div>
              <div className="doc-guide-grid">
                <div className="doc-guide-item valid">
                  <div className="row" style={{ gap: 6, fontWeight: 700 }}>
                    <CheckCircle2 size={16} />
                    <span>{localize('صحیح معیار', 'Sahi mayaar', 'Good Quality')}</span>
                  </div>
                  <span>{localize('• واضح روشنی، دھندلا نہ ہو', '• Wazeh roshni, saaf tasveer', '• Clear lighting, not blurry')}</span>
                  <span>{localize('• کارڈ کے چاروں کونے نظر آئیں', '• Card ke charon koney nazar aayein', '• All 4 corners visible')}</span>
                  <span>{localize('• شناختی نمبر اور کیو آر کوڈ صاف ہو', '• Shanakhti number saaf parha jaye', '• QR code and CNIC readable')}</span>
                </div>
                <div className="doc-guide-item invalid">
                  <div className="row" style={{ gap: 6, fontWeight: 700 }}>
                    <XCircle size={16} />
                    <span>{localize('غلط معیار (گریز کریں)', 'Ghalat mayaar (Avoid)', 'Avoid / Poor Quality')}</span>
                  </div>
                  <span>{localize('• کٹے ہوئے کونے یا آدھا کارڈ', '• Katey hue koney', '• Cut or cropped corners')}</span>
                  <span>{localize('• فلیش لائٹ کی چمک', '• Flash light ki chamak', '• Camera flash glare')}</span>
                  <span>{localize('• دھندلی، اندھیری یا ٹیڑھی تصویر', '• Dhundli ya terhi tasveer', '• Blurry, dark or tilted')}</span>
                </div>
              </div>
            </div>

            {/* Document Upload / Capture Box */}
            <div className="doc-upload-box">
              {photo ? (
                <div className="col" style={{ alignItems: 'center', gap: 12, width: '100%' }}>
                  <img
                    src={photo}
                    alt="Uploaded CNIC Front"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 220,
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)',
                      border: '1px solid var(--border)'
                    }}
                  />
                  <div className="row" style={{ gap: 10 }}>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => cameraRef.current?.click()}
                    >
                      <Camera size={14} />
                      <span>{localize('دوبارہ تصویر لیں', 'Dobara tasveer lein', 'Retake with Camera')}</span>
                    </button>
                    <button
                      type="button"
                      className="btn ghost small danger-ghost"
                      onClick={() => setPhoto(null)}
                    >
                      <span>{localize('تصویر ہٹائیں', 'Tasveer hatayein', 'Remove')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--sage-soft)',
                      color: 'var(--forest)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Camera size={28} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--forest-dark)' }}>
                      {localize('شناختی کارڈ کی تصویر لیں یا اپ لوڈ کریں', 'Shanakhti card ki tasveer lein ya upload karein', 'Take or Upload Photo of ID Card')}
                    </h4>
                    <span className="small subtle">
                      {localize('کیمرہ یا فون گیلری استعمال کریں', 'Camera ya gallery istemal karein', 'Supports phone camera or gallery image')}
                    </span>
                  </div>

                  <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      style={{ padding: '10px 18px' }}
                    >
                      <Camera size={16} />
                      <span>{localize('کیمرہ کھولیں', 'Camera kholein', 'Use Camera')}</span>
                    </button>

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => galleryRef.current?.click()}
                      style={{ padding: '10px 18px' }}
                    >
                      <Upload size={16} />
                      <span>{localize('گیلری سے منتخب کریں', 'Gallery se muntakhib karein', 'From Gallery')}</span>
                    </button>
                  </div>

                  {compressing && (
                    <span className="small" style={{ color: 'var(--forest)' }}>
                      {localize('کمزور سگنل کے لیے فائل کا سائز چھوٹا کیا جا رہا ہے…', 'Photo process ho rahi hai…', 'Shrinking photo locally for weak signal…')}
                    </span>
                  )}
                </>
              )}

              {/* Hidden file inputs */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handlePhotoUpload}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoUpload}
              />
            </div>

            <p className="wizard-explanation-text" style={{ textAlign: 'center' }}>
              {localize(
                'نوٹ: اگر کیمرہ کام نہ کرے تو آپ اس مرحلے کو چھوڑ سکتے ہیں۔ محکمہ نادرا ریکارڈ سے آپ کی جانچ کرے گا۔',
                'Note: Agar camera na ho to aap aage barh sakte hain. Department NADRA record se verify karega.',
                'Note: If you do not have a working camera, you can skip this step. The department will cross-check your record with the registry.'
              )}
            </p>
          </div>
        )}

        {/* STEP 5: Review Application (Prior to Consent) */}
        {step === 5 && (
          <div className="col" style={{ gap: 16 }}>
            <p className="wizard-explanation-text" style={{ margin: 0 }}>
              {localize(
                'براہ کرم تمام درج کی گئی تفصیلات کی جانچ کریں۔ کسی بھی خانے کو تبدیل کرنے کے لیے "تبدیل" دبائیں۔',
                'Barahe karam tamaam maloomat ka jaiza lein. Kisi bhi khaney ko tabdeel karne ke liye "Edit" dabayein.',
                'Please review all entered details below before authorizing data verification.'
              )}
            </p>

            {/* Block 1: Personal Info */}
            <div className="review-summary-block">
              <div className="review-section-header">
                <h4>{localize('1. ذاتی معلومات', '1. Zaati Maloomat', '1. Personal Information')}</h4>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ padding: '2px 8px', minHeight: 28 }}
                  onClick={() => setStep(1)}
                >
                  <Edit2 size={12} /> {localize('تبدیل', 'Edit', 'Edit')}
                </button>
              </div>
              <table className="review-summary-table">
                <tbody>
                  <tr>
                    <td className="label-cell">{localize('پورا نام:', 'Poora naam:', 'Full Name:')}</td>
                    <td className="value-cell">{d.name || '—'}</td>
                  </tr>
                  <tr>
                    <td className="label-cell">{localize('والد یا شوہر کا نام:', 'Walid ya shohar:', 'Father / Husband:')}</td>
                    <td className="value-cell">{d.father_name || localize('اختیاری / درج نہیں', 'Optional / None', 'Optional / None')}</td>
                  </tr>
                  <tr>
                    <td className="label-cell">{localize('ازدواجی حیثیت:', 'Haisiyat:', 'Situation:')}</td>
                    <td className="value-cell" style={{ textTransform: 'capitalize' }}>
                      {d.marital_status ? t(d.marital_status) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Block 2: Identity (CNIC) */}
            <div className="review-summary-block">
              <div className="review-section-header">
                <h4>{localize('2. شناختی کارڈ (CNIC)', '2. Shanakhti Card (CNIC)', '2. Identity Verification (CNIC)')}</h4>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ padding: '2px 8px', minHeight: 28 }}
                  onClick={() => setStep(2)}
                >
                  <Edit2 size={12} /> {localize('تبدیل', 'Edit', 'Edit')}
                </button>
              </div>
              <table className="review-summary-table">
                <tbody>
                  <tr>
                    <td className="label-cell">{localize('قومی شناختی کارڈ نمبر:', 'Shanakhti Card Number:', 'National CNIC:')}</td>
                    <td className="value-cell mono" style={{ fontSize: '1.05rem', color: 'var(--forest)' }}>
                      {fmtCnic(d.cnic) || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Block 3: Household & Socio-Economic */}
            <div className="review-summary-block">
              <div className="review-section-header">
                <h4>{localize('3. گھرانہ و علاقہ', '3. Gharana aur Ilaqa', '3. Household & District')}</h4>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ padding: '2px 8px', minHeight: 28 }}
                  onClick={() => setStep(3)}
                >
                  <Edit2 size={12} /> {localize('تبدیل', 'Edit', 'Edit')}
                </button>
              </div>
              <table className="review-summary-table">
                <tbody>
                  <tr>
                    <td className="label-cell">{localize('ماہانہ آمدنی:', 'Mahana aamdani:', 'Monthly Income:')}</td>
                    <td className="value-cell mono">
                      PKR {Number(d.monthly_income || 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-cell">{localize('خاندان کے افراد:', 'Khandan ke afraad:', 'Household Members:')}</td>
                    <td className="value-cell">{d.household_size} {localize('افراد', 'afraad', 'members')}</td>
                  </tr>
                  <tr>
                    <td className="label-cell">{localize('ضلع / علاقہ:', 'Zila / Ilaqa:', 'District / Area:')}</td>
                    <td className="value-cell">{d.district}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Block 4: Document Photo */}
            <div className="review-summary-block">
              <div className="review-section-header">
                <h4>{localize('4. شناختی کارڈ کی تصویر', '4. Shanakhti Card ki Tasveer', '4. Uploaded ID Card Photo')}</h4>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ padding: '2px 8px', minHeight: 28 }}
                  onClick={() => setStep(4)}
                >
                  <Edit2 size={12} /> {localize('تبدیل', 'Edit', 'Edit')}
                </button>
              </div>
              <div style={{ padding: '12px 16px' }}>
                {photo ? (
                  <div className="row" style={{ gap: 14 }}>
                    <img
                      src={photo}
                      alt="Thumbnail"
                      style={{
                        width: 72,
                        height: 48,
                        objectFit: 'cover',
                        borderRadius: 6,
                        border: '1px solid var(--border)'
                      }}
                    />
                    <span className="small" style={{ color: 'var(--forest)', fontWeight: 600 }}>
                      <Check size={14} style={{ display: 'inline' }} /> {localize('تصویر منسلک ہے', 'Tasveer munsalik hai', 'CNIC photo attached')}
                    </span>
                  </div>
                ) : (
                  <span className="small subtle">
                    {localize('کوئی تصویر منسلک نہیں (نادرا ڈیٹا بیس سے تصدیق ہوگی)', 'Tasveer nahi (NADRA se verify hoga)', 'No photo attached (will cross-check via registry records)')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Consent Confirmation (Explicit Sovereignty) */}
        {step === 6 && helper && (
          <div className="banner info">
            🔒 Consent for this family was given by the family itself with a one-time code (see the family page). Nothing is read without it.
          </div>
        )}
        {step === 6 && !helper && (
          <div className="col" style={{ gap: 16 }}>
            <p className="wizard-explanation-text" style={{ margin: 0 }}>
              {localize(
                'آپ کا مکمل کنٹرول ہے۔ آپ جب چاہیں "میرا ڈیٹا" کے تحت ان اجازتوں کو واپس لے سکتے ہیں۔',
                'Aap ka mukammal control hai. Aap jab chahein "Mera Data" mein in ijazaton ko wapis le sakte hain.',
                'You have full data sovereignty. You choose which checks to permit, and can revoke them anytime.'
              )}
            </p>

            {[
              [
                'identity',
                CreditCard,
                localize('قومی شناختی تصدیق کی اجازت', 'National registry se shanakht ki tasdeeq ki ijazat', 'Check my Identity with National Registry'),
                localize(
                  'محکمہ کو آپ کے نام اور شناختی کارڈ کی تصدیق کرنے کی اجازت۔',
                  'Department ko aap ke naam aur shanakhti card ki tasdeeq karne ki ijazat.',
                  'Allows matching your name and CNIC with official government records.'
                ),
                true
              ],
              [
                'documents',
                Camera,
                localize('میرے کاغذات افسر دیکھ سکے', 'Officer mere kaghazaat dekh sake', 'Officer Document Review'),
                localize(
                  'اگر خودکار تصدیق میں شک ہو تو کیس ورکر کو تصویر دیکھنے کی اجازت۔',
                  'Agar khudkar tasdeeq mein shak ho to caseworker ko tasveer dekhne ki ijazat.',
                  'Allows a caseworker to inspect your uploaded CNIC photo if manual review is needed.'
                ),
                false
              ],
              [
                'payment',
                ShieldCheck,
                localize('رقم براہ راست منتقل کرنے کی اجازت', 'Raast ke zariye raqam direct transfer ki ijazat', 'Direct Relief Payment via Raast'),
                localize(
                  'منظوری کی صورت میں رقم سیدھی آپ کے اکاؤنٹ میں بھیجنے کی اجازت۔',
                  'Manzoori ki soorat mein raqam seedhi aap ke account mein bhejne ki ijazat.',
                  'Authorizes instant relief disbursement to your verified payment account.'
                ),
                false
              ]
            ].map(([k, IconComp, titleText, descText, must]) => (
              <div className="toggle" key={k}>
                <div className="row" style={{ gap: 14, flex: 1 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--sage-soft)',
                      color: 'var(--forest)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <IconComp size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--forest-dark)' }}>
                      {titleText}
                      {must ? ' *' : ''}
                    </div>
                    <div className="small subtle">{descText}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className={'switch ' + (consent[k] ? 'on' : '')}
                  aria-pressed={consent[k]}
                  aria-label={titleText}
                  onClick={() => setConsent((c) => ({ ...c, [k]: !c[k] }))}
                />
              </div>
            ))}

            {!consent.identity && (
              <div className="banner bad small">
                <AlertTriangle size={16} />
                <span>
                  {localize(
                    '* شناخت کی تصدیق کی اجازت امدادی جانچ کے لیے لازمی ہے۔',
                    '* Shanakht ki tasdeeq ki ijazat imdadi jaanch ke liye lazmi hai.',
                    '* Identity verification consent is required to evaluate eligibility for public relief.'
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* STEP 7: Submit Claim Summary & Action */}
        {step === 7 && (
          <div className="col" style={{ gap: 18, textAlign: 'center', padding: '16px 8px' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--forest-soft)',
                color: 'var(--forest)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
            >
              <Send size={32} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.4rem' }}>
                {localize('درخواست جمع کرنے کے لیے تیار ہیں؟', 'Darkhast jama karne ke liye tayyar hain?', 'Ready to Submit Your Application?')}
              </h3>
              <p className="wizard-explanation-text" style={{ maxWidth: 440, margin: '0 auto' }}>
                {localize(
                  'بٹن دبانے پر سسٹم فوری طور پر قواعد اور ڈیٹا کی بنیاد پر فیصلہ یا رہنمائی فراہم کرے گا۔',
                  'Button dabane par system fori tor par qawaid aur data ki bunyad par faisla ya rehnumai faraham karega.',
                  'Your claim will be verified immediately against policy rules. You will receive an instant decision or triage update.'
                )}
              </p>
            </div>

            <div
              className="card flat col"
              style={{
                background: 'var(--ivory-alt)',
                border: '1px solid var(--border)',
                maxWidth: 440,
                margin: '0 auto',
                width: '100%',
                padding: '14px',
                textAlign: rtl ? 'right' : 'left'
              }}
            >
              <div className="row spread small">
                <span>{localize('امیدوار', 'Umeedwar', 'Claimant')}:</span>
                <b>{d.name}</b>
              </div>
              <div className="row spread small">
                <span>{localize('شناختی کارڈ', 'CNIC', 'CNIC')}:</span>
                <b className="mono">{fmtCnic(d.cnic)}</b>
              </div>
              <div className="row spread small">
                <span>{localize('ضلع', 'Zila', 'District')}:</span>
                <b>{d.district}</b>
              </div>
              <div className="row spread small">
                <span>{localize('فعال اجازتیں', 'Faal ijazatein', 'Active Permissions')}:</span>
                <b>{Object.values(consent).filter(Boolean).length} {localize('منظور', 'manzoor', 'granted')}</b>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={submitClaim}
              style={{
                fontSize: '1.15rem',
                padding: '14px 32px',
                margin: '0 auto',
                minWidth: 260
              }}
            >
              {busy ? (
                <span>{localize('درخواست بھیجی اور جانچی جا رہی ہے…', 'Darkhast bheji aur jaanchi ja rahi hai…', 'Submitting & Verifying…')}</span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Send size={18} />
                  <span>{t('send')}</span>
                </span>
              )}
            </button>
          </div>
        )}

        <ErrorBox e={err} />

        {/* Wizard Navigation Footer (Back / Next / Submit) */}
        {step < 7 && (
          <div className="row spread" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <button
              type="button"
              className="btn ghost"
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} />
              <span>{t('back')}</span>
            </button>

            {step < 6 ? (
              <button
                type="button"
                disabled={!isStepValid()}
                onClick={() => setStep(step + 1)}
              >
                <span>
                  {step === 4 && !photo ? `${t('skip')} / ${t('next')}` : t('next')}
                </span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={!isStepValid()}
                onClick={() => setStep(7)}
              >
                <span>{localize('تصدیق اور جمع کی طرف بڑھیں', 'Tasdeeq aur jama ki taraf barhein', 'Proceed to Submit')}</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
