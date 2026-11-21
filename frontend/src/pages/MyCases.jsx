import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, apiDel, apiGet, apiPost, money, when } from '../api'
import { useLang } from '../i18n'
import { shrinkImage } from '../offline'
import { playPrompt, speak } from '../voice'
import { ErrorBox, RouteBadge, Spinner, StatusBadge, useAsync } from '../ui'

export function MyCases() {
  const { t } = useLang()
  const { data, loading, error } = useAsync(() => apiGet('/cases?limit=50'), [])
  return (
    <div className="col"><h2>📋 {t('mycases')}</h2><ErrorBox e={error} />{loading && <Spinner />}
      {data?.length === 0 && <div className="card">No requests yet. <Link to="/c/claim">📝 {t('claim')}</Link></div>}
      {data?.map((c) => (
        <Link key={c.id} to={'/c/cases/' + c.id} className="card row spread" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div><b>📄 #{c.id.slice(0, 6)}</b><div className="small muted">{when(c.created_at)}</div></div>
          <div className="row">{c.amount && <span className="small">{money(c.amount)}</span>}<StatusBadge s={c.status} /></div>
        </Link>))}
    </div>
  )
}

export function CaseView({ helper }) {
  const { id } = useParams()
  const { t, lang } = useLang()
  const nav = useNavigate()
  const c = useAsync(() => apiGet('/cases/' + id), [id])
  const dec = useAsync(() => apiGet(`/cases/${id}/decision`).catch(() => null), [id])
  const tl = useAsync(() => apiGet(`/cases/${id}/timeline`), [id])
  const docs = useAsync(() => apiGet(`/cases/${id}/documents`).catch(() => []), [id])
  const [err, setErr] = useState(null)
  const L = lang === 'ur' ? 'ur' : 'en'
  const reason = dec.data?.reason_user?.[lang === 'roman' ? 'roman' : lang === 'ur' ? 'ur' : 'en']
  const retake = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try {
      const small = await shrinkImage(f); const blob = await (await fetch(small)).blob(); const fd = new FormData(); fd.append('file', blob, 'id.jpg')
      await api(`/cases/${id}/documents`, { method: 'POST', formData: fd, timeout: 40000 }); await apiPost(`/cases/${id}/submit`, {})
      c.reload(); dec.reload(); tl.reload(); docs.reload()
    } catch (x) { setErr(x) }
  }
  if (c.loading) return <Spinner />
  if (c.error) return <ErrorBox e={c.error} />
  const x = c.data
  return (
    <div className="col narrow">
      <div className="row spread"><h2>📄 #{x.id.slice(0, 6)}</h2><StatusBadge s={x.status} /></div>
      {dec.data && <div className={'result ' + ({ AUTO_APPROVE: 'good', ASK_PROOF: 'wait', HUMAN_REVIEW: 'human', DECLINE_WITH_APPEAL: 'stop' }[dec.data.route] || 'wait')} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
        <p style={{ fontSize: '1.2rem' }}>{reason}</p><button className="ghost" onClick={() => speak(reason, L)}>🔊</button>
        <div className="small muted" dir="ltr">Decided with rule v{dec.data.rule_version} · confidence {Math.round(dec.data.confidence * 100)}% · {when(dec.data.created_at)}</div></div>}
      <ErrorBox e={err} />
      {x.status === 'needs_proof' && <label className="btn" style={{ textAlign: 'center' }}>📷 {t('takephoto')}<input type="file" accept="image/*" capture="environment" hidden onChange={retake} /></label>}
      {['declined', 'rejected', 'needs_proof'].includes(x.status) && <button className="warn" onClick={async () => { await apiPost(`/cases/${id}/appeal?note=please re-check`); c.reload() }}>🙋 {t('appeal')}</button>}
      {docs.data?.length > 0 && <div className="card col"><h3>📄 Documents</h3>{docs.data.map((d) => <div key={d.id} className="row spread"><span className="small">{d.filename} · authenticity {d.analysis?.authenticity ?? '-'}{d.analysis?.flag ? ' · ' + d.analysis.flag : ''}</span><button className="danger small" onClick={async () => { await apiDel('/documents/' + d.id); docs.reload() }}>🗑 {t('withdraw')}</button></div>)}</div>}
      <div className="card"><h3>🕒 History</h3><ul className="step-list" dir="ltr">{tl.data?.events.map((e, i) => <li key={i}><b>{e.kind}</b> <span className="muted small">{when(e.at)}</span>{e.note && <div className="small">{e.note}</div>}</li>)}</ul></div>
      <Link to="/c/data">🔒 {t('mydata')}</Link>
    </div>
  )
}
