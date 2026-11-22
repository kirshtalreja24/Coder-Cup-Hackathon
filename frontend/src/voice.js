// Voice for people who cannot read.
//  OUTPUT: pre-rendered Urdu clips (cached offline) -> Uplift AI TTS through OUR server -> browser speech.
//  INPUT : Uplift AI speech-to-text through OUR server (short WAV recording) -> browser speech recognition -> typing/buttons.
// Every step falls back to the next, so a missing key, a dead provider or no signal never blocks the citizen.
import { BASE, getToken } from './api'

let current = null // currently playing Audio
const blobCache = new Map()
let statusCache = null
let lastSpokenText = ''
let lastSpokenLang = 'ur'
let lastPromptId = null

const audioListeners = new Set()
const emitAudioState = (isPlaying) => {
  audioListeners.forEach((fn) => fn(isPlaying))
}

export const onAudioState = (fn) => {
  audioListeners.add(fn)
  return () => audioListeners.delete(fn)
}

export async function getVoiceStatus() {
  try {
    const res = await fetch(BASE + '/voice/status')
    if (!res.ok) throw new Error('status ' + res.status)
    const json = await res.json()
    statusCache = json.tts === true
    return {
      upliftOnline: json.tts === true,
      provider: json.provider || 'Uplift AI (Pakistani Urdu)',
      tts: json.tts,
      stt: json.stt,
      fallback: json.fallback || 'Pre-rendered Urdu clips + browser speech engine',
      offlineClipsCount: 21
    }
  } catch {
    statusCache = false
    return {
      upliftOnline: false,
      provider: 'Offline / Browser Fallback Engine',
      tts: false,
      stt: false,
      fallback: 'Pre-rendered Urdu MP3 clips (Available Offline)',
      offlineClipsCount: 21
    }
  }
}

async function serverVoice() {
  if (statusCache === null) {
    try {
      const st = await getVoiceStatus()
      statusCache = st.upliftOnline
    } catch {
      statusCache = false
    }
  }
  return statusCache
}

export function stop() {
  try {
    if (current) {
      current.pause()
      current.currentTime = 0
    }
  } catch {}
  try {
    window.speechSynthesis?.cancel()
  } catch {}
  emitAudioState(false)
}

export function isAudioPlaying() {
  return (current && !current.paused) || (window.speechSynthesis?.speaking ?? false)
}

function playUrl(url) {
  return new Promise((resolve, reject) => {
    stop()
    const a = new Audio(url)
    current = a
    emitAudioState(true)

    a.onended = () => {
      emitAudioState(false)
      resolve(true)
    }
    a.onerror = () => {
      emitAudioState(false)
      reject(new Error('audio playback error'))
    }
    a.play().catch((err) => {
      emitAudioState(false)
      reject(err)
    })
  })
}

export function browserSpeak(text, lang = 'ur') {
  return new Promise((resolve) => {
    if (!text || !('speechSynthesis' in window)) {
      emitAudioState(false)
      return resolve(false)
    }
    try {
      stop()
      emitAudioState(true)
      const u = new SpeechSynthesisUtterance(text)
      const want = lang === 'ur' ? 'ur' : 'en'
      u.lang = want === 'ur' ? 'ur-PK' : 'en-US'
      const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(want))
      if (v) u.voice = v
      u.rate = 0.88
      u.onend = () => {
        emitAudioState(false)
        resolve(true)
      }
      u.onerror = () => {
        emitAudioState(false)
        resolve(false)
      }
      window.speechSynthesis.speak(u)
    } catch {
      emitAudioState(false)
      resolve(false)
    }
  })
}

// Dynamic text (decision reasons, RAG answers, guidance).
// Urdu text goes to Uplift AI TTS via the server when online; falls back to browser voice.
export async function speak(text, lang = 'ur') {
  if (!text) return false
  lastSpokenText = text
  lastSpokenLang = lang
  lastPromptId = null
  stop()

  if (lang === 'ur' && navigator.onLine && getToken() && (await serverVoice())) {
    try {
      let url = blobCache.get(text)
      if (!url) {
        const r = await fetch(BASE + '/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
          body: JSON.stringify({ text: text.slice(0, 600) })
        })
        if (!r.ok) throw new Error('tts ' + r.status)
        url = URL.createObjectURL(await r.blob())
        blobCache.set(text, url)
      }
      await playUrl(url)
      return true
    } catch {
      // Fall through to browser voice
    }
  }
  return browserSpeak(text, lang)
}

// Fixed prompts: pre-rendered Urdu clip (works 100% offline) -> speak(text) fallback
export function playPrompt(id, fallbackText, lang = 'ur') {
  lastPromptId = id
  lastSpokenText = fallbackText
  lastSpokenLang = lang
  stop()
  return new Promise((resolve) => {
    if (lang !== 'ur') {
      speak(fallbackText, lang).then(resolve)
      return
    }
    playUrl(`/audio/${id}.mp3`)
      .then(() => resolve(true))
      .catch(() => {
        speak(fallbackText, lang).then(resolve)
      })
  })
}

