// Voice assistance for low-literacy and voice-first citizens.
// OUTPUT ARCHITECTURE:
// 1. Studio-recorded Urdu audio clips (/audio/*.mp3) - 100% offline, natural authentic Urdu.
// 2. Dynamic Urdu text -> Uplift AI TTS proxy via backend /voice/tts (when configured).
// 3. Fallback Speech Engine: Modern Web Speech Synthesis (SpeechSynthesis API) with
//    subcontinental phonetics for Roman Urdu, native Urdu/Hindi voice fallback, and clear English.
// INPUT ARCHITECTURE:
// 1. Uplift AI STT proxy (/voice/stt) when online & configured.
// 2. Web Speech Recognition (SpeechRecognition / webkitSpeechRecognition) fallback.
// 3. Tactile on-screen UI buttons & number converters.

import { BASE, getToken } from './api'

let current = null // Currently playing HTML Audio instance
let activeUtterance = null // Strong reference to prevent Chromium GC bug
const blobCache = new Map()
let statusCache = null
let lastSpokenText = ''
let lastSpokenLang = 'ur'
let lastPromptId = null
let voicesCache = []

const audioListeners = new Set()
const emitAudioState = (isPlaying) => {
  audioListeners.forEach((fn) => {
    try {
      fn(isPlaying)
    } catch {}
  })
}

export const onAudioState = (fn) => {
  audioListeners.add(fn)
  return () => audioListeners.delete(fn)
}

// -------------------------------------------------------------
// Voice status & initialization
// -------------------------------------------------------------
export async function getVoiceStatus() {
  try {
    const res = await fetch(BASE + '/voice/status')
    if (!res.ok) throw new Error('status ' + res.status)
    const json = await res.json()
    statusCache = json.tts === true
    return {
      upliftOnline: json.tts === true,
      provider: json.provider || 'Browser Speech Engine + Offline MP3s',
      tts: json.tts,
      stt: json.stt,
      fallback: json.fallback || '21 Pre-rendered Urdu clips + browser speech engine',
      offlineClipsCount: 21
    }
  } catch {
    statusCache = false
    return {
      upliftOnline: false,
      provider: 'Offline / Browser Fallback Engine',
      tts: false,
      stt: false,
      fallback: '21 Pre-rendered Urdu MP3 clips (Available Offline)',
      offlineClipsCount: 21
    }
  }
}

// Eagerly probe voice status so statusCache is ready without blocking user gestures
if (typeof window !== 'undefined') {
  getVoiceStatus().catch(() => {})
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

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Pre-load and cache browser voices
function initVoices() {
  if (!canSpeak()) return []
  const v = window.speechSynthesis.getVoices()
  if (v && v.length > 0) {
    voicesCache = v
  }
  return voicesCache
}

if (typeof window !== 'undefined' && canSpeak()) {
  initVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    initVoices()
  }
}

export function getVoices() {
  if (voicesCache.length > 0) return voicesCache
  return initVoices()
}

// -------------------------------------------------------------
// Playback Control & Overlap Prevention
// -------------------------------------------------------------
export function stop() {
  try {
    if (current) {
      current.onended = null
      current.onerror = null
      current.pause()
      current.currentTime = 0
      current = null
    }
  } catch {}

  try {
    if (canSpeak()) {
      window.speechSynthesis.cancel()
    }
  } catch {}

  activeUtterance = null
  emitAudioState(false)
}

export function isAudioPlaying() {
  return (current && !current.paused) || (canSpeak() && (window.speechSynthesis?.speaking ?? false))
}

function playUrl(url) {
  return new Promise((resolve, reject) => {
    stop()
    const a = new Audio(url)
    current = a

    const cleanup = () => {
      a.onended = null
      a.onerror = null
      if (current === a) current = null
    }

    a.onended = () => {
      cleanup()
      emitAudioState(false)
      resolve(true)
    }

    a.onerror = (err) => {
      cleanup()
      emitAudioState(false)
      reject(err || new Error('audio playback error'))
    }

    // Modern browsers require a user interaction token for audio play
    a.play()
      .then(() => {
        emitAudioState(true)
      })
      .catch((err) => {
        cleanup()
        emitAudioState(false)
        reject(err)
      })
  })
}

