import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, apiPost, BASE } from '../api'
import { useLang } from '../i18n'
import { clearDraft, flush, loadDraft, queueClaim, saveDraft, shrinkImage } from '../offline'
import { playPrompt, speak, stop } from '../voice'
import { ErrorBox, ROUTE_UI } from '../ui'
import Mic from '../components/Mic'
import Recourse from '../components/Recourse'
import Receipt from '../components/Receipt'

const DISTRICTS = ['Karachi East', 'Karachi West', 'Karachi Central', 'Hyderabad', 'Sukkur', 'Larkana', 'Lahore', 'Multan', 'Faisalabad', 'Rawalpindi', 'Peshawar', 'Mardan', 'Quetta', 'Turbat', 'Islamabad']
const STEPS = ['name', 'cnic', 'father', 'status', 'income', 'household', 'district', 'photo', 'consent']
const PROMPT = { name: 'say_name', cnic: 'say_cnic', income: 'say_income', household: 'say_household', photo: 'take_photo', consent: 'consent_identity' }
const EMPTY = { name: '', father_name: '', cnic: '', marital_status: '', monthly_income: '', household_size: 4, district: 'Karachi East', dob: '' }
function fmtCnic(d) { d = d.replace(/\D/g, '').slice(0, 13); return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join('-') }

function NumPad({ value, onChange, max = 13 }) {
  const press = (k) => { if (k === '⌫') onChange(value.slice(0, -1)); else if (value.length < max) onChange(value + k) }
  return <div className="numpad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> : <button type="button" key={k} onClick={() => press(k)}>{k}</button>)}</div>
}

