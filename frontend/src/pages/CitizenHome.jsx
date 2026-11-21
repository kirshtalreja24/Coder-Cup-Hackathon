import { Link } from 'react-router-dom'
import { getUser } from '../api'
import { useLang } from '../i18n'
import { loadBox, flush } from '../offline'
import { useAsync, StatusBadge } from '../ui'
import { apiGet } from '../api'
import { playPrompt } from '../voice'

export default function CitizenHome() {
  const { t, lang } = useLang()
  const u = getUser()
  const cases = useAsync(() => apiGet('/cases?limit=3'), [])
  const box = loadBox().filter((x) => x.state !== 'done')
  return (
    <div className="col">
      <div className="row spread">
        <h1>👋 {t('hello')}, {u.name.split(' ')[0]}</h1>
        <button className="ghost" onClick={() => playPrompt('welcome', 'Welcome. Press the big buttons.', lang === 'ur' ? 'ur' : 'en')}>🔊</button>
      </div>
      <div className="bigbtns">
        <Link to="/c/claim" className="bigbtn"><span className="ico">📝</span>{t('claim')}</Link>
        <Link to="/c/scam" className="bigbtn"><span className="ico">🚨</span>{t('scam')}</Link>
        <Link to="/c/ask" className="bigbtn"><span className="ico">❓</span>{t('ask')}</Link>
        <Link to="/c/cases" className="bigbtn"><span className="ico">📋</span>{t('mycases')}</Link>
        <Link to="/c/data" className="bigbtn"><span className="ico">🔒</span>{t('mydata')}</Link>
      </div>
      {box.length > 0 && <div className="banner offline">⏳ {box.length} saved offline. <button className="small" onClick={() => flush()}>Send now</button></div>}
      {cases.data?.length > 0 && <div className="card"><h3>{t('mycases')}</h3>{cases.data.map((c) => <Link key={c.id} to={'/c/cases/' + c.id} className="row spread" style={{ padding: '8px 0', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--line)' }}><span>📄 #{c.id.slice(0, 6)}</span><StatusBadge s={c.status} /></Link>)}</div>}
    </div>
  )
}
