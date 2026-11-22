import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { useLang } from '../i18n'

/**
 * Live camera capture. The `capture` attribute on <input type="file"> is ignored by
 * desktop browsers (and some mobile ones), so we use getUserMedia and fall back to the
 * native input only when a live camera is unavailable.
 *
 * const { openCamera, cameraUI } = useCameraCapture(file => ...)
 * <button onClick={openCamera}/> ... {cameraUI}
 */
export function useCameraCapture(onFile) {
  const { localize } = useLang()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fallbackRef = useRef(null)
  const onFileRef = useRef(onFile)
  onFileRef.current = onFile

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setOpen(false)
  }

  const openCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackRef.current?.click()
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      })
      setOpen(true)
    } catch {
      setError(
        localize(
          'کیمرہ دستیاب نہیں۔ براہ کرم اجازت دیں یا گیلری استعمال کریں۔',
          'Camera dastyab nahi. Ijazat dein ya gallery istemal karein.',
          'Camera permission denied or unavailable. Allow camera access or use the gallery.'
        )
      )
      fallbackRef.current?.click()
    }
  }

  useEffect(() => {
    if (open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play?.().catch(() => {})
    }
  }, [open])

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  const snap = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob(
      (blob) => {
        stop()
        if (blob) onFileRef.current(new File([blob], 'id-card.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9
    )
  }

  const cameraUI = (
    <>
      {error && (
        <span className="small" style={{ color: 'var(--danger, #b00020)' }}>
          {error}
        </span>
      )}
      <input
        ref={fallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFileRef.current(f)
        }}
      />
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 16
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12 }}
          />
          <div className="row" style={{ gap: 12 }}>
            <button type="button" onClick={snap} style={{ padding: '12px 24px' }}>
              <Camera size={18} />
              <span>{localize('تصویر کھینچیں', 'Tasveer khainchein', 'Capture')}</span>
            </button>
            <button type="button" className="btn secondary" onClick={stop} style={{ padding: '12px 24px' }}>
              <span>{localize('منسوخ', 'Radd karein', 'Cancel')}</span>
            </button>
          </div>
        </div>
      )}
    </>
  )

  return { openCamera, cameraUI }
}