// -------------------------------------------------------------
// Urdu Script & Transliteration Engine
// Used when the host OS does not have a native Urdu TTS voice installed
// -------------------------------------------------------------
function isUrduScript(str) {
  if (!str) return false
  // Check for Arabic / Perso-Arabic unicode ranges: \u0600-\u06FF, \u0750-\u077F, \uFB50-\uFDFF, \uFE70-\uFEFF
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str)
}

const URDU_PHRASE_DICTIONARY = [
  ['خوش آمدید', 'Khush aamdeed'],
  ['میں آپ کی مدد کروں گا', 'Main aap ki madad karoon ga'],
  ['بٹن دبا کر بولیں', 'Button daba kar bolein'],
  ['انٹرنیٹ نہیں ہے', 'Internet nahi hai'],
  ['محفوظ ہو گیا ہے', 'Mehfooz ho gaya hai'],
  ['محفوظ ہو گئی', 'Mehfooz ho gayi'],
  ['محفوظ ہے', 'Mehfooz hai'],
  ['نیٹ آنے پر خود بھیج دیا جائے گا', 'Net aane par khud bhej diya jaye ga'],
  ['ہمیں پوری تسلی نہیں', 'Humein poori tasalli nahi'],
  ['ایک انسان آپ کا کیس دیکھے گا', 'Aik insaan aap ka case dekhe ga'],
  ['آپ کو دوبارہ کچھ بتانا نہیں پڑے گا', 'Aap ko dobara kuch batana nahi pare ga'],
  ['مبارک ہو', 'Mubarak ho'],
  ['آپ کی درخواست منظور ہو گئی', 'Aap ki darkhwast manzoor ho gayi'],
  ['منظور ہو گئی', 'Manzoor ho gayi'],
  ['منظور شدہ', 'Manzoor shuda'],
  ['ہمیں ایک اور چیز چاہیے', 'Humein aik aur cheez chahiye'],
  ['اسکرین پر دیکھیں', 'Screen par dekhein'],
  ['اپنا نام بولیں', 'Apna naam bolein'],
  ['اپنا شناختی کارڈ نمبر بولیں', 'Apna shanakhti card number bolein'],
  ['نمبر لکھیں', 'Number likhein'],
  ['آپ کی مہینے کی کمائی کتنی ہے', 'Aap ki maheene ki kamai kitni hai'],
  ['آپ کے گھر میں کتنے لوگ رہتے ہیں', 'Aap ke ghar mein kitne log rehte hain'],
  ['اب اپنے شناختی کارڈ کی تصویر لیں', 'Ab apne shanakhti card ki tasweer lein'],
  ['کارڈ سیدھا رکھیں', 'Card seedha rakhein'],
  ['تصویر دھندلی ہے', 'Tasweer dhundli hai'],
  ['براہ کرم دوبارہ لیں', 'Barah-e-karam dobara lein'],
  ['آپ کی درخواست بھیج دی گئی ہے', 'Aap ki darkhwast bhej di gayi hai'],
  ['ایک لمحہ انتظار کریں', 'Aik lamha intezar karein'],
  ['خبردار', 'Khabardaar'],
  ['یہ پیغام دھوکا لگتا ہے', 'Yeh paighaam dhoka lagta hai'],
  ['یہ پیغام دھوکہ دہی لگتا ہے', 'Yeh paighaam fraud lagta hai'],
  ['جواب نہ دیں', 'Jawab na dein'],
  ['پیسے نہ بھیجیں', 'Paise na bhejein'],
  ['یہ پیغام عام لگتا ہے', 'Yeh paighaam aam lagta hai'],
  ['اپنا پن کسی کو نہ بتائیں', 'Apna PIN kisi ko na batein'],
  ['دوسرے خاندان کا صفحہ کھل گیا ہے', 'Doosre khandaan ka safha khul gaya hai'],
  ['پچھلا خاندان بند ہو گیا', 'Pichla khandaan band ho gaya'],
  ['حفاظت کے لیے اسکرین بند ہو رہی ہے', 'Hifazat ke liye screen band ho rahi hai'],
  ['امداد کی نئی درخواست کے لیے بڑے سبز بٹن کو دبائیں', 'Imdad ki nayi darkhwast ke liye baray sabz button ko dabayein'],
  ['اگر آپ کی درخواست پہلے سے جمع ہے تو نیچے اس کی جانچ دیکھیں', 'Apni jama shuda darkhwast dekhne ke liye neechay status check karein'],
  ['کسی بھی مشکوک ایس ایم ایس کو چیک کرنے کے لیے لال بٹن دبائیں', 'Mashkook message check karne ke liye laal button dabayein'],
  ['شناخت کی جانچ کی اجازت', 'Shanakht ki jaanch ki ijazat'],
  ['رقم بھیجنے کی اجازت', 'Raqam bhejne ki ijazat'],
  ['اجازت واپس لے لی گئی', 'Ijazat wapas le li gayi'],
  ['انٹرنیٹ واپس آ گیا', 'Internet wapas aa gaya'],
  ['درخواست موصول', 'Darkhwast mosool'],
  ['انسانی افسر کا جائزہ', 'Insani officer ka jaiza'],
  ['قطار میں ہے', 'Qataar mein hai'],
  ['شکریہ', 'Shukriya'],
  ['ہاں', 'Haan'],
  ['نہیں', 'Nahi'],
  ['ٹھیک ہے', 'Theek hai'],
  ['معذرت', 'Maazrat'],
  ['امداد', 'Imdad'],
  ['درخواست', 'Darkhwast'],
  ['شناختی کارڈ', 'Shanakhti card'],
  ['شناخت', 'Shanakht'],
  ['افسر', 'Officer'],
  ['معلومات', 'Maloomat'],
  ['دوبارہ کوشش کریں', 'Dobara koshish karein']
]