export function replayLast() {
  if (lastPromptId) {
    return playPrompt(lastPromptId, lastSpokenText, lastSpokenLang)
  }
  if (lastSpokenText) {
    return speak(lastSpokenText, lastSpokenLang)
  }
  return playPrompt('welcome', 'خوش آمدید۔ میں آپ کی مدد کروں گا۔', 'ur')
}

// ---------------- Speech-to-Text Input ----------------
export const canListen = () =>
  !!(navigator.mediaDevices?.getUserMedia) || !!(window.SpeechRecognition || window.webkitSpeechRecognition)

const URDU_DIGITS = {
  '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9,
  '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9
}
const WORDS = {
  'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8, 'نو': 9, 'دس': 10,
  'ہزار': 1000, 'سو': 100, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
  'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'thousand': 1000
}

export function spokenNumber(text) {
  if (!text) return ''
  const s = [...text].map((c) => (c in URDU_DIGITS ? URDU_DIGITS[c] : c)).join('')
  const digits = s.replace(/[^0-9]/g, '')
  if (digits) return digits
  let total = 0, cur = 0
  for (const w of s.toLowerCase().split(/\s+/)) {
    const n = WORDS[w]
    if (n === undefined) continue
    if (n === 1000) { total += (cur || 1) * 1000; cur = 0 }
    else if (n === 100) { cur = (cur || 1) * 100 }
    else cur += n
  }
  return String(total + cur || '')
}

// Record mono 16 kHz WAV for Uplift AI STT
async function recordWav(maxMs, onStop, onAudioLevel) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
  })

  // Optional audio level visualizer
  let animId = null
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)()
    const srcNode = actx.createMediaStreamSource(stream)
    const analyser = actx.createAnalyser()
    analyser.fftSize = 64
    srcNode.connect(analyser)
    const dataArr = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(dataArr)
      const avg = dataArr.reduce((s, v) => s + v, 0) / dataArr.length
      onAudioLevel?.(Math.min(1, avg / 80))
      animId = requestAnimationFrame(tick)
    }
    tick()
  } catch {}

  const rec = new MediaRecorder(stream)
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  const done = new Promise((resolve) => {
    rec.onstop = async () => {
      if (animId) cancelAnimationFrame(animId)
      stream.getTracks().forEach((t) => t.stop())
      resolve(new Blob(chunks, { type: rec.mimeType }))
    }
  })
  rec.start()

  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs)
  onStop(() => {
    clearTimeout(timer)
    if (animId) cancelAnimationFrame(animId)
    if (rec.state === 'recording') rec.stop()
  })

  const raw = await done
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const buf = await ctx.decodeAudioData(await raw.arrayBuffer())
  ctx.close()
  const rate = 16000
  const len = Math.floor(buf.duration * rate)
  const off = new OfflineAudioContext(1, len, rate)
  const src = off.createBufferSource()
  src.buffer = buf
  src.connect(off.destination)
  src.start()
  const pcm = (await off.startRendering()).getChannelData(0)
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true)
  out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true)
  pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return new Blob([out], { type: 'audio/wav' })
}

function browserListen({ lang, onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    onError?.('Speech recognition not supported in this browser. Please type.')
    onEnd?.()
    return () => {}
  }
  const r = new SR()
  r.lang = lang
  r.interimResults = true
  r.maxAlternatives = 1

  r.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map((res) => res[0].transcript)
      .join(' ')
    onResult?.(transcript, e.results[0].isFinal)
  }
  r.onerror = (e) => onError?.(e.error)
  r.onend = () => onEnd?.()

  try {
    r.start()
  } catch {
    onError?.('start_failed')
    onEnd?.()
  }
  return () => {
    try { r.stop() } catch {}
  }
}

// Full listen orchestrator with state reporting
export function listen({
  lang = 'ur-PK',
  onResult,
  onError,
  onEnd,
  onAudioLevel,
  onProcessing
}) {
  let stopRec = () => {}
  let stopped = false

  ;(async () => {
    // Try Uplift AI STT first if online and token available
    if (
      lang.startsWith('ur') &&
      navigator.onLine &&
      getToken() &&
      (await serverVoice()) &&
      navigator.mediaDevices?.getUserMedia &&
      window.MediaRecorder
    ) {
      try {
        const wav = await recordWav(8000, (s) => { stopRec = s }, onAudioLevel)
        onProcessing?.(true)
        const fd = new FormData()
        fd.append('file', wav, 'speech.wav')
        const r = await fetch(BASE + '/voice/stt', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + getToken() },
          body: fd
        })
        if (!r.ok) throw new Error('stt ' + r.status)
        const { text } = await r.json()
        onProcessing?.(false)
        if (text) {
          onResult?.(text, true)
          onEnd?.()
          return
        }
        throw new Error('empty transcript')
      } catch (e) {
        onProcessing?.(false)
        if (stopped) {
          onEnd?.()
          return
        }
        // Fall back to browser speech recognition
        stopRec = browserListen({ lang, onResult, onError, onEnd })
        return
      }
    }
    stopRec = browserListen({ lang, onResult, onError, onEnd })
  })()

  return () => {
    stopped = true
    stopRec()
  }
}