export default function ClaimFlow({ helper }) {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const family = helper ? JSON.parse(sessionStorage.getItem('bh_family') || 'null') : null
  const [step, setStep] = useState(0)
  const [d, setD] = useState(() => { const s = loadDraft(); return s && s.forFamily === (family?.id || null) ? s.d : EMPTY })
  const [photo, setPhoto] = useState(() => loadDraft()?.photo || null)
  const [consent, setConsent] = useState({ identity: false, documents: false, payment: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null)
  const [queued, setQueued] = useState(false)
  const [demos, setDemos] = useState(null)
  const fileRef = useRef()
  const key = STEPS[step]
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }))
  const L = lang === 'ur' ? 'ur' : 'en'

  useEffect(() => { saveDraft({ d, photo, forFamily: family?.id || null }) }, [d, photo])   // progress is saved at every step
  useEffect(() => { if (!result && PROMPT[key]) playPrompt(PROMPT[key], t(key === 'cnic' ? 'cnic' : key), L) ; return stop }, [step]) // eslint-disable-line

  const canNext = { name: d.name.trim().length > 1, cnic: d.cnic.replace(/\D/g, '').length === 13, father: true, status: !!d.marital_status, income: d.monthly_income !== '', household: true, district: true, photo: true, consent: helper || consent.identity }[key]

  const loadDemo = async () => {
    if (!demos) { try { setDemos((await api('/demo/scenarios', { auth: false })).scenarios) } catch (e) { setErr(e) } }
  }
  const applyDemo = async (s) => {
    const f = s.form
    setD({ ...EMPTY, ...f, cnic: String(f.cnic || ''), monthly_income: String(f.monthly_income ?? ''), household_size: Number(f.household_size) || 4 })
    setPhoto(null)
    if (s.sample_card_url) {
      try { const b = await (await fetch(BASE + s.sample_card_url)).blob(); const r = new FileReader(); r.onload = () => setPhoto(r.result); r.readAsDataURL(b) } catch {}
    }
    setStep(STEPS.length - 1)
  }

  const onPhoto = async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await shrinkImage(f)) }

  const payload = () => ({ ...d, monthly_income: d.monthly_income === '' ? null : Number(d.monthly_income), cnic: d.cnic, household_size: Number(d.household_size), gender: undefined })

  const submit = async () => {
    setBusy(true); setErr(null)
    const body = payload()
    // A helper never sends consent flags: only the family's own one-time code can grant consent (the server ignores flags from helpers anyway)
    const flags = helper ? {} : { identity: consent.identity, documents: consent.documents, case_history: consent.documents, payment: consent.payment }
    try {
      if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline: true })
      const created = await apiPost('/cases', { data: body, citizen_id: family?.id }, { headers: { 'Idempotency-Key': 'c-' + Date.now() } })
      if (photo) {
        const blob = await (await fetch(photo)).blob(); const fd = new FormData(); fd.append('file', blob, 'id.jpg')
        await api(`/cases/${created.id}/documents`, { method: 'POST', formData: fd, timeout: 40000 })
      }
      const r = await apiPost(`/cases/${created.id}/submit`, { consent: flags }, { timeout: 40000 })
      setResult({ ...r, caseId: created.id }); clearDraft()
      const ui = ROUTE_UI[r.route] || ROUTE_UI.HUMAN_REVIEW
      playPrompt(ui[2], r.reason_user?.[L], L)
    } catch (e) {
      if (e.offline) { queueClaim({ data: body, consent: flags, photo, citizen_id: family?.id }); clearDraft(); setQueued(true); playPrompt('offline_saved', t('saved_offline'), L) }
      else setErr(e)
    } finally { setBusy(false) }
  }

  const retake = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true)
    try {
      const small = await shrinkImage(f); const blob = await (await fetch(small)).blob(); const fd = new FormData(); fd.append('file', blob, 'id.jpg')
      const up = await api(`/cases/${result.caseId}/documents`, { method: 'POST', formData: fd, timeout: 40000 })
      const r = await apiPost(`/cases/${result.caseId}/submit`, {}, { timeout: 40000 })
      setResult({ ...r, caseId: result.caseId, note: up.message?.[L] }); const ui = ROUTE_UI[r.route] || ROUTE_UI.HUMAN_REVIEW; playPrompt(ui[2], r.reason_user?.[L], L)
    } catch (x) { setErr(x) } finally { setBusy(false) }
  }

  if (queued) return (
    <div className="col"><div className="result wait"><div className="ico">📴</div><h2>{t('saved_offline')}</h2><button onClick={() => { flush(); nav(helper ? '/h' : '/c') }}>OK</button></div></div>
  )

  if (result) {
    const ui = ROUTE_UI[result.route] || ROUTE_UI.HUMAN_REVIEW
    const reason = result.reason_user?.[lang === 'roman' ? 'roman' : lang === 'ur' ? 'ur' : 'en']
    return (
      <div className="col narrow">
        <div className={'result ' + ui[0]} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
          <div className="ico">{ui[1]}</div>
          <h2 style={{ fontSize: '1.4rem' }}>{reason}</h2>
          {result.payment && <p>💸 PKR {result.payment.amount.toLocaleString()} · <b>{result.payment.reference}</b> <span className="mock-tag">MOCK PAYMENT</span></p>}
          <button className="ghost" onClick={() => speak(reason, L)}>🔊</button>
        </div>
        {result.route === 'ASK_PROOF' && <label className="btn" style={{ textAlign: 'center' }}>📷 {t('takephoto')}<input type="file" accept="image/*" capture="environment" hidden onChange={retake} /></label>}
        {result.route === 'DECLINE_WITH_APPEAL' && <button className="warn" onClick={async () => { await apiPost(`/cases/${result.caseId}/appeal?note=please re-check`); nav(helper ? '/h' : '/c/cases') }}>🙋 {t('appeal')}</button>}
        <Recourse items={result.reason_user?.recourse} />
        {result.decision_id && <Receipt caseId={result.caseId} />}
        {helper && result.route === 'NEEDS_CONSENT' && <div className="banner offline">Ask the family for their one-time code on the family page, then submit again.</div>}
        <ErrorBox e={err} />
        <details className="card"><summary>🔎 {t('why')} · what the system did, step by step</summary>
          <ul className="step-list" dir="ltr">{result.steps?.map((s, i) => <li key={i} className={s.outcome === 'denied' ? 'denied' : ''}><b>{s.tool}</b><br />{s.summary}</li>)}</ul></details>
        <div className="row"><Link className="btn" to={helper ? '/h' : '/c/cases/' + result.caseId}>{helper ? 'Back to families' : t('mycases')}</Link><Link className="btn ghost" to={helper ? '/h' : '/c'}>🏠</Link></div>
      </div>
    )
  }

  return (
    <div className="col narrow">
      {family && <div className="banner info">👨‍👩‍👧 Helping: <b>{family.name}</b></div>}
      <div className="row spread"><h2 style={{ margin: 0 }}>📝 {t('claim')}</h2>
        <button className="ghost small" onClick={loadDemo} title="For judges: loads a scenario">🎬 demo</button></div>
      {demos && <div className="card col">{Object.entries(demos).length ? demos.map((s) => <button key={s.key} className="ghost small" style={{ textAlign: 'left', fontWeight: 400 }} onClick={() => applyDemo(s)}>▶ {s.title}</button>) : null}</div>}
      <div className="stepper">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>

      <div className="card col" dir={lang === 'ur' ? 'rtl' : 'ltr'} style={{ minHeight: 280 }}>
        <div className="row spread"><h2 style={{ margin: 0 }}>{key === 'status' ? t('status') : key === 'consent' ? t('consent_title') : t(key === 'photo' ? 'photo' : key)}</h2>
          <button type="button" className="ghost small" onClick={() => playPrompt(PROMPT[key] || 'welcome', t(key), L)}>🔊</button></div>

        {key === 'name' && <><input value={d.name} onChange={(e) => set('name', e.target.value)} dir="auto" placeholder="Fatima Bibi / فاطمہ بی بی" autoFocus /><div className="row" style={{ justifyContent: 'center' }}><Mic onText={(x) => set('name', x)} /></div></>}
        {key === 'cnic' && <><div className="kpi mono" style={{ textAlign: 'center', letterSpacing: 2 }} dir="ltr">{fmtCnic(d.cnic) || '_____-_______-_'}</div><NumPad value={d.cnic.replace(/\D/g, '')} onChange={(v) => set('cnic', v)} max={13} /><div className="row" style={{ justifyContent: 'center' }}><Mic numeric onText={(x) => set('cnic', x.slice(0, 13))} /></div></>}
        {key === 'father' && <><input value={d.father_name} onChange={(e) => set('father_name', e.target.value)} dir="auto" /><div className="row" style={{ justifyContent: 'center' }}><Mic onText={(x) => set('father_name', x)} /></div><p className="hint">{t('skip')} OK · helps us be sure it is you</p></>}
        {key === 'status' && <div className="bigbtns">{[['widowed', '🖤', t('widow')], ['married', '💍', t('married')], ['single', '🙂', t('other')]].map(([v, i, l]) => <button type="button" key={v} className={'bigbtn ' + (d.marital_status === v ? 'sel' : '')} onClick={() => set('marital_status', v)}><span className="ico">{i}</span>{l}</button>)}</div>}
        {key === 'income' && <><div className="kpi" style={{ textAlign: 'center' }} dir="ltr">PKR {Number(d.monthly_income || 0).toLocaleString()}</div><NumPad value={String(d.monthly_income)} onChange={(v) => set('monthly_income', v)} max={7} /><div className="row" style={{ justifyContent: 'center' }}><Mic numeric onText={(x) => set('monthly_income', x.slice(0, 7))} /></div></>}
        {key === 'household' && <div className="row" style={{ justifyContent: 'center', gap: 22 }}><button type="button" className="mic" onClick={() => set('household_size', Math.max(1, d.household_size - 1))}>➖</button><div className="kpi" style={{ fontSize: '3.4rem' }}>{d.household_size}</div><button type="button" className="mic" onClick={() => set('household_size', Math.min(20, d.household_size + 1))}>➕</button><div className="small muted">👨‍👩‍👧‍👦</div></div>}
        {key === 'district' && <select value={d.district} onChange={(e) => set('district', e.target.value)}>{DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select>}
        {key === 'photo' && <>
          <div className="result" style={{ background: 'var(--sand)' }}>{photo ? <img src={photo} alt="ID" style={{ maxWidth: '100%', borderRadius: 12, maxHeight: 220 }} /> : <div className="ico">🪪</div>}</div>
          <label className="btn" style={{ textAlign: 'center' }}>📷 {t('takephoto')}<input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} /></label>
          <p className="hint">Flat, all four corners, QR code visible. Photos are shrunk to load on weak signal.</p></>}
        {key === 'consent' && helper && <div className="banner info">🔒 Consent for this family was given by the family itself with a one-time code (see the family page). Nothing is read without it.</div>}
        {key === 'consent' && !helper && <>
          <p className="muted small">You decide. You can take this back any time under "{t('mydata')}".</p>
          {[['identity', '🪪', t('c_identity'), true], ['documents', '📄', t('c_documents')], ['payment', '💸', t('c_payment')]].map(([k, ic, label, must]) => (
            <div className="toggle" key={k}><span className="ico">{ic}</span><span style={{ flex: 1 }}>{label}{must ? ' *' : ''}</span>
              <button type="button" className={'switch ' + (consent[k] ? 'on' : '')} aria-pressed={consent[k]} aria-label={label} onClick={() => setConsent((c) => ({ ...c, [k]: !c[k] }))} /></div>))}
          {!consent.identity && <p className="hint">* Without this we cannot check who you are, and we will not read anything.</p>}</>}
      </div>

      <ErrorBox e={err} />
      <div className="row spread">
        <button className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>⬅ {t('back')}</button>
        {step < STEPS.length - 1
          ? <button disabled={!canNext} onClick={() => setStep(step + 1)}>{key === 'photo' && !photo ? t('skip') : t('next')} ➡</button>
          : <button disabled={!canNext || busy} onClick={submit}>{busy ? '⏳' : '✅'} {t('send')}</button>}
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>💾 Saved automatically at every step</p>
    </div>
  )
}