const URDU_CHAR_MAP = {
  'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
  'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
  'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
  'ہ': 'h', 'ۂ': 'h', 'ۃ': 't', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'e',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '۔': '.', '،': ',', '؟': '?'
}

export function transliterateUrduToRoman(text) {
  if (!text) return ''
  let res = text

  // 1. Replace known phrases first
  for (const [urdu, roman] of URDU_PHRASE_DICTIONARY) {
    if (res.includes(urdu)) {
      res = res.split(urdu).join(roman)
    }
  }

  // 2. Character-level replacement for any remaining Urdu characters
  let out = ''
  for (let i = 0; i < res.length; i++) {
    const ch = res[i]
    if (ch in URDU_CHAR_MAP) {
      out += URDU_CHAR_MAP[ch]
    } else {
      out += ch
    }
  }

  // Clean up repeated whitespace
  return out.replace(/\s+/g, ' ').trim()
}

// -------------------------------------------------------------
// Voice Matching & Engine Selection
// -------------------------------------------------------------
function selectVoiceForLang(lang, voices) {
  if (!voices || voices.length === 0) return null
  const l = (lang || '').toLowerCase()

  if (l === 'ur' || l.startsWith('ur')) {
    // 1. Check for native Urdu voice (e.g. ur-PK, ur-IN, ur)
    const urdu = voices.find((v) => v.lang.toLowerCase().startsWith('ur'))
    if (urdu) {
      return { voice: urdu, lang: urdu.lang, isNativeUrdu: true }
    }
    // 2. Subcontinental voices that handle Hindustani phonetics accurately
    const hi = voices.find((v) => v.lang.toLowerCase().startsWith('hi'))
    if (hi) {
      return { voice: hi, lang: hi.lang, isNativeUrdu: false }
    }
    const enIn = voices.find((v) => {
      const code = v.lang.toLowerCase()
      const name = (v.name || '').toLowerCase()
      return code.startsWith('en-in') || code.startsWith('en-pk') || name.includes('india') || name.includes('pakistan')
    })
    if (enIn) {
      return { voice: enIn, lang: enIn.lang, isNativeUrdu: false }
    }
    // 3. Fallback to any English or system default
    const en = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0]
    return { voice: en, lang: en.lang || 'en-US', isNativeUrdu: false }
  }

  if (l === 'roman') {
    // Roman Urdu: Latin alphabet with Urdu vocabulary. Subcontinental voices sound natural
    const enIn = voices.find((v) => {
      const code = v.lang.toLowerCase()
      const name = (v.name || '').toLowerCase()
      return code.startsWith('en-in') || code.startsWith('en-pk') || name.includes('india') || name.includes('pakistan')
    })
    if (enIn) {
      return { voice: enIn, lang: enIn.lang, isNativeUrdu: false }
    }
    const hi = voices.find((v) => v.lang.toLowerCase().startsWith('hi'))
    if (hi) {
      return { voice: hi, lang: hi.lang, isNativeUrdu: false }
    }
    const en = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0]
    return { voice: en, lang: en.lang || 'en-US', isNativeUrdu: false }
  }

  // English
  const en = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0]
  return { voice: en, lang: en?.lang || 'en-US', isNativeUrdu: false }
}

