import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiPost, getToken } from '../api'
import { useLang } from '../i18n'
import { canListen, listen, playPrompt, speak } from '../voice'
import { ErrorBox, MockTag } from '../ui'

const AREAS = ['Karachi East', 'Karachi West', 'Karachi Central', 'Korangi', 'Malir', 'Hyderabad', 'Sukkur', 'Larkana', 'Lahore', 'Peshawar', 'Quetta', 'Multan']
const COLORS = { SCAM: ['stop', '🚫'], SUSPICIOUS: ['wait', '⚠️'], LIKELY_REAL: ['good', '✅'], UNSURE: ['human', '🤔'] }

function Mic({ onText, lang = 'ur-PK' }) {
  const [rec, setRec] = useState(false)
  const stopRef = useRef(null)
  if (!canListen()) return null
  return <button type="button" className={'small ' + (rec ? 'danger' : 'ghost')} onClick={() => { if (rec) { stopRef.current?.(); return } setRec(true); stopRef.current = listen({ lang, onResult: onText, onEnd: () => setRec(false), onError: () => setRec(false) }) }}>{rec ? '⏹ …' : '🎤'}</button>
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
  useEffect(() => { api('/demo/scenarios', { auth: false }).then((d) => setSamples(d.scam_samples)).catch(() => {}) }, [])
  const check = async () => {
    setBusy(true); setErr(null); setRes(null)
    try {
      const r = await apiPost(pub || !getToken() ? '/public/scam-check' : '/scam/check', { text, sender: sender || null, area, report: true }, { auth: !pub })
      setRes(r)
      const a = r.advice?.[lang === 'ur' ? 'ur' : 'en']
      if (r.verdict === 'SCAM' || r.verdict === 'SUSPICIOUS') playPrompt('scam_alert', a, lang === 'ur' ? 'ur' : 'en')
      else if (r.verdict === 'LIKELY_REAL') playPrompt('scam_ok', a, lang === 'ur' ? 'ur' : 'en')
      else speak(a, lang === 'ur' ? 'ur' : 'en')
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  const [cls, ico] = COLORS[res?.verdict] || []
  return (
    <div className="col">
      {pub && <div className="row spread"><h2>🚨 Is this message real?</h2><Link to="/login">Log in</Link></div>}
      {!pub && <h2>🚨 {t('scam')}</h2>}
      <div className="card col">
        <div><label>{t('paste')}</label><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="BISP relief approved. Send CNIC and fee Rs 500 to ..." dir="auto" /></div>
        <div className="row"><div style={{ flex: 1, minWidth: 160 }}><label>{t('sender')}</label><input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="8171 / 0300-1234567" /></div>
          <div style={{ flex: 1, minWidth: 160 }}><label>{t('district')}</label><select value={area} onChange={(e) => setArea(e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div></div>
        <div className="row"><button disabled={busy || !text.trim()} onClick={check}>🔍 {t('check')}</button><Mic onText={(x) => setText((p) => p + ' ' + x)} /></div>
        {samples.length > 0 && <details><summary className="small muted">Try a sample message</summary><div className="col" style={{ marginTop: 8 }}>{samples.map((s, i) => <button key={i} className="ghost small" style={{ textAlign: 'left', fontWeight: 400 }} onClick={() => { setText(s.text); setSender(s.sender); setRes(null) }}>[{s.sender}] {s.text.slice(0, 90)}…</button>)}</div></details>}
      </div>
      <ErrorBox e={err} />
      {res && (
        <div className={'result ' + cls} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
          <div className="ico">{ico}</div>
          <h2>{res.verdict.replace('_', ' ')} <span className="small muted">({Math.round(res.score * 100)}%)</span></h2>
          <p style={{ fontSize: '1.15rem' }}>{res.advice[lang === 'ur' ? 'ur' : 'en']}</p>
          {res.handoff && <div className="banner info">🤝 Not sure → a person will check. We did not guess.</div>}
          <details style={{ textAlign: 'left' }} dir="ltr"><summary>Why? (full reasons)</summary>
            <ul>{res.reasons.map((r, i) => <li key={i}>{r.text} <span className="mono muted">({r.weight > 0 ? '+' : ''}{r.weight})</span></li>)}</ul>
            <p className="small muted">Rules {res.rule_score} · ML model {res.ml_score} · type: {res.scam_type || '-'} · helpline {res.helpline}</p></details>
        </div>
      )}
    </div>
  )
}

export function AskPage() {
  const { t, lang } = useLang()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const suggestions = ['Who can apply for the relief payment?', 'Is there a fee to apply?', 'How do I know a message is real?', 'How do I take back my data?', 'How do I apply for a passport?']
  const ask = async (qq = q) => {
    setBusy(true); setErr(null)
    try { const r = await apiPost('/ask', { question: qq, lang: lang === 'ur' ? 'ur' : 'en' }); setRes(r); speak(r.answered ? r.answer : (lang === 'ur' ? r.answer_ur : r.answer), lang === 'ur' ? 'ur' : 'en') } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  return (
    <div className="col">
      <h2>❓ {t('ask')}</h2>
      <div className="card col">
        <div className="row"><input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Is there a fee to apply?" onKeyDown={(e) => e.key === 'Enter' && ask()} dir="auto" /><Mic onText={setQ} /><button disabled={busy || q.length < 2} onClick={() => ask()}>{t('check')}</button></div>
        <div className="row">{suggestions.map((s) => <button key={s} className="ghost small" onClick={() => { setQ(s); ask(s) }}>{s}</button>)}</div>
      </div>
      <ErrorBox e={err} />
      {res && (
        <div className={'card col'} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
          {res.answered ? <><p style={{ fontSize: '1.1rem' }}>{res.answer}</p><span className="badge">{res.mode} · confidence {res.confidence}</span>
            <details open dir="ltr"><summary>📚 Sources (official documents · MOCK)</summary>{res.sources.map((s) => <div key={s.n} className="card flat" style={{ margin: '6px 0' }}><b>[{s.n}] {s.source}</b> · {s.section} <span className="muted small">score {s.score}</span><p className="small">{s.text}</p></div>)}</details></>
            : <><div className="banner info">🤝 {lang === 'ur' ? res.answer_ur : res.answer}</div><p className="small muted" dir="ltr">Reason: {res.reason}. The system abstains instead of guessing.</p></>}
        </div>
      )}
    </div>
  )
}
