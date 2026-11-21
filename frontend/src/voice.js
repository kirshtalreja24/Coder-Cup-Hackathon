// Voice for people who cannot read.
//  OUTPUT: pre-rendered Urdu clips (cached offline by the service worker) -> Uplift AI TTS through OUR server -> browser speech.
//  INPUT : Uplift AI speech-to-text through OUR server (short WAV recording) -> browser speech recognition -> typing/buttons.
// Every step falls back to the next, so a missing key, a dead provider or no signal never blocks the citizen.
import { BASE, getToken } from './api'

let current = null // currently playing Audio
const blobCache = new Map()
let statusCache = null

async function serverVoice() {
  if (statusCache === null) {
    try { statusCache = (await (await fetch(BASE + '/voice/status')).json()).tts === true } catch { statusCache = false }
  }
  return statusCache
}

export function stop() {
  try { current?.pause() } catch {}
  try { window.speechSynthesis?.cancel() } catch {}
}

function playUrl(url) {
  return new Promise((resolve, reject) => {
    const a = new Audio(url); current = a
    a.onended = () => resolve(true); a.onerror = () => reject(new Error('audio'))
    a.play().catch(reject)
  })
}

export function browserSpeak(text, lang = 'ur') {
  return new Promise((resolve) => {
    if (!text || !('speechSynthesis' in window)) return resolve(false)
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const want = lang === 'ur' ? 'ur' : 'en'
      u.lang = want === 'ur' ? 'ur-PK' : 'en-US'
      const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(want))
      if (v) u.voice = v
      u.rate = 0.9; u.onend = () => resolve(true); u.onerror = () => resolve(false)
      window.speechSynthesis.speak(u)
    } catch { resolve(false) }
  })
}

// Dynamic text (decision reasons etc). Urdu text goes to Uplift via the server when possible.
export async function speak(text, lang = 'ur') {
  if (!text) return false
  stop()
  if (lang === 'ur' && navigator.onLine && getToken() && (await serverVoice())) {
    try {
      let url = blobCache.get(text)
      if (!url) {
        const r = await fetch(BASE + '/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }, body: JSON.stringify({ text: text.slice(0, 600) }) })
        if (!r.ok) throw new Error('tts ' + r.status)
        url = URL.createObjectURL(await r.blob()); blobCache.set(text, url)
      }
      await playUrl(url); return true
    } catch { /* fall through to the browser voice */ }
  }
  return browserSpeak(text, lang)
}

// Fixed prompts: pre-rendered clip (works offline) -> speak(text)
export function playPrompt(id, fallbackText, lang = 'ur') {
  stop()
  return new Promise((resolve) => {
    playUrl(`/audio/${id}.mp3`).then(() => resolve(true)).catch(() => { speak(fallbackText, lang).then(resolve) })
  })
}

// ---------------- speech input ----------------
export const canListen = () => !!(navigator.mediaDevices?.getUserMedia) || !!(window.SpeechRecognition || window.webkitSpeechRecognition)

const URDU_DIGITS = { '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9, '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 }
const WORDS = { 'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8, 'نو': 9, 'دس': 10, 'ہزار': 1000, 'سو': 100, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'thousand': 1000 }
export function spokenNumber(text) {
  if (!text) return ''
  const s = [...text].map((c) => (c in URDU_DIGITS ? URDU_DIGITS[c] : c)).join('')
  const digits = s.replace(/[^0-9]/g, '')
  if (digits) return digits
  let total = 0, cur = 0
  for (const w of s.toLowerCase().split(/\s+/)) {
    const n = WORDS[w]; if (n === undefined) continue
    if (n === 1000) { total += (cur || 1) * 1000; cur = 0 } else if (n === 100) { cur = (cur || 1) * 100 } else cur += n
  }
  return String(total + cur || '')
}

// Record mono 16 kHz WAV (works in every browser, small: ~32 KB/s) so we never depend on a codec the server may not accept.
async function recordWav(maxMs, onStop) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const rec = new MediaRecorder(stream); const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((resolve) => { rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); resolve(new Blob(chunks, { type: rec.mimeType })) } })
  rec.start()
  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs)
  onStop(() => { clearTimeout(timer); if (rec.state === 'recording') rec.stop() })
  const raw = await done
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const buf = await ctx.decodeAudioData(await raw.arrayBuffer()); ctx.close()
  const rate = 16000, len = Math.floor(buf.duration * rate)
  const off = new OfflineAudioContext(1, len, rate); const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start()
  const pcm = (await off.startRendering()).getChannelData(0)
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2)); const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true)
  pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return new Blob([out], { type: 'audio/wav' })
}

function browserListen({ lang, onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { onError?.('not_supported'); onEnd?.(); return () => {} }
  const r = new SR(); r.lang = lang; r.interimResults = false; r.maxAlternatives = 1
  r.onresult = (e) => onResult?.(e.results[0][0].transcript)
  r.onerror = (e) => onError?.(e.error); r.onend = () => onEnd?.()
  try { r.start() } catch { onError?.('start_failed'); onEnd?.() }
  return () => { try { r.stop() } catch {} }
}

// Returns a stop() function. Tap once to start, tap again (or wait ~8s) to finish.
export function listen({ lang = 'ur-PK', onResult, onError, onEnd }) {
  let stopRec = () => {}, stopped = false
  ;(async () => {
    if (lang.startsWith('ur') && navigator.onLine && getToken() && (await serverVoice()) && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
      try {
        const wav = await recordWav(8000, (s) => { stopRec = s })
        const fd = new FormData(); fd.append('file', wav, 'speech.wav')
        const r = await fetch(BASE + '/voice/stt', { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd })
        if (!r.ok) throw new Error('stt ' + r.status)
        const { text } = await r.json()
        if (text) { onResult?.(text); onEnd?.(); return }
        throw new Error('empty')
      } catch (e) {
        if (stopped) { onEnd?.(); return }
        stopRec = browserListen({ lang, onResult, onError, onEnd }) // fall back to the browser engine
        return
      }
    }
    stopRec = browserListen({ lang, onResult, onError, onEnd })
  })()
  return () => { stopped = false; stopRec() }
}
