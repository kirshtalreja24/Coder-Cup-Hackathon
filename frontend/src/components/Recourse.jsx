import { useLang } from '../i18n'

// "What would change this decision?" The sentences come from the decision engine itself: each one was computed by
// re-running the real decision with a hypothetical improvement (for example a clear photo of the ID card).
export default function Recourse({ items }) {
  const { lang, t } = useLang()
  if (!items?.length) return null
  const pick = (it) => it[lang === 'roman' ? 'roman' : lang === 'ur' ? 'ur' : 'en']
  return (
    <div className="card col" dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <h3>💡 {t('whatwould')}</h3>
      <ul style={{ margin: 0, paddingInlineStart: 20 }}>
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {pick(it)} {it.would_route === 'AUTO_APPROVE' && <span className="badge">✔ {t('autoposs')}</span>}
          </li>
        ))}
      </ul>
      <p className="hint" dir="ltr">Computed by re-running the real decision engine with each change, not a fixed tip.</p>
    </div>
  )
}