// -------------------------------------------------------------
// Browser Speech Synthesis Fallback
// -------------------------------------------------------------
export function browserSpeak(text, lang = 'ur') {
  return new Promise((resolve) => {
    if (!text || !canSpeak()) {
      emitAudioState(false)
      return resolve(false)
    }

    try {
      // 1. Clear previous playback cleanly
      stop()

      // 2. Resolve target voice and phonetics
      const voices = getVoices()
      const matched = selectVoiceForLang(lang, voices)

      let textToSpeak = text
      // If Urdu is requested but no native Urdu TTS voice is installed on this device,
      // transliterate to Roman Urdu so the voice speaks the Urdu words aloud instead of failing
      if (lang === 'ur' && matched && !matched.isNativeUrdu && isUrduScript(text)) {
        textToSpeak = transliterateUrduToRoman(text)
      }

      const u = new SpeechSynthesisUtterance(textToSpeak)
      activeUtterance = u // Keep reference in module scope to prevent Chromium GC

      if (matched?.voice) {
        u.voice = matched.voice
        u.lang = matched.lang
      } else {
        u.lang = lang === 'en' ? 'en-US' : (lang === 'roman' ? 'en-US' : 'ur-PK')
      }

      u.rate = 0.9 // Moderate pacing for clear comprehension
      u.pitch = 1.0

      let keepAlive = null
      const cleanup = () => {
        if (keepAlive) {
          clearInterval(keepAlive)
          keepAlive = null
        }
        if (activeUtterance === u) {
          activeUtterance = null
        }
      }

      u.onstart = () => {
        emitAudioState(true)
        // Chrome bug: SpeechSynthesis randomly pauses after ~10-15 seconds of speech
        keepAlive = setInterval(() => {
          if (canSpeak() && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause()
            window.speechSynthesis.resume()
          } else {
            cleanup()
          }
        }, 8000)
      }

      u.onend = () => {
        cleanup()
        emitAudioState(false)
        resolve(true)
      }

      u.onerror = (e) => {
        cleanup()
        emitAudioState(false)
        // Canceled/interrupted occurs normally when user taps another button
        if (e.error === 'interrupted' || e.error === 'canceled') {
          resolve(true)
        } else {
          resolve(false)
        }
      }

      // Small 40ms tick after cancel() to avoid Blink cancel/speak collision race condition
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(u)
        } catch {
          cleanup()
          emitAudioState(false)
          resolve(false)
        }
      }, 40)
    } catch {
      activeUtterance = null
      emitAudioState(false)
      resolve(false)
    }
  })
}

// -------------------------------------------------------------
// Universal Speak Function (Dynamic Content)
// -------------------------------------------------------------
export async function speak(text, lang = 'ur') {
  if (!text) return false
  lastSpokenText = text
  lastSpokenLang = lang
  lastPromptId = null
  stop()

  const normalizedLang = lang === 'roman' ? 'roman' : lang === 'en' ? 'en' : 'ur'

  // 1. If text matches one of our 21 pre-rendered studio prompts and lang is Urdu,
  // play the authentic studio MP3 directly for highest quality
  if (normalizedLang === 'ur') {
    const cleanText = text.trim()
    const match = PRE_RENDERED_PROMPTS.find(
      (p) => p.ur.trim() === cleanText || cleanText.includes(p.ur.trim()) || p.ur.trim().includes(cleanText)
    )
    if (match) {
      try {
        await playUrl(`/audio/${match.id}.mp3`)
        return true
      } catch {
        // Fall through to TTS / browser speech
      }
    }
  }

  // 2. If online and backend Uplift AI TTS is configured, query the server
  if (normalizedLang === 'ur' && navigator.onLine && getToken() && (await serverVoice())) {
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
      // Fall through to browser speech synthesis
    }
  }

  // 3. Fallback to Web Speech Synthesis
  return browserSpeak(text, normalizedLang)
}

