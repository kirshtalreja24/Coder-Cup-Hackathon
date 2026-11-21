// Voice: pre-rendered Urdu prompt clips (cached offline by the service worker) -> browser TTS fallback.
// Input: browser speech recognition (ur-PK). Every voice action has a tap/typing fallback, so nothing depends on it.

const clipCache = {}
export function playPrompt(id, fallbackText, lang = 'ur') {
  stop()
  return new Promise((resolve) => {
    const a = new Audio(`/audio/${id}.mp3`)
    clipCache.current = a
    a.onended = () => resolve(true)
    a.onerror = () => { speak(fallbackText, lang).then(resolve) }
    a.play().catch(() => { speak(fallbackText, lang).then(resolve) })
  })
}

export function speak(text, lang = 'ur') {
  return new Promise((resolve) => {
    if (!text || !('speechSynthesis' in window)) return resolve(false)
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const want = lang === 'ur' ? 'ur' : 'en'
      u.lang = want === 'ur' ? 'ur-PK' : 'en-US'
      const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(want))
      if (v) u.voice = v
      u.rate = 0.9
      u.onend = () => resolve(true); u.onerror = () => resolve(false)
      window.speechSynthesis.speak(u)
    } catch { resolve(false) }
  })
}

export function stop() {
  try { clipCache.current?.pause() } catch {}
  try { window.speechSynthesis?.cancel() } catch {}
}

export const canListen = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)

const URDU_DIGITS = { '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9, '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 }
const WORDS = { 'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8, 'نو': 9, 'دس': 10, 'ہزار': 1000, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'thousand': 1000 }
export function spokenNumber(text) {
  if (!text) return ''
  let s = [...text].map((c) => (c in URDU_DIGITS ? URDU_DIGITS[c] : c)).join('')
  const digits = s.replace(/[^0-9]/g, '')
  if (digits) return digits
  let total = 0, cur = 0
  for (const w of s.toLowerCase().split(/\s+/)) {
    const n = WORDS[w]; if (n === undefined) continue
    if (n === 1000) { total += (cur || 1) * 1000; cur = 0 } else cur += n
  }
  return String(total + cur || '')
}

export function listen({ lang = 'ur-PK', onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { onError?.('not_supported'); return () => {} }
  const r = new SR(); r.lang = lang; r.interimResults = false; r.maxAlternatives = 1
  r.onresult = (e) => onResult?.(e.results[0][0].transcript)
  r.onerror = (e) => onError?.(e.error)
  r.onend = () => onEnd?.()
  try { r.start() } catch { onError?.('start_failed') }
  return () => { try { r.stop() } catch {} }
}
