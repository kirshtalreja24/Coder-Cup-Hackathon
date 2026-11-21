import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  X,
  Radio,
  Sparkles,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Send,
  Edit3,
  Languages,
  BookOpen,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from 'lucide-react'
import {
  listen,
  speak,
  playPrompt,
  stop,
  replayLast,
  isAudioPlaying,
  onAudioState,
  getVoiceStatus,
  canListen,
  PRE_RENDERED_PROMPTS
} from '../voice'
import { apiPost } from '../api'

// Audio Waveform Visualizer Component
function Waveform({ active, level = 0.5, color = 'var(--gold, #C49A56)' }) {
  const bars = [16, 28, 42, 60, 80, 65, 45, 75, 55, 35, 20, 14]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        height: '60px',
        margin: '8px 0'
      }}
    >
      {bars.map((baseH, i) => {
        const dynamicH = active
          ? Math.max(8, Math.min(54, baseH * level * (0.8 + 0.4 * Math.sin((i + Date.now() / 150)))))
          : 6

        return (
          <div
            key={i}
            style={{
              width: '4px',
              height: `${dynamicH}px`,
              background: active ? color : 'rgba(255, 255, 255, 0.25)',
              borderRadius: '2px',
              transition: 'height 0.1s ease',
              animation: active ? `wavePulse 1s ease-in-out infinite ${i * 0.08}s` : 'none'
            }}
          />
        )
      })}
    </div>
  )
}

