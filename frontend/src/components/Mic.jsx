import { useRef, useState } from 'react'
import { canListen, listen, spokenNumber, stop } from '../voice'

export const SPEECH_LANG = 'ur-PK'

// One microphone button for the whole app. Tap to start, tap again to stop (it also stops by itself after ~8 s).
// variant "big": the large round button of the citizen flow. variant "small": the compact button used in tools.
export default function Mic({ onText, numeric = false, variant = 'big', lang = SPEECH_LANG }) {
  const [rec, setRec] = useState(false)
  const stopRef = useRef(null)
  if (!canListen()) return variant === 'big' ? <span className="hint">🎤 not available on this browser - use the buttons</span> : null

  const click = () => {
    if (rec) { stopRef.current?.(); return }
    stop(); setRec(true)
    stopRef.current = listen({
      lang,
      onResult: (x) => onText(numeric ? spokenNumber(x) : x),
      onEnd: () => setRec(false),
      onError: () => setRec(false),
    })
  }
  if (variant === 'small') {
    return <button type="button" className={'small ' + (rec ? 'danger' : 'ghost')} onClick={click}>{rec ? '⏹ …' : '🎤'}</button>
  }
  return <button type="button" className={'mic ' + (rec ? 'rec' : '')} aria-label="speak" onClick={click}>{rec ? '⏹' : '🎤'}</button>
}
