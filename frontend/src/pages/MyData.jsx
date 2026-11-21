import { useState } from 'react'
import { apiGet, apiPatch, apiPost, getUser, when } from '../api'
import { useLang } from '../i18n'
import { playPrompt } from '../voice'
import { ErrorBox, Spinner, useAsync } from '../ui'

const ICON = { identity: '🪪', documents: '📄', case_history: '📋', payment: '💸', profile: '🙂' }
const WHO = { mock_nadra: 'Identity registry (MOCK)', mock_raast: 'Payment rail (MOCK)', officer: 'Department officers' }

export default function MyData({ subjectId, subjectName }) {
  const { t, lang } = useLang()
  const q = subjectId ? `?subject_id=${subjectId}` : ''
  const cons = useAsync(() => apiGet('/consents' + q), [subjectId])
  const log = useAsync(() => apiGet('/consents/access-log' + q), [subjectId])
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState('')
  const u = getUser()
  const [prof, setProf] = useState({ name: u?.name || '', phone: u?.phone || '' })
  const refresh = () => { cons.reload(); log.reload() }
  const withdraw = async (id) => { try { await apiPost(`/consents/${id}/withdraw`); playPrompt('consent_withdrawn', 'Your permission was withdrawn.', lang === 'ur' ? 'ur' : 'en'); setMsg('Permission taken back. Access stopped immediately.'); refresh() } catch (e) { setErr(e) } }
  const all = async () => { try { const r = await apiPost('/consents/withdraw-all' + q); setMsg(`${r.withdrawn} permission(s) withdrawn. Nobody can see your data now.`); playPrompt('consent_withdrawn', 'All permissions withdrawn.', lang === 'ur' ? 'ur' : 'en'); refresh() } catch (e) { setErr(e) } }
  const saveProfile = async () => { try { await apiPatch('/auth/me/profile', prof); setMsg('Your details were corrected.') } catch (e) { setErr(e) } }
  return (
    <div className="col">
      <div className="row spread"><h2>🔒 {t('mydata')} {subjectName && <span className="muted small">· {subjectName}</span>}</h2>{cons.data?.active_count > 0 && <button className="danger" onClick={all}>🛑 {t('withdraw')} (all)</button>}</div>
      {msg && <div className="banner ok">✔ {msg}</div>}<ErrorBox e={err} />
      <div className="card col"><h3>Who can see my data right now</h3>
        {cons.loading && <Spinner />}
        {cons.data?.active.length === 0 && <p className="muted">🔐 Nobody. Your data is not shared.</p>}
        {cons.data?.active.map((c) => (
          <div key={c.id} className="toggle"><span className="ico">{ICON[c.scope]}</span>
            <div style={{ flex: 1 }}><b>{WHO[c.grantee] || c.grantee_type + ': ' + c.grantee.slice(0, 8)}</b><div className="small muted">{c.label?.[lang === 'ur' ? 'ur' : 'en']} · since {when(c.granted_at)}</div><div className="mono muted">receipt {c.receipt?.slice(0, 12)}…</div></div>
            <button className="danger small" onClick={() => withdraw(c.id)}>{t('withdraw')}</button></div>))}
      </div>
      <div className="card col"><h3>👀 Who looked at my data</h3>
        {log.data?.length === 0 && <p className="muted">No one yet.</p>}
        <div className="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Result</th></tr></thead><tbody>
          {log.data?.map((e) => <tr key={e.seq}><td>{when(e.at)}</td><td>{e.by}</td><td>{e.action} {e.scope && `(${e.scope})`}</td><td><span className={'badge ' + (e.outcome === 'denied' ? 'red' : '')}>{e.outcome === 'denied' ? 'blocked' : e.outcome}</span></td></tr>)}</tbody></table></div>
        <p className="hint">Every read, every block and every withdrawal is recorded in a tamper-evident log.</p></div>
      {!subjectId && <div className="card col"><h3>✏️ Correct my details</h3>
        <div><label>{t('name')}</label><input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} /></div>
        <div><label>Phone</label><input value={prof.phone || ''} onChange={(e) => setProf({ ...prof, phone: e.target.value })} /></div>
        <button onClick={saveProfile}>Save</button></div>}
      {cons.data?.withdrawn.length > 0 && <details className="card"><summary>History of withdrawn permissions ({cons.data.withdrawn.length})</summary>
        {cons.data.withdrawn.map((c) => <div key={c.id} className="small muted">{c.scope} → {WHO[c.grantee] || c.grantee.slice(0, 8)} · withdrawn {when(c.withdrawn_at)}</div>)}</details>}
    </div>
  )
}