export function VoiceAssistant({ inline = false, onClose, initialPrompt = '' }) {
  const [lang, setLang] = useState('ur') // 'ur' | 'roman' | 'en'
  const [state, setState] = useState('idle') // 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
  const [audioLevel, setAudioLevel] = useState(0.4)
  const [transcript, setTranscript] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [response, setResponse] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [voiceInfo, setVoiceInfo] = useState({ upliftOnline: false, provider: 'Checking…', fallback: '' })
  const [errorMessage, setErrorMessage] = useState('')
  const [showOfflineClips, setShowOfflineClips] = useState(false)
  const [playingClipId, setPlayingClipId] = useState(null)

  const stopListenRef = useRef(null)

  // Listen to audio playback events
  useEffect(() => {
    const unsub = onAudioState((playing) => {
      setIsPlayingAudio(playing)
      if (playing) {
        setState((st) => (st === 'listening' ? st : 'speaking'))
      } else {
        setState((st) => (st === 'speaking' ? 'idle' : st))
        setPlayingClipId(null)
      }
    })

    getVoiceStatus().then(setVoiceInfo)

    return () => {
      unsub()
      stop()
      if (stopListenRef.current) stopListenRef.current()
    }
  }, [])

  // Auto-play initial welcome prompt on open if requested
  useEffect(() => {
    getVoiceStatus().then(setVoiceInfo)
    if (initialPrompt) {
      playPrompt(initialPrompt, 'خوش آمدید۔ میں آپ کی مدد کروں گا۔', 'ur')
    }
    return () => {
      stop()
      if (stopListenRef.current) stopListenRef.current()
      setState('idle')
    }
  }, [initialPrompt])

  // Start / Stop listening
  const handleToggleListen = () => {
    if (state === 'listening') {
      if (stopListenRef.current) stopListenRef.current()
      setState('idle')
      return
    }

    stop()
    setErrorMessage('')
    setState('listening')
    setResponse(null)

    const recognitionLang = lang === 'en' ? 'en-US' : 'ur-PK'

    stopListenRef.current = listen({
      lang: recognitionLang,
      onResult: (text, isFinal) => {
        setTranscript(text)
        if (isFinal) {
          setState('idle')
        }
      },
      onError: (err) => {
        setState('error')
        setErrorMessage(
          lang === 'ur'
            ? 'آواز واضح نہیں سنی جا سکی۔ براہ کرم دوبارہ کوشش کریں۔'
            : 'Could not hear clearly. Tap the microphone and speak again.'
        )
      },
      onEnd: () => {
        setState((st) => (st === 'listening' ? 'idle' : st))
      },
      onAudioLevel: (lvl) => {
        setAudioLevel(lvl)
      },
      onProcessing: (busy) => {
        if (busy) setState('processing')
      }
    })
  }

  // Submit transcript to RAG / policy assistant
  const handleSubmitQuestion = async (queryText = transcript) => {
    if (!queryText.trim()) return
    stop()
    setState('processing')
    setErrorMessage('')

    try {
      const res = await apiPost('/ask', {
        question: queryText,
        lang: lang === 'en' ? 'en' : 'ur'
      })
      setResponse(res)
      setState('idle')

      // Automatically speak the answer
      const answerToSpeak = res.answered
        ? res.answer
        : lang === 'ur'
          ? (res.answer_ur || res.answer)
          : res.answer

      speak(answerToSpeak, lang === 'en' ? 'en' : 'ur')
    } catch (e) {
      setState('error')
      setErrorMessage(
        lang === 'ur'
          ? 'معذرت، جواب حاصل کرنے میں خرابی ہوئی۔ براہ کرم دوبارہ کوشش کریں۔'
          : 'Could not retrieve answer. Please try again.'
      )
    }
  }

  // Quick guidance shortcuts
  const handlePlayGuidance = (promptId, urduText, enText) => {
    stop()
    setPlayingClipId(promptId)
    const targetText = lang === 'en' ? enText : urduText
    playPrompt(promptId, targetText, lang === 'en' ? 'en' : 'ur')
  }

  const content = (
    <div
      style={{
        background: 'var(--paper, #FFFFFF)',
        borderRadius: 'var(--radius-xl, 20px)',
        width: '100%',
        maxWidth: inline ? '820px' : '580px',
        maxHeight: inline ? 'none' : '92vh',
        margin: inline ? '0 auto' : undefined,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: inline
          ? '0 12px 36px rgba(13, 35, 24, 0.08), 0 0 0 1px rgba(196, 154, 86, 0.25)'
          : '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(196, 154, 86, 0.3)',
        overflow: 'hidden'
      }}
    >
        {/* ══════════════════════════════════════════════
            HEADER & ENGINE STATUS
        ══════════════════════════════════════════════ */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0D2318 0%, #173D32 60%, #1A4035 100%)',
            padding: '18px 24px',
            color: '#FDFBF7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(196, 154, 86, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(196, 154, 86, 0.25)',
                border: '1px solid rgba(196, 154, 86, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold, #C49A56)'
              }}
            >
              <Mic size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#FDFBF7' }}>
                  Bharosa Voice Assistant
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.62rem',
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: voiceInfo.upliftOnline ? 'rgba(74, 222, 128, 0.2)' : 'rgba(252, 211, 77, 0.2)',
                    color: voiceInfo.upliftOnline ? '#86EFAC' : '#FDE68A',
                    border: `1px solid ${voiceInfo.upliftOnline ? 'rgba(74, 222, 128, 0.4)' : 'rgba(252, 211, 77, 0.4)'}`
                  }}
                >
                  {voiceInfo.upliftOnline ? '● UPLIFT AI ONLINE' : '◯ OFFLINE READY'}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(253, 251, 247, 0.7)' }}>
                {voiceInfo.upliftOnline
                  ? 'Urdu Speech Recognition & Synthesis Active'
                  : '21 Pre-rendered Urdu clips + Browser Speech Fallback'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Language Selector */}
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(196, 154, 86, 0.3)',
                borderRadius: '8px',
                padding: '2px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Languages size={13} style={{ color: 'var(--gold, #C49A56)' }} />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={{
                  background: 'transparent',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '0.75rem',
                  padding: '4px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="ur" style={{ color: '#000' }}>اردو (Urdu)</option>
                <option value="roman" style={{ color: '#000' }}>Roman Urdu</option>
                <option value="en" style={{ color: '#000' }}>English</option>
              </select>
            </div>

            {onClose && (
              <button
                onClick={() => {
                  stop()
                  onClose()
                }}
                className="ghost icon-btn"
                style={{ color: '#FFF', background: 'transparent', padding: 6, minHeight: 'auto' }}
                title="Close Voice Assistant"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            BODY: CENTRAL MICROPHONE & INTERACTION
        ══════════════════════════════════════════════ */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            background: 'var(--paper, #FFFFFF)'
          }}
        >
          {/* Central Microphone Stage */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              padding: '10px 0'
            }}
          >
            {/* Pulsing Aura Rings during listening */}
            {state === 'listening' && (
              <div
                style={{
                  position: 'absolute',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'rgba(220, 38, 38, 0.15)',
                  border: '2px solid rgba(220, 38, 38, 0.4)',
                  animation: 'audioPulse 1.4s ease-out infinite',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Glowing Aura during speaking */}
            {state === 'speaking' && (
              <div
                style={{
                  position: 'absolute',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'rgba(196, 154, 86, 0.15)',
                  border: '2px solid rgba(196, 154, 86, 0.4)',
                  animation: 'audioPulse 1.8s ease-out infinite',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Large Tactile Microphone Button */}
            <button
              type="button"
              onClick={handleToggleListen}
              disabled={state === 'processing'}
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                background:
                  state === 'listening'
                    ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                    : state === 'speaking'
                      ? 'linear-gradient(135deg, #173D32 0%, #0D2318 100%)'
                      : 'linear-gradient(135deg, #0D2318 0%, #173D32 100%)',
                color: '#FDFBF7',
                border: `3px solid ${state === 'listening' ? '#FCA5A5' : 'var(--gold, #C49A56)'}`,
                boxShadow:
                  state === 'listening'
                    ? '0 0 30px rgba(220, 38, 38, 0.4)'
                    : '0 8px 24px rgba(13, 35, 24, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 2
              }}
              title={state === 'listening' ? 'Tap to finish speaking' : 'Tap to speak'}
            >
              {state === 'listening' ? (
                <Square size={32} />
              ) : state === 'speaking' ? (
                <Volume2 size={36} style={{ color: 'var(--gold, #C49A56)' }} />
              ) : (
                <Mic size={36} style={{ color: 'var(--gold, #C49A56)' }} />
              )}
            </button>

            {/* State Label */}
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--forest-dark, #0D2318)' }}>
                {state === 'listening'
                  ? (lang === 'ur' ? 'آواز سنی جا رہی ہے… بولیں' : 'Listening… speak now')
                  : state === 'processing'
                    ? (lang === 'ur' ? 'آواز کا متن تیار کیا جا رہا ہے…' : 'Transcribing speech…')
                    : state === 'speaking'
                      ? (lang === 'ur' ? 'آواز میں رہنمائی سنائی جا رہی ہے' : 'Speaking guidance…')
                      : state === 'error'
                        ? (lang === 'ur' ? 'آواز واضح نہیں تھی۔ دوبارہ بولیں' : 'Could not hear clearly')
                        : (lang === 'ur' ? 'بولنے کے لیے مائیک دبائیں' : 'Tap microphone to speak')}
              </div>
              <div className="small subtle" style={{ marginTop: 2 }}>
                {state === 'listening'
                  ? 'بولنا ختم کرنے کے لیے بٹن دوبارہ دبائیں (Tap to finish)'
                  : 'اردو بولیں یا نیچے دی گئی رہنمائی منتخب کریں'}
              </div>
            </div>

            {/* Animated Waveform */}
            <Waveform
              active={state === 'listening' || state === 'speaking'}
              level={audioLevel}
              color={state === 'listening' ? '#DC2626' : 'var(--gold, #C49A56)'}
            />
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div
              style={{
                width: '100%',
                background: '#FEE2E2',
                border: '1.5px solid #FECACA',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#991B1B',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TRANSCRIPT SECTION (EDITABLE BEFORE SUBMIT)
          ══════════════════════════════════════════════ */}
          {(transcript || isEditing) && (
            <div
              style={{
                width: '100%',
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '12px',
                border: '1.5px solid var(--border-subtle, #E5E7EB)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div className="row spread" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--forest-dark, #0D2318)' }}>
                  {lang === 'ur' ? 'آپ کی کہی گئی بات (Spoken Transcript):' : 'Spoken Transcript:'}
                </span>

                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="ghost small icon-btn"
                    onClick={() => setIsEditing(!isEditing)}
                    title="Edit transcript before submission"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    className="ghost small icon-btn"
                    onClick={() => speak(transcript, lang === 'en' ? 'en' : 'ur')}
                    title="Read transcript aloud"
                  >
                    <Volume2 size={14} />
                  </button>
                </div>
              </div>

              {isEditing ? (
                <textarea
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  dir={lang === 'ur' ? 'rtl' : 'ltr'}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '1rem',
                    fontFamily: lang === 'ur' ? 'Noto Nastaliq Urdu, serif, Tahoma' : 'inherit',
                    borderRadius: '8px',
                    border: '1.5px solid var(--forest, #173D32)',
                    background: '#FFFFFF'
                  }}
                />
              ) : (
                <div
                  dir={lang === 'ur' ? 'rtl' : 'ltr'}
                  style={{
                    fontSize: '1.15rem',
                    color: 'var(--forest-dark, #0D2318)',
                    fontFamily: lang === 'ur' ? 'Noto Nastaliq Urdu, serif, Tahoma' : 'inherit',
                    lineHeight: 1.6,
                    padding: '4px 0'
                  }}
                >
                  "{transcript}"
                </div>
              )}

              {/* Submit Query Button */}
              <div className="row spread" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => {
                    setTranscript('')
                    setIsEditing(false)
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={() => handleSubmitQuestion()}
                  disabled={!transcript.trim() || state === 'processing'}
                  style={{
                    padding: '8px 18px',
                    background: 'var(--forest, #173D32)',
                    color: '#FFF',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Send size={14} />
                  <span>{lang === 'ur' ? 'رہنمائی حاصل کریں' : 'Ask Question'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              ASSISTANT SPOKEN RESPONSE CARD
          ══════════════════════════════════════════════ */}
          {response && (
            <div
              style={{
                width: '100%',
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1.5px solid var(--forest, #173D32)',
                boxShadow: '0 4px 14px rgba(23, 61, 50, 0.08)',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div className="row spread" style={{ alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: response.answered ? '#DCFCE7' : '#FEF3C7',
                    color: response.answered ? '#15803D' : '#92400E',
                    border: `1px solid ${response.answered ? '#BBF7D0' : '#FDE68A'}`
                  }}
                >
                  {response.answered ? 'VERIFIED RAG ANSWER' : 'POLICY ABSTENTION'}
                </span>

                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => replayLast()}
                    style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Repeat audio guidance"
                  >
                    <RotateCcw size={13} />
                    <span>Replay (دوبارہ سنیں)</span>
                  </button>

                  <button
                    type="button"
                    className="btn ghost icon-btn small"
                    onClick={() => stop()}
                    title="Stop speaking"
                  >
                    <VolumeX size={15} />
                  </button>
                </div>
              </div>

              <div
                dir={lang === 'ur' ? 'rtl' : 'ltr'}
                style={{
                  fontSize: '1.25rem',
                  lineHeight: 1.6,
                  color: 'var(--forest-dark, #0D2318)',
                  fontFamily: lang === 'ur' ? 'Noto Nastaliq Urdu, serif, Tahoma' : 'inherit'
                }}
              >
                {response.answered
                  ? response.answer
                  : lang === 'ur'
                    ? (response.answer_ur || response.answer)
                    : response.answer}
              </div>

              {/* Citations if available */}
              {response.sources?.length > 0 && (
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 10, fontSize: '0.74rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--muted, #6B7280)', marginBottom: 4 }}>
                    Official Relief Citations:
                  </div>
                  {response.sources.map((s, idx) => (
                    <div key={idx} style={{ color: 'var(--forest, #173D32)' }}>
                      [{idx + 1}] {s.source} — {s.section}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════
              SIMPLE SPOKEN GUIDANCE SHORTCUTS (REQ)
          ══════════════════════════════════════════════ */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--forest-dark, #0D2318)' }}>
              {lang === 'ur' ? 'عام صوتی رہنمائی (Spoken Guidance):' : 'Spoken Guidance Clips:'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {/* Guidance 1 */}
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  handlePlayGuidance(
                    'welcome',
                    'ہمیں بتائیں کہ آپ کو کس چیز میں مدد چاہیے۔',
                    'Tell us what you need help with.'
                  )
                }
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: playingClipId === 'welcome' ? 'rgba(196, 154, 86, 0.2)' : 'var(--ivory, #F5F0E6)',
                  border: `1.5px solid ${playingClipId === 'welcome' ? 'var(--gold, #C49A56)' : 'transparent'}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div className="row spread" style={{ width: '100%', alignItems: 'center' }}>
                  <Volume2 size={14} style={{ color: 'var(--gold, #C49A56)' }} />
                  <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: 'var(--muted, #6B7280)' }}>
                    PLAY
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--forest-dark, #0D2318)' }}>
                  "Tell us what you need help with."
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gold-dark, #92400E)' }}>
                  ہمیں بتائیں کہ کیا مدد چاہیے
                </div>
              </button>

              {/* Guidance 2 */}
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  handlePlayGuidance(
                    'offline_saved',
                    'آپ کی درخواست اس فون پر محفوظ ہے۔',
                    'Your application has been saved.'
                  )
                }
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: playingClipId === 'offline_saved' ? 'rgba(196, 154, 86, 0.2)' : 'var(--ivory, #F5F0E6)',
                  border: `1.5px solid ${playingClipId === 'offline_saved' ? 'var(--gold, #C49A56)' : 'transparent'}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div className="row spread" style={{ width: '100%', alignItems: 'center' }}>
                  <Volume2 size={14} style={{ color: 'var(--gold, #C49A56)' }} />
                  <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: 'var(--muted, #6B7280)' }}>
                    PLAY
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--forest-dark, #0D2318)' }}>
                  "Your application has been saved."
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gold-dark, #92400E)' }}>
                  آپ کی درخواست محفوظ ہو گئی
                </div>
              </button>

              {/* Guidance 3 */}
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  handlePlayGuidance(
                    'human_review',
                    'ہمیں آپ کی درخواست کی جانچ کے لیے کسی انسان کی ضرورت ہے۔',
                    'We need someone to review your application.'
                  )
                }
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: playingClipId === 'human_review' ? 'rgba(196, 154, 86, 0.2)' : 'var(--ivory, #F5F0E6)',
                  border: `1.5px solid ${playingClipId === 'human_review' ? 'var(--gold, #C49A56)' : 'transparent'}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div className="row spread" style={{ width: '100%', alignItems: 'center' }}>
                  <Volume2 size={14} style={{ color: 'var(--gold, #C49A56)' }} />
                  <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: 'var(--muted, #6B7280)' }}>
                    PLAY
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--forest-dark, #0D2318)' }}>
                  "We need someone to review."
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gold-dark, #92400E)' }}>
                  ایک انسان آپ کا کیس دیکھے گا
                </div>
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              OFFLINE PRE-RENDERED CLIPS BROWSER (REQ)
          ══════════════════════════════════════════════ */}
          <div
            style={{
              width: '100%',
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '12px 16px'
            }}
          >
            <div
              className="row spread"
              style={{ cursor: 'pointer', alignItems: 'center' }}
              onClick={() => setShowOfflineClips(!showOfflineClips)}
            >
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <BookOpen size={16} style={{ color: 'var(--forest, #173D32)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--forest-dark, #0D2318)' }}>
                  Offline Voice Library ({PRE_RENDERED_PROMPTS.length} Pre-Rendered Urdu Clips)
                </span>
              </div>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="small subtle" style={{ fontSize: '0.72rem' }}>
                  100% Offline Static MP3s
                </span>
                {showOfflineClips ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showOfflineClips && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
                {PRE_RENDERED_PROMPTS.map((p) => {
                  const isPlaying = playingClipId === p.id

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '8px 12px',
                        background: isPlaying ? 'rgba(196, 154, 86, 0.15)' : '#FFFFFF',
                        border: `1px solid ${isPlaying ? 'var(--gold, #C49A56)' : '#E5E7EB'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--forest-dark, #0D2318)' }}>
                          {p.en}
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--gold-dark, #92400E)',
                            direction: 'rtl',
                            fontFamily: 'Noto Nastaliq Urdu, serif, Tahoma'
                          }}
                        >
                          {p.ur}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                          if (isPlaying) {
                            stop()
                            setPlayingClipId(null)
                          } else {
                            handlePlayGuidance(p.id, p.ur, p.en)
                          }
                        }}
                        style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        <span>{isPlaying ? 'Stop' : 'Play'}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            background: 'var(--ivory, #F5F0E6)',
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--muted, #6B7280)' }}>
            Accessibility: Voice is supported via Uplift AI Orator (Urdu) & Web Speech API.
          </div>
          {onClose && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                stop()
                onClose()
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
  )

  if (inline) {
    return content
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(13, 35, 24, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          stop()
          onClose()
        }
      }}
    >
      {content}
    </div>
  )
}

export default function VoiceAssistantModal({ isOpen, onClose, initialPrompt = '' }) {
  if (!isOpen) return null
  return <VoiceAssistant inline={false} onClose={onClose} initialPrompt={initialPrompt} />
}
