import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  AlertTriangle,
  HelpCircle,
  ClipboardCheck,
  Lock,
  Volume2,
  VolumeX,
  Mic,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronRight,
  Wifi,
  WifiOff,
  UserCheck,
  Camera,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react'
import { getUser, apiGet, money, when } from '../api'
import { useLang, LangSwitch } from '../i18n'
import { loadBox, flush, isEffectiveOnline } from '../offline'
import OfflineSyncCenter from '../components/OfflineSyncCenter'
import VoiceAssistantModal from '../components/VoiceAssistantModal'
import { useAsync, StatusBadge, Skeleton, MockTag } from '../ui'
import { playPrompt, speak, stop, onAudioState } from '../voice'

// High-fidelity, dignified vector illustration of an assisted household
function FamilyReliefIllustration() {
  return (
    <svg
      viewBox="0 0 320 220"
      className="hero-family-svg"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Illustration of a mother and children receiving secure relief assistance"
    >
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C49A56" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#173D32" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C49A56" />
          <stop offset="100%" stopColor="#9E7738" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFEFA" />
          <stop offset="100%" stopColor="#EDE5D8" />
        </linearGradient>
      </defs>

      {/* Background Soft Aura */}
      <circle cx="160" cy="110" r="95" fill="url(#sunGlow)" />

      {/* Protective Dome Roof Outline */}
      <path
        d="M 60 160 Q 160 55 260 160"
        stroke="#D9E7DC"
        strokeWidth="3"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      {/* Ground Horizon */}
      <ellipse cx="160" cy="190" rx="120" ry="14" fill="#102B24" opacity="0.4" />

      {/* Elder / Mother Figure (Respectful silhouette & shawl) */}
      <g transform="translate(90, 80)">
        {/* Head & Shawl / Dupatta */}
        <circle cx="45" cy="22" r="16" fill="#EDE5D8" />
        <path
          d="M 28 22 C 28 6 62 6 62 22 C 62 38 72 65 74 95 C 55 98 35 98 16 95 C 18 65 28 38 28 22 Z"
          fill="#173D32"
          stroke="#C49A56"
          strokeWidth="1.5"
        />
        {/* Inner Robe */}
        <path d="M 33 42 Q 45 48 57 42 L 54 94 L 36 94 Z" fill="#D9E7DC" />
        {/* Supportive Arm extending forward */}
        <path
          d="M 54 48 Q 72 60 84 56"
          stroke="#EDE5D8"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>

      {/* Child Figure standing close */}
      <g transform="translate(65, 120)">
        <circle cx="20" cy="14" r="10" fill="#EDE5D8" />
        <path
          d="M 10 24 C 10 24 30 24 30 24 C 34 45 35 60 35 60 L 5 60 C 5 60 6 45 10 24 Z"
          fill="#A65D49"
        />
      </g>

      {/* Floating Relief Certificate & Trust Shield */}
      <g transform="translate(182, 85)">
        {/* Relief Document */}
        <rect
          x="0"
          y="0"
          width="76"
          height="92"
          rx="8"
          fill="url(#cardGrad)"
          stroke="#C49A56"
          strokeWidth="2"
          filter="drop-shadow(0 4px 10px rgba(16,43,36,0.3))"
        />
        {/* Document Header Line */}
        <rect x="10" y="12" width="34" height="5" rx="2" fill="#173D32" />
        <rect x="10" y="22" width="56" height="3" rx="1.5" fill="#C49A56" opacity="0.7" />
        <rect x="10" y="30" width="48" height="3" rx="1.5" fill="#7E9088" opacity="0.6" />
        <rect x="10" y="38" width="52" height="3" rx="1.5" fill="#7E9088" opacity="0.6" />

        {/* Golden Trust Seal on Document */}
        <circle cx="38" cy="62" r="16" fill="url(#shieldGrad)" />
        <path
          d="M 32 62 L 36 66 L 45 57"
          stroke="#FFFEFA"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Small floating sparkles */}
        <circle cx="68" cy="6" r="3" fill="#C49A56" />
        <circle cx="-6" cy="38" r="2.5" fill="#D9E7DC" />
        <circle cx="78" cy="74" r="2" fill="#C49A56" />
      </g>
    </svg>
  )
}