// ═════════════════════════════════════════════════════════════════
// PRE-RENDERED URDU VOICE CLIPS MANIFEST (100% Offline Static MP3s)
// ═════════════════════════════════════════════════════════════════
export const PRE_RENDERED_PROMPTS = [
  {
    id: 'welcome',
    ur: 'خوش آمدید۔ میں آپ کی مدد کروں گا۔ بٹن دبا کر بولیں۔',
    roman: 'Khush aamdeed. Main aap ki madad karoon ga. Button daba kar bolein.',
    en: 'Welcome. I will help you. Press the button and speak.',
    category: 'guidance'
  },
  {
    id: 'offline_saved',
    ur: 'انٹرنیٹ نہیں ہے۔ آپ کا کام محفوظ ہو گیا ہے۔ نیٹ آنے پر خود بھیج دیا جائے گا۔',
    roman: 'Internet nahi hai. Aap ka kaam mehfooz ho gaya hai. Net aane par khud bhej diya jaye ga.',
    en: 'Your application has been saved on this device. It will sync automatically when connectivity returns.',
    category: 'system'
  },
  {
    id: 'human_review',
    ur: 'ہمیں پوری تسلی نہیں، اس لیے ایک انسان آپ کا کیس دیکھے گا۔ آپ کو دوبارہ کچھ بتانا نہیں پڑے گا۔',
    roman: 'Humein poori tasalli nahi, is liye aik insaan aap ka case dekhe ga. Aap ko dobara kuch batana nahi pare ga.',
    en: 'We need someone to review your application. You will not need to repeat anything.',
    category: 'decision'
  },
  {
    id: 'approved',
    ur: 'مبارک ہو۔ آپ کی درخواست منظور ہو گئی۔',
    roman: 'Mubarak ho. Aap ki darkhwast manzoor ho gayi.',
    en: 'Congratulations. Your relief application has been approved.',
    category: 'decision'
  },
  {
    id: 'need_proof',
    ur: 'ہمیں ایک اور چیز چاہیے۔ اسکرین پر دیکھیں۔',
    roman: 'Humein aik aur cheez chahiye. Screen par dekhein.',
    en: 'We need additional proof or verification. Please look at the screen.',
    category: 'decision'
  },
  {
    id: 'say_name',
    ur: 'اپنا نام بولیں۔',
    roman: 'Apna naam bolein.',
    en: 'Please speak your full name.',
    category: 'form'
  },
  {
    id: 'say_cnic',
    ur: 'اپنا شناختی کارڈ نمبر بولیں، یا نمبر لکھیں۔',
    roman: 'Apna shanakhti card number bolein, ya number likhein.',
    en: 'Say your ID card number, or type the digits.',
    category: 'form'
  },
  {
    id: 'say_income',
    ur: 'آپ کی مہینے کی کمائی کتنی ہے؟',
    roman: 'Aap ki maheene ki kamai kitni hai?',
    en: 'How much do you earn in a month?',
    category: 'form'
  },
  {
    id: 'take_photo',
    ur: 'اب اپنے شناختی کارڈ کی تصویر لیں۔ کارڈ سیدھا رکھیں۔',
    roman: 'Ab apne shanakhti card ki tasweer lein. Card seedha rakhein.',
    en: 'Now take a photo of your ID card. Keep it flat and clear.',
    category: 'form'
  },
  {
    id: 'scam_alert',
    ur: 'خبردار۔ یہ پیغام دھوکا لگتا ہے۔ جواب نہ دیں، پیسے نہ بھیجیں۔',
    roman: 'Khabardaar. Yeh paighaam dhoka lagta hai. Jawab na dein, paise na bhejein.',
    en: 'Warning. This message looks like a scam. Do not reply or send money.',
    category: 'safety'
  },
  {
    id: 'scam_ok',
    ur: 'یہ پیغام عام لگتا ہے۔ پھر بھی اپنا پن کسی کو نہ بتائیں۔',
    roman: 'Yeh paighaam aam lagta hai. Phir bhi apna PIN kisi ko na batein.',
    en: 'This message appears genuine. Still, never disclose your secret PIN.',
    category: 'safety'
  },
  {
    id: 'helper_switch',
    ur: 'اب دوسرے خاندان کا صفحہ کھل گیا ہے۔ پچھلا خاندان بند ہو گیا۔',
    roman: 'Ab doosre khandaan ka safha khul gaya hai. Pichla khandaan band ho gaya.',
    en: 'Switched to another family. The previous family is now sealed and locked.',
    category: 'helper'
  }
]