// -------------------------------------------------------------
// Fixed Prompts: Studio MP3 clips -> fallback
// -------------------------------------------------------------
export function playPrompt(id, fallbackText, lang = 'ur') {
  lastPromptId = id
  lastSpokenText = fallbackText
  lastSpokenLang = lang
  stop()

  const prompt = PRE_RENDERED_PROMPTS.find((p) => p.id === id)
  const normalizedLang = lang === 'roman' ? 'roman' : lang === 'en' ? 'en' : 'ur'

  return new Promise((resolve) => {
    if (normalizedLang === 'ur') {
      // Studio-recorded authentic Urdu MP3 clip
      playUrl(`/audio/${id}.mp3`)
        .then(() => resolve(true))
        .catch(() => {
          speak(fallbackText || prompt?.ur || '', 'ur').then(resolve)
        })
      return
    }

    if (normalizedLang === 'roman') {
      const textToSpeak = fallbackText || prompt?.roman || prompt?.en || ''
      speak(textToSpeak, 'roman').then(resolve)
      return
    }

    // English
    const textToSpeak = fallbackText || prompt?.en || ''
    speak(textToSpeak, 'en').then(resolve)
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

// -------------------------------------------------------------
// Speech-to-Text Input (STT)
// -------------------------------------------------------------
export const canListen = () =>
  !!navigator.mediaDevices?.getUserMedia || !!(window.SpeechRecognition || window.webkitSpeechRecognition)

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
// PRE-RENDERED URDU VOICE CLIPS MANIFEST (21 Static MP3s)
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
    id: 'back_online',
    ur: 'انٹرنیٹ واپس آ گیا۔ آپ کا محفوظ کام بھیج دیا گیا۔',
    roman: 'Internet wapas aa gaya. Aap ka mehfooz kaam bhej diya gaya.',
    en: 'Back online. Your saved work was sent.',
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
    id: 'declined_appeal',
    ur: 'ابھی منظور نہیں ہو سکا۔ آپ کسی انسان سے دوبارہ جانچ کروا سکتے ہیں۔',
    roman: 'Abhi manzoor nahi ho saka. Aap kisi insaan se dobara jaanch karwa sakte hain.',
    en: 'Not approved right now. You can ask a person to check again.',
    category: 'decision'
  },
  {
    id: 'submitted',
    ur: 'آپ کی درخواست بھیج دی گئی ہے۔ ایک لمحہ انتظار کریں۔',
    roman: 'Aap ki darkhwast bhej di gayi hai. Aik lamha intezar karein.',
    en: 'Your request was sent. Please wait a moment.',
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
    id: 'say_household',
    ur: 'آپ کے گھر میں کتنے لوگ رہتے ہیں؟',
    roman: 'Aap ke ghar mein kitne log rehte hain?',
    en: 'How many people live in your home?',
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
    id: 'photo_blurry',
    ur: 'تصویر دھندلی ہے۔ براہ کرم دوبارہ لیں۔',
    roman: 'Tasweer dhundli hai. Barah-e-karam dobara lein.',
    en: 'The photo is blurry. Please take it again.',
    category: 'form'
  },
  {
    id: 'consent_identity',
    ur: 'کیا آپ شناخت کی جانچ کی اجازت دیتے ہیں؟ ہاں یا نہیں دبائیں۔',
    roman: 'Kya aap shanakht ki jaanch ki ijazat dete hain? Haan ya nahi dabayein.',
    en: 'Do you allow an identity check? Press yes or no.',
    category: 'consent'
  },
  {
    id: 'consent_payment',
    ur: 'کیا آپ رقم بھیجنے کی اجازت دیتے ہیں؟',
    roman: 'Kya aap raqam bhejne ki ijazat dete hain?',
    en: 'Do you allow us to send the payment?',
    category: 'consent'
  },
  {
    id: 'consent_withdrawn',
    ur: 'آپ کی اجازت واپس لے لی گئی ہے۔ اب کوئی آپ کا ڈیٹا نہیں دیکھ سکتا۔',
    roman: 'Aap ki ijazat wapas le li gayi hai. Ab koi aap ka data nahi dekh sakta.',
    en: 'Your permission was withdrawn. No one can see your data now.',
    category: 'consent'
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
  },
  {
    id: 'lock_warning',
    ur: 'حفاظت کے لیے اسکرین بند ہو رہی ہے۔',
    roman: 'Hifazat ke liye screen band ho rahi hai.',
    en: 'For safety, the screen is locking.',
    category: 'helper'
  }
]
