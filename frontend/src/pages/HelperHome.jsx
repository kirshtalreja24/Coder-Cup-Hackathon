import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiPost, when } from '../api'
import { playPrompt } from '../voice'
import { ErrorBox, Spinner, StatusBadge, Tabs, useAsync } from '../ui'
import MyData from './MyData'

const LOCK_S = 60

export default function HelperHome() {
  const nav = useNavigate()
  const fam = useAsync(() => apiGet('/helper/families'), [])
  const [active, setActive] = useState(() => JSON.parse(sessionStorage.getItem('bh_family') || 'null'))
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('cases')
  const [err, setErr] = useState(null)
  const [mock, setMock] = useState(null)
  const [code, setCode] = useState('')
  const [info, setInfo] = useState('')
  const [left, setLeft] = useState(LOCK_S)
  const [locked, setLocked] = useState(false)
  const cases = useAsync(() => (active ? apiGet('/cases?limit=100').then((l) => l.filter((c) => c.citizen_id === active.id)) : []), [active?.id])
  const last = useRef(Date.now())

  // auto-lock after 60s of no activity: a shared phone must never stay open on one family
  useEffect(() => {
    const bump = () => { last.current = Date.now(); setLeft(LOCK_S) }
    ['click', 'keydown', 'touchstart', 'mousemove'].forEach((e) => window.addEventListener(e, bump))
    const id = setInterval(() => {
      if (!active) return
      const s = LOCK_S - Math.floor((Date.now() - last.current) / 1000)
      setLeft(Math.max(0, s))
      if (s <= 0) { setLocked(true); sessionStorage.removeItem('bh_family'); setActive(null); playPrompt('lock_warning', 'For safety, the screen is locking.', 'en') }
    }, 1000)
    return () => { ['click', 'keydown', 'touchstart', 'mousemove'].forEach((e) => window.removeEventListener(e, bump)); clearInterval(id) }
  }, [active])

  const sw = async (f) => {
    setErr(null); setMock(null); setInfo('')
    try {
      const r = await apiPost('/helper/switch/' + f.citizen_id)
      const a = { id: f.citizen_id, name: f.name, consent: r.consent_active }
      sessionStorage.setItem('bh_family', JSON.stringify(a)); setActive(a); setLocked(false); setTab('cases'); last.current = Date.now()
      playPrompt('helper_switch', 'Switched to another family. The previous family is now locked.', 'en')
    } catch (e) { setErr(e) }
  }
  const lock = () => { sessionStorage.removeItem('bh_family'); setActive(null) }
  const reqCode = async () => { try { setMock(await apiPost(`/helper/families/${active.id}/consent/request`)) } catch (e) { setErr(e) } }
  const confirm = async () => {
    try { await apiPost(`/helper/families/${active.id}/consent/confirm`, { code }); const a = { ...active, consent: true }; sessionStorage.setItem('bh_family', JSON.stringify(a)); setActive(a); setInfo('✔ Consent recorded for this family only.'); setMock(null); setCode(''); fam.reload() }
    catch (e) { setErr(e) }
  }
  const list = fam.data?.families.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) || []

  return (
    <div className="col">
      {locked && <div className="lock"><div><div style={{ fontSize: '4rem' }}>🔒</div><h2>Locked for safety</h2><p>No activity for {LOCK_S}s. The previous family's data is hidden.</p><button className="warn" onClick={() => setLocked(false)}>Choose a family</button></div></div>}
      <div className="row spread"><h2>👨‍👩‍👧‍👦 Helper Mode <span className="muted small">· one phone, {fam.data?.count ?? '…'} families, separate consent each</span></h2>
        {active && <span className="badge amber">auto-lock in {left}s</span>}</div>
      <ErrorBox e={err} />
      {active ? (
        <div className="card col">
          <div className="row spread"><h3>Now helping: {active.name}</h3><button className="ghost small" onClick={lock}>🔒 Lock / switch</button></div>
          {!active.consent ? (
            <div className="col"><div className="banner offline">This family has not given you consent yet. Nothing can be done for them until they do.</div>
              {!mock ? <button onClick={reqCode}>📲 Send a one-time code to the family's phone <span className="mock-tag">MOCK SMS</span></button> : <>
                <div className="banner info">Code sent. <span className="mock-tag">DEMO ONLY</span> code: <b className="mono">{mock.mock_code_for_demo}</b></div>
                <div className="row"><input style={{ maxWidth: 200 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" /><button onClick={confirm}>Confirm consent</button></div></>}</div>
          ) : (
            <>
              {info && <div className="banner ok">{info}</div>}
              <Tabs value={tab} onChange={setTab} tabs={[['cases', '📋 Cases'], ['data', '🔒 Their consents']]} />
              {tab === 'cases' && <><div className="row"><Link to="/h/claim" className="btn">📝 New claim for {active.name.split(' ')[0]}</Link></div>
                {cases.loading && <Spinner />}{cases.data?.map((c) => <Link key={c.id} to={'/h/cases/' + c.id} className="card row spread" style={{ textDecoration: 'none', color: 'inherit' }}><span>📄 #{c.id.slice(0, 6)} <span className="muted small">{when(c.created_at)}</span></span><StatusBadge s={c.status} /></Link>)}</>}
              {tab === 'data' && <MyData subjectId={active.id} subjectName={active.name} />}
            </>)}
        </div>
      ) : (
        <div className="card col"><input placeholder="🔎 Search family…" value={q} onChange={(e) => setQ(e.target.value)} />
          {fam.loading && <Spinner />}
          <div className="grid">{list.map((f) => <button key={f.citizen_id} className="bigbtn" style={{ minHeight: 90 }} onClick={() => sw(f)}><span style={{ fontSize: '1.9rem' }}>{f.helper_consent_active ? '🟢' : '⚪'}</span><b style={{ fontSize: '1rem' }}>{f.name}</b><span className="small muted">{f.helper_consent_active ? 'consent given' : 'no consent yet'}</span></button>)}</div></div>)}
    </div>
  )
}