export default function CitizenHome() {
  const { t, lang, rtl, localize } = useLang()
  const nav = useNavigate()
  const u = getUser()
  const cases = useAsync(() => apiGet('/cases?limit=3'), [])
  const box = loadBox().filter((x) => x.state !== 'done')
  const [speaking, setSpeaking] = useState(false)
  const [online, setOnline] = useState(isEffectiveOnline())
  const [showSyncCenter, setShowSyncCenter] = useState(false)
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false)

  useEffect(() => {
    const on = () => setOnline(isEffectiveOnline())
    const off = () => setOnline(isEffectiveOnline())
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const unsub = onAudioState((active) => {
      setSpeaking(active)
    })
    return () => unsub()
  }, [])

  // Spoken text guide for low-literacy users
  const playHomeAudioGuide = async () => {
    if (speaking) {
      stop()
      return
    }

    const text = localize(
      'خوش آمدید۔ امداد کی نئی درخواست کے لیے بڑے سبز بٹن کو دبائیں۔ اگر آپ کی درخواست پہلے سے جمع ہے تو نیچے اس کی جانچ دیکھیں۔ کسی بھی مشکوک ایس ایم ایس کو چیک کرنے کے لیے لال بٹن دبائیں۔',
      'Khush aamdeed. Imdad ki nayi darkhast ke liye baray sabz button ko dabayein. Apni darkhast dekhne ke liye neechay status check karein, ya mashkook message check karein.',
      'Welcome to Bharosa. Press the large green card to apply for relief. You can also check your existing request or verify suspicious messages below.'
    )

    try {
      await playPrompt('welcome', text, lang)
    } catch {
      await speak(text, lang)
    }
  }

  // Determine latest active case for the visual progress tracker
  const latestCase = cases.data && cases.data.length > 0 ? cases.data[0] : null

  // Calculate progress stage (1: Submitted, 2: Under Review / Proof, 3: Decided / Paid)
  const getProgressStage = (status) => {
    if (!status) return { stage: 1, label: localize('درخواست موصول', 'Darkhast mosool', 'Application Received'), icon: CheckCircle2, cls: 'completed' }
    if (['paid', 'approved'].includes(status)) {
      return { stage: 3, label: localize('رقم جاری', 'Raqam jaari', 'Payment Released'), icon: CheckCircle2, cls: 'completed' }
    }
    if (['declined', 'rejected'].includes(status)) {
      return { stage: 3, label: localize('مسترد (اپیل ممکن)', 'Mustared (Appeal mumkin)', 'Declined (Appealable)'), icon: AlertTriangle, cls: 'alert' }
    }
    if (status === 'needs_proof') {
      return { stage: 2, label: localize('شناختی کارڈ تصویر درکار', 'Shanakhti card tasveer darkaar', 'Action Required: CNIC Photo Needed'), icon: Camera, cls: 'alert' }
    }
    if (['awaiting_human', 'needs_consent', 'awaiting_payment_consent'].includes(status)) {
      return { stage: 2, label: localize('تصدیق و جائزہ جاری ہے', 'Tasdeeq aur jaiza jaari hai', 'Verification & Review in Progress'), icon: Clock, cls: 'active' }
    }
    return { stage: 1, label: localize('درخواست موصول', 'Darkhast mosool', 'Application Received'), icon: CheckCircle2, cls: 'completed' }
  }

  const progress = latestCase ? getProgressStage(latestCase.status) : null

  return (
    <div className="col narrow" style={{ gap: 22, paddingBottom: 36 }}>
      {/* 1. Compact Header */}
      <header className="citizen-compact-header">
        {/* Logo and Wordmark */}
        <Link to="/c" className="brand" style={{ textDecoration: 'none' }}>
          <span className="brand-badge" style={{ width: 32, height: 32 }}>
            <ShieldCheck size={18} strokeWidth={2.4} />
          </span>
          <span style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>BHAROSA</span>
          {lang === 'ur' && <span className="brand-urdu" style={{ fontSize: '1.15rem' }}>بھروسہ</span>}
        </Link>

        {/* Right Utility Group */}
        <div className="row" style={{ gap: 8 }}>
          {/* Connectivity Status */}
          <span
            className={`badge ${online ? '' : 'amber'}`}
            style={{ fontSize: '0.74rem', padding: '3px 8px', cursor: 'pointer' }}
            title={online ? 'Connected to server — Click to view sync status' : 'Offline: Local changes queued — Click to view sync status'}
            onClick={() => setShowSyncCenter(true)}
          >
            {online ? <Wifi size={12} strokeWidth={2.5} /> : <WifiOff size={12} strokeWidth={2.5} />}
            <span>{online ? t('online') : t('offline')}</span>
            {box.length > 0 && <span style={{ marginLeft: 3 }}>· {box.length}</span>}
          </span>

          {/* Prototype Badge */}
          <span className="mock-tag" style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)', borderColor: 'var(--gold)' }}>
            {localize('تجرباتی نمونہ', 'Prototype', 'PROTOTYPE ONLY')}
          </span>

          {/* Language Switcher */}
          <LangSwitch />

          {/* Voice Assistance Button */}
          <button
            type="button"
            className={`btn icon-btn small ${speaking ? 'danger' : 'ghost'}`}
            onClick={playHomeAudioGuide}
            title={speaking ? localize('آواز بند کریں', 'Awaz band karein', 'Stop speaking') : localize('آواز میں رہنمائی سنیں', 'Awaz mein rehnumai sunein', 'Listen to voice guide')}
            aria-label="Voice assistance"
            style={{ width: 36, height: 36 }}
          >
            {speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </header>

      {/* Offline Pending Items Notice */}
      {box.length > 0 && (
        <div
          className="banner offline"
          style={{ justifyContent: 'space-between', cursor: 'pointer', padding: '12px 18px', borderRadius: 'var(--radius-md, 10px)' }}
          onClick={() => setShowSyncCenter(true)}
        >
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Clock size={18} style={{ color: 'var(--gold-dark, #92400E)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--forest-dark, #0D2318)' }}>
                {localize(
                  'آپ کی درخواست اس ڈیوائس پر محفوظ ہے۔ نیٹ ورک بحال ہوتے ہی خود جمع ہو جائے گی۔',
                  'Aap ki darkhast is device par mehfooz hai. Net aate hi sync ho jaye gi.',
                  'Your application is saved on this device. It will sync when your connection returns.'
                )}
              </strong>
              <div className="small subtle" style={{ marginTop: 2 }}>
                {localize(
                  `${box.length} درخواستیں ڈیوائس پر محفوظ ہیں · سنک کے لیے کلک کریں`,
                  `${box.length} darkhastein mehfooz hain · Sync ke liye click karein`,
                  `${box.length} claim(s) verified in local storage · Tap to view details or retry sync`
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn small"
            style={{ background: 'var(--forest, #173D32)', color: '#FFF', fontSize: '0.76rem', padding: '6px 12px' }}
          >
            {localize('سنک سینٹر', 'Sync Center', 'Sync Center')}
          </button>
        </div>
      )}

      {/* Offline Sync Center Modal */}
      <OfflineSyncCenter isOpen={showSyncCenter} onClose={() => setShowSyncCenter(false)} />

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal isOpen={showVoiceAssistant} onClose={() => setShowVoiceAssistant(false)} />

      {/* Speaking Indicator Feedback Banner */}
      {speaking && (
        <div className="banner ok" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="voice-speaking-badge">
              <Volume2 size={14} /> {localize('بول رہا ہے…', 'Bol raha hai…', 'Speaking…')}
            </span>
            <span className="small">
              {localize(
                'آواز میں رہنمائی سنائی جا رہی ہے',
                'Awaz mein rehnumai chal rahi hai',
                'Playing voice assistance guide…'
              )}
            </span>
          </div>
          <button className="btn ghost small" onClick={playHomeAudioGuide}>
            {localize('روکیں', 'Rokein', 'Stop')}
          </button>
        </div>
      )}

      {/* 2. Welcoming Hero Section */}
      <section className="citizen-welcome-hero" dir={rtl ? 'rtl' : 'ltr'}>
        <div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.16)', color: '#FFFEFA', border: 'none' }}>
              {t('hello')}, {u.name ? u.name.split(' ')[0] : 'Citizen'}
            </span>
          </div>

          <h1>
            {localize(
              'آپ کی امداد کا آسان راستہ',
              'Aap ki imdad ka aasan rasta',
              'Your relief journey, made simpler.'
            )}
          </h1>

          <p>
            {localize(
              'بیواؤں اور مستحق خاندانوں کے لیے فوری سرکاری امداد۔ بول کر فارم بھریں، اپنے پیسے چیک کریں اور جعلی پیغامات کی تصدیق کریں۔',
              'Bewaon aur mustahiq khandano ke liye imdad ka aasan aur mehfooz zariya. Awaz se rehnumai aur scam se hifazat.',
              'Safe, voice-guided relief payments for widows and households. No confusing paperwork, with protection from fraudulent messages.'
            )}
          </p>

          <button
            type="button"
            className="btn small"
            style={{
              background: 'rgba(255,255,255,0.18)',
              color: '#FFFEFA',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 'var(--radius-full)'
            }}
            onClick={playHomeAudioGuide}
          >
            <Volume2 size={15} />
            <span>{speaking ? localize('رہنمائی بند کریں', 'Rehnumai band karein', 'Stop Voice Guide') : localize('آواز میں سنیں', 'Awaz mein sunein', 'Listen to voice guide')}</span>
          </button>
        </div>

        {/* Dignified Family Vector Illustration */}
        <div style={{ textAlign: 'center' }}>
          <FamilyReliefIllustration />
        </div>
      </section>

      {/* 3. Very Prominent Primary Action Card */}
      <section>
        <Link
          to="/c/claim"
          className="primary-claim-card"
          dir={rtl ? 'rtl' : 'ltr'}
          aria-label="Apply for relief"
        >
          <div className="primary-claim-main">
            <div className="primary-claim-content">
              <div className="primary-claim-badge-icon">
                <FileText size={32} strokeWidth={2.4} />
              </div>
              <div className="primary-claim-titles">
                <h2>{t('claim')}</h2>
                <div className="urdu-sub">
                  {localize('امداد کے لیے درخواست دیں', 'Imdad ke liye darkhast dein', 'Apply for Relief Payment')}
                </div>
                <div className="desc-sub">
                  {localize(
                    'آواز کی مکمل رہنمائی · صرف 3 منٹ · بغیر کسی مشکل کاغذات کے',
                    'Awaz ki mukammal rehnumai · Sirf 3 minute · Baghair kisi mushkil kaghazaat ke',
                    'Voice-guided step-by-step · Takes 3 minutes · Safe & direct'
                  )}
                </div>
              </div>
            </div>

            <div className="primary-claim-arrow" title="Start application">
              {rtl ? <ArrowLeft size={24} strokeWidth={2.5} /> : <ArrowRight size={24} strokeWidth={2.5} />}
            </div>
          </div>

          {/* Integrated Microphone Voice Trigger Option */}
          <div
            className="primary-claim-mic-bar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 10,
              padding: '14px 16px',
              margin: '0 auto',
              width: '100%'
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowVoiceAssistant(true)
            }}
          >
            <div className="row" style={{ gap: 8, justifyContent: 'center', textAlign: 'center' }}>
              <Sparkles size={16} style={{ color: 'var(--gold-dark)' }} />
              <span className="small" style={{ fontWeight: 600 }}>
                {localize('آواز کے ذریعے معاونت اور سوالات:', 'Awaz ke zariye madad aur sawalaat:', 'Voice Assistant & Guidance:')}
              </span>
            </div>

            <button type="button" className="primary-claim-mic-btn" style={{ margin: '0 auto' }}>
              <Mic size={17} style={{ color: 'var(--forest)' }} />
              <span>{localize('بولیں (Assistant)', 'Bolein (Assistant)', 'Voice Assistant')}</span>
            </button>
          </div>
        </Link>
      </section>

      {/* 4. Three Secondary Action Cards */}
      <section>
        <div className="secondary-actions-grid" dir={rtl ? 'rtl' : 'ltr'}>
          {/* Card 1: Check My Application */}
          <Link to="/c/cases" className="secondary-action-card">
            <div className="secondary-action-top">
              <div
                className="secondary-action-icon"
                style={{ background: 'var(--sage-soft)', color: 'var(--forest)' }}
              >
                <ClipboardCheck size={24} strokeWidth={2.2} />
              </div>
              <ChevronRight size={18} className="subtle" />
            </div>

            <div className="secondary-action-text">
              <h3>{t('mycases')}</h3>
              <div className="urdu-title">
                {localize('میری درخواست کا حال', 'Meri darkhast ka haal', 'Check My Application')}
              </div>
              <div className="subtext">
                {localize(
                  'رقم، تاریخ اور فیصلے کی تفصیلات دیکھیں',
                  'Raqam, tareekh aur faislay ki tafseelaat dekhein',
                  'Track payment progress, decision status & proof'
                )}
              </div>
            </div>
          </Link>

          {/* Card 2: Check a Suspicious Message */}
          <Link to="/c/scam" className="secondary-action-card">
            <div className="secondary-action-top">
              <div
                className="secondary-action-icon"
                style={{ background: 'var(--terracotta-soft)', color: 'var(--terracotta)' }}
              >
                <AlertTriangle size={24} strokeWidth={2.2} />
              </div>
              <ChevronRight size={18} className="subtle" />
            </div>

            <div className="secondary-action-text">
              <h3>{t('scam')}</h3>
              <div className="urdu-title">
                {localize('مشکوک پیغام کی جانچ', 'Mashkook paigham ki jaanch', 'Check Suspicious SMS')}
              </div>
              <div className="subtext">
                {localize(
                  'پیسے یا شناختی کارڈ دینے سے پہلے تصدیق کریں',
                  'Paise ya shanakhti card dene se pehle tasdeeq karein',
                  'Verify relief messages before paying fees or sharing CNIC'
                )}
              </div>
            </div>
          </Link>

          {/* Card 3: Get Help */}
          <Link to="/c/ask" className="secondary-action-card">
            <div className="secondary-action-top">
              <div
                className="secondary-action-icon"
                style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}
              >
                <HelpCircle size={24} strokeWidth={2.2} />
              </div>
              <ChevronRight size={18} className="subtle" />
            </div>

            <div className="secondary-action-text">
              <h3>{t('ask')}</h3>
              <div className="urdu-title">
                {localize('مدد اور سوالات', 'Madad aur sawalaat', 'Get Help & Ask Policy')}
              </div>
              <div className="subtext">
                {localize(
                  'بول کر یا لکھ کر سرکاری قواعد معلوم کریں',
                  'Bol kar ya likh kar sarkari qawaid maloom karein',
                  'Voice FAQ with official verified citations'
                )}
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. Visual Application Progress Section (if user has an existing claim) */}
      <section>
        {cases.loading && (
          <div className="card col" style={{ gap: 12 }}>
            <Skeleton height={24} width="40%" />
            <Skeleton height={60} />
          </div>
        )}

        {latestCase ? (
          <div className="visual-progress-card" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="row spread" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <h3 style={{ margin: 0 }}>
                    {localize('آپ کی درخواست کا اسٹیٹس', 'Aap ki darkhast ka status', 'Active Application Progress')}
                  </h3>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--forest)' }}>
                    #{latestCase.id.slice(0, 6)}
                  </span>
                </div>
                <div className="small subtle" style={{ marginTop: 2 }}>
                  {localize('جمع کرائی گئی:', 'Jama karayi:', 'Submitted on')} {when(latestCase.created_at)}
                  {latestCase.amount && (
                    <span> · {localize('امدادی رقم:', 'Imdadi raqam:', 'Relief Amount:')} <b>{money(latestCase.amount)}</b> <MockTag>{localize('تجرباتی', 'Mock', 'MOCK')}</MockTag></span>
                  )}
                </div>
              </div>

              <StatusBadge s={latestCase.status} />
            </div>

            {/* 3-Step Visual Progress Stepper Track */}
            <div className="progress-steps-row" dir="ltr">
              {/* Background Connecting Line */}
              <div className="progress-track-line">
                <div
                  className="progress-track-fill"
                  style={{
                    width:
                      progress.stage === 3
                        ? '100%'
                        : progress.stage === 2
                          ? '50%'
                          : '15%'
                  }}
                />
              </div>

              {/* Stage 1: Submitted */}
              <div className="progress-step-node completed">
                <div className="step-node-bubble">
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                </div>
                <div className="step-node-label">1. {localize('موصول', 'Mosool', 'Submitted')}</div>
                <div className="step-node-sub">{localize('درخواست موصول', 'Darkhast mosool', 'Received')}</div>
              </div>

              {/* Stage 2: Review & Verification */}
              <div
                className={`progress-step-node ${
                  progress.stage >= 2
                    ? progress.cls === 'alert'
                      ? 'alert'
                      : progress.stage === 2
                        ? 'active'
                        : 'completed'
                    : ''
                }`}
              >
                <div className="step-node-bubble">
                  {progress.stage > 2 ? (
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                  ) : progress.stage === 2 && progress.cls === 'alert' ? (
                    <Camera size={20} strokeWidth={2.5} />
                  ) : (
                    <Clock size={20} strokeWidth={2.5} />
                  )}
                </div>
                <div className="step-node-label">2. {localize('تصدیق', 'Tasdeeq', 'Verification')}</div>
                <div className="step-node-sub">
                  {latestCase.status === 'needs_proof'
                    ? localize('تصویر درکار', 'Tasveer darkaar', 'Photo Needed')
                    : localize('شناخت کی جانچ', 'Shanakht ki jaanch', 'Identity Check')}
                </div>
              </div>

              {/* Stage 3: Decision & Payment */}
              <div
                className={`progress-step-node ${
                  progress.stage === 3
                    ? progress.cls === 'alert'
                      ? 'alert'
                      : 'completed'
                    : ''
                }`}
              >
                <div className="step-node-bubble">
                  {progress.stage === 3 && progress.cls === 'alert' ? (
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  ) : progress.stage === 3 ? (
                    <ShieldCheck size={20} strokeWidth={2.5} />
                  ) : (
                    <Clock size={20} strokeWidth={2.5} />
                  )}
                </div>
                <div className="step-node-label">3. {localize('فیصلہ اور رقم', 'Faisla aur raqam', 'Decision & Payout')}</div>
                <div className="step-node-sub">
                  {['paid', 'approved'].includes(latestCase.status)
                    ? localize('رقم جاری', 'Raqam jaari', 'Paid')
                    : localize('حتمی فیصلہ', 'Hatmi faisla', 'Final Decision')}
                </div>
              </div>
            </div>

            {/* Stage Plain-Language Explanation Banner */}
            <div
              className={`banner ${
                latestCase.status === 'needs_proof'
                  ? 'bad'
                  : ['paid', 'approved'].includes(latestCase.status)
                    ? 'ok'
                    : 'info'
              }`}
            >
              {latestCase.status === 'needs_proof' ? (
                <Camera size={18} />
              ) : ['paid', 'approved'].includes(latestCase.status) ? (
                <CheckCircle2 size={18} />
              ) : (
                <Clock size={18} />
              )}
              <div style={{ flex: 1 }}>
                <b>{localize('موجودہ مرحلہ:', 'Maujooda marhala:', 'Current Stage:')} {progress.label}</b>
                <div className="small" style={{ marginTop: 2 }}>
                  {latestCase.status === 'needs_proof'
                    ? localize('شناخت کی تصدیق کے لیے شناختی کارڈ کی واضح تصویر درکار ہے۔', 'Shanakht ki tasdeeq ke liye shanakhti card ki wazeh tasveer darkaar hai.', 'We need a clearer photo of your CNIC to confirm identity.')
                    : ['paid', 'approved'].includes(latestCase.status)
                      ? localize('آپ کی امداد منظور ہو گئی ہے۔ رقم بھیج دی گئی ہے۔', 'Aap ki imdad manzoor ho gayi hai. Raqam bhej di gayi hai.', 'Your relief claim was approved. Payment has been dispatched.')
                      : localize('سرکاری سسٹم آپ کی تفصیلات کی جانچ کر رہا ہے۔', 'Sarkari system aap ki tafseelaat ki jaanch kar raha hai.', 'The relief engine is verifying your registry record against policy rules.')}
                </div>
              </div>

              {latestCase.status === 'needs_proof' && (
                <Link to={'/c/cases/' + latestCase.id} className="btn small danger">
                  {localize('تصویر اپ لوڈ کریں', 'Tasveer upload karein', 'Upload Photo')}
                </Link>
              )}
            </div>

            {/* Action Bar */}
            <div className="row spread" style={{ paddingTop: 4 }}>
              <Link to={'/c/cases/' + latestCase.id} className="btn ghost small">
                <span>{localize('مکمل تفصیلات اور ٹائم لائن دیکھیں', 'Mukammal tafseelaat aur timeline dekhein', 'View Full Details & Timeline')}</span>
                <ChevronRight size={14} />
              </Link>

              <Link to="/c/cases" className="small subtle" style={{ fontWeight: 600 }}>
                {localize('تمام درخواستیں', 'Tamaam darkhastein', 'All requests')} ({cases.data.length})
              </Link>
            </div>
          </div>
        ) : !cases.loading ? (
          <div
            className="card col"
            style={{
              padding: '20px',
              background: 'var(--ivory-alt)',
              border: '1px solid var(--border)',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <Info size={28} className="subtle" />
            <h4 style={{ margin: '6px 0 2px 0', color: 'var(--forest-dark)' }}>
              {localize('کوئی جاری درخواست نہیں', 'Koi jaari darkhast nahi', 'No Active Application')}
            </h4>
            <p className="small subtle" style={{ margin: 0, maxWidth: 380 }}>
              {localize(
                'جب آپ امداد کے لیے درخواست جمع کریں گے تو اس کے ہر مرحلے کی معلومات یہاں نظر آئے گی۔',
                'Jab aap imdad ke liye darkhast jama karein ge to us ke har marhalay ki maloomat yahan nazar aaye gi.',
                'Whenever you submit a claim, its real-time verification and disbursement progress will appear here.'
              )}
            </p>
          </div>
        ) : null}
      </section>

      {/* 6. A Trust Section (3 Assurance Pillars) */}
      <section dir={rtl ? 'rtl' : 'ltr'}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--forest-dark)' }}>
            {localize('آپ کا تحفظ اور رازداری', 'Aap ka tahaffuz aur raazdari', 'Our Trust & Safety Guarantee')}
          </h3>
          <div className="small subtle">
            {localize('سرکاری امدادی سروس کے تین بنیادی اصول', 'Sarkari imdadi service ke teen bunyadi asool', 'Three inviolable protections built into every Bharosa interaction')}
          </div>
        </div>

        <div className="trust-pillars-grid">
          {/* Pillar 1: Protected by Consent */}
          <div className="trust-pillar-card">
            <div className="trust-pillar-header">
              <div className="trust-pillar-icon">
                <ShieldCheck size={20} />
              </div>
              <h4>
                {localize('اجازت سے تحفظ', 'Ijazat se tahaffuz', 'Protected by Consent')}
              </h4>
            </div>
            <p>
              {localize(
                'آپ کی معلومات مکمل طور پر آپ کی صریح اجازت سے محفوظ ہیں۔ ہم آپ کے بتائے بغیر کسی سے ڈیٹا شیئر نہیں کرتے۔',
                'Aap ki maloomat mukammal tor par aap ki ijazat se mehfooz hain. Hum aap ke bataye baghair kisi se data share nahi karte.',
                'Your information is protected by consent. We only verify the details you explicitly allow us to check.'
              )}
            </p>
          </div>

          {/* Pillar 2: Anti-Fraud Rules */}
          <div className="trust-pillar-card">
            <div className="trust-pillar-header">
              <div
                className="trust-pillar-icon"
                style={{ color: 'var(--terracotta)' }}
              >
                <Lock size={20} />
              </div>
              <h4>
                {localize('پاس ورڈ یا فیس کا فراڈ', 'Password ya fees ka fraud', 'No Passwords or Fees')}
              </h4>
            </div>
            <p>
              {localize(
                'کوئی بھی سرکاری سروس کبھی بھی فون یا ایس ایم ایس پر آپ سے پاس ورڈ، پن کوڈ یا فیس نہیں مانگتی۔ ایسے پیغامات سے ہوشیار رہیں۔',
                'Koi bhi sarkari service kabhi bhi phone ya SMS par aap se password, PIN code ya fees nahi maangti. Aise paighamaat se hoshiyar rahein.',
                'No legitimate relief service should ask for your password, PIN, or payment fee through suspicious SMS messages.'
              )}
            </p>
          </div>

          {/* Pillar 3: Revocable Anytime */}
          <div className="trust-pillar-card">
            <div className="trust-pillar-header">
              <div
                className="trust-pillar-icon"
                style={{ color: 'var(--gold-dark)' }}
              >
                <UserCheck size={20} />
              </div>
              <h4>
                {localize('اجازت واپس لینے کا اختیار', 'Ijazat wapis lene ka ikhtiyar', 'Withdraw Anytime')}
              </h4>
            </div>
            <p>
              {localize(
                'آپ جب چاہیں اپنے ڈیٹا کی اجازت واپس لے سکتے ہیں۔ اختیار ہمیشہ آپ کے اپنے ہاتھ میں ہے۔',
                'Aap jab chahein apne data ki ijazat wapis le sakte hain. Ikhtiyar hamesha aap ke apne haath mein hai.',
                'You have full sovereignty. You can revoke data access permissions at any time with a single tap.'
              )}
            </p>
          </div>
        </div>

        {/* Data Sovereignty Action Link */}
        <div style={{ marginTop: 14, textAlign: rtl ? 'right' : 'left' }}>
          <Link
            to="/c/data"
            className="row small"
            style={{
              display: 'inline-flex',
              gap: 8,
              fontWeight: 600,
              textDecoration: 'none',
              color: 'var(--forest)'
            }}
          >
            <Lock size={15} />
            <span>
              {localize(
                'اپنے ڈیٹا اور پرائیویسی پرمیشنز کا انتظام کریں (Manage Data)',
                'Apne data aur privacy permissions ka intezam karein →',
                'Manage my data permissions & access log →'
              )}
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
