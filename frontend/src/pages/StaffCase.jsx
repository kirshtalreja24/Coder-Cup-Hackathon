import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Camera,
  UserCheck,
  ShieldAlert,
  FileText,
  AlertTriangle,
  Lock,
  Eye,
  Clock,
  Sparkles,
  ExternalLink,
  HelpCircle
} from 'lucide-react'
import { api, apiGet, apiPost, getUser, money, pct, when, BASE, getToken } from '../api'
import { ErrorBox, Json, MockTag, RouteBadge, Spinner, StatusBadge, Tabs, useAsync } from '../ui'
import { useLang } from '../i18n'

function DocImage({ id }) {
  const { localize } = useLang()
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let url
    fetch(BASE + `/documents/${id}/file`, {
      headers: { Authorization: 'Bearer ' + getToken() }
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b)
          setSrc(url)
        }
      })
    return () => url && URL.revokeObjectURL(url)
  }, [id])

  return src ? (
    <img
      src={src}
      alt={localize('دستاویز ثبوت', 'Dastaweez saboot', 'Document evidence')}
      style={{
        maxWidth: '100%',
        borderRadius: 'var(--radius-md)',
        maxHeight: 260,
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)'
      }}
    />
  ) : (
    <span className="small subtle">{localize('تصویر کا پیش نظارہ دستیاب نہیں', 'Tasweer preview dastiyab nahi', 'Image preview unavailable')}</span>
  )
}

export default function StaffCase() {
  const { id } = useParams()
  const { t, rtl, lang, localize } = useLang()
  const me = getUser()
  const c = useAsync(() => apiGet('/cases/' + id), [id])
  const dec = useAsync(() => apiGet(`/cases/${id}/decision`).catch(() => null), [id])
  const tl = useAsync(() => apiGet(`/cases/${id}/timeline`), [id])
  // Only the reviewing officer can ever see uploaded documents (consent-gated on the server); do not ask for them as admin / auditor.
  const canSeeDocs = me?.role === 'officer'
  const docs = useAsync(
    () => (canSeeDocs ? apiGet(`/cases/${id}/documents`).catch((e) => ({ denied: e })) : Promise.resolve({ officerOnly: true })),
    [id]
  )
  const [tab, setTab] = useState('brief')
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const reloadAll = () => {
    c.reload()
    dec.reload()
    tl.reload()
    docs.reload()
  }

  const act = async (fn) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      reloadAll()
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  if (c.loading) return <Spinner label={localize('کیس فائل لوڈ ہو رہی ہے…', 'Case file load ho rahi hai…', 'Loading case dossier…')} />
  if (c.error) return <ErrorBox e={c.error} />
  const x = c.data,
    brief = x.handoff_brief,
    tr = dec.data?.trace
  const canAct = me.role === 'officer' && !['paid', 'closed', 'rejected'].includes(x.status)

  return (
    <div className={`col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ gap: 20 }}>
      {/* Dossier Header */}
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <Link
            to="/s/queue"
            className="row small subtle"
            style={{ textDecoration: 'none', gap: 6, marginBottom: 8 }}
          >
            <ArrowLeft size={14} style={{ transform: rtl ? 'rotate(180deg)' : 'none' }} />
            <span>{localize('قطار پر واپس جائیں', 'Queue par wapis', 'Back to Queue')}</span>
          </Link>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>
              {localize('درخواست نمبر', 'Case #', 'Case #')} {x.id.slice(0, 8)}
            </h2>
            <StatusBadge s={x.status} />
            {dec.data && <RouteBadge r={dec.data.route} />}
          </div>
        </div>

        <div className="small subtle">
          {localize('جمع ہوا: ', 'Jama hua: ', 'Opened: ')}
          {when(x.created_at)}
        </div>
      </div>

      {x.redacted && (
        <div className="banner bad" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Lock size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <b>{localize('ذاتی ڈیٹا مسدود ہے:', 'Zaati data mahfooz/masdood hai:', 'Personal Data Redacted:')}</b>{' '}
            {x.redaction_reason || localize(
              'شہری نے ڈیٹا شیئر کرنے کی اجازت نہیں دی یا واپس لے لی ہے۔ اجازت بحال ہونے تک کارروائی رکی ہوئی ہے۔ (آڈٹ لاگ میں درج)۔',
              'Citizen ne ijazat nahi di ya wapis le li. Ijazat tak karwai ruki hui hai.',
              'Citizen has not shared or has withdrawn active consent. Action blocked until consent is restored. (Logged in tamper-evident audit).'
            )}
          </div>
        </div>
      )}

      {x.masked && (
        <div className="banner info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Eye size={18} style={{ flexShrink: 0 }} />
          <div>
            {localize(
              'پرائیویسی ضوابط کے تحت شناختی تفصیلات (شناختی کارڈ، فون، پتہ) آپ کے کردار کے لیے ماسک کی گئی ہیں۔',
              'Privacy rules ke teht shanakhti maloomat mask ki gayi hain.',
              'Personal identifiers (CNIC, phone, address) are masked for your role under privacy regulations.'
            )}
          </div>
        </div>
      )}

      <ErrorBox e={err} />

      {/* Grid: AI Handoff Brief & Submitted Data */}
      <div className="grid g2">
        {/* Handoff Intelligence */}
        <div className="card col" style={{ gap: 14 }}>
          <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{localize('اے آئی ہینڈ آف بریف', 'AI Handoff Brief', 'AI Handoff Brief')}</h3>
            {brief?.headline && <span className="badge blue">{brief.headline}</span>}
          </div>

          {brief ? (
            <div className="col" style={{ gap: 12 }}>
              <div>
                <b className="small" style={{ color: 'var(--forest-dark)' }}>
                  {localize('سسٹم کے رکنے کی وجہ:', 'System ke rukne ki wajah:', 'Why the System Stopped:')}
                </b>
                <p className="small" style={{ margin: '4px 0 0' }}>
                  {brief.why_unsure}
                </p>
              </div>

              {brief.what_we_doubt?.length > 0 && (
                <div>
                  <b className="small" style={{ color: 'var(--terracotta-dark)' }}>
                    {localize('مخصوص شکوک و غیر یقینی:', 'Makhsoos shukook:', 'Specific Uncertainties & Doubts:')}
                  </b>
                  <ul style={{ margin: '4px 0', paddingLeft: rtl ? 0 : 18, paddingRight: rtl ? 18 : 0 }}>
                    {brief.what_we_doubt.map((d, i) => (
                      <li key={i} className="small">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.what_we_know?.length > 0 && (
                <details>
                  <summary className="small subtle" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {localize('تصدیق شدہ بنیادی حقائق', 'Tasdeeq shuda haqaiq', 'Verified Ground Truths')} ({brief.what_we_know.length})
                  </summary>
                  <ul style={{ margin: '6px 0', paddingLeft: rtl ? 0 : 18, paddingRight: rtl ? 18 : 0 }}>
                    {brief.what_we_know.map((d, i) => (
                      <li key={i} className="small">
                        {d}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {brief.suggested_questions?.length > 0 && (
                <div>
                  <b className="small" style={{ color: 'var(--blue)' }}>
                    {localize('افسر کے لیے مجوزہ سوالات:', 'Officer ke liye tajweez shuda sawalaat:', 'Suggested Officer Inquiries:')}
                  </b>
                  <ul style={{ margin: '4px 0', paddingLeft: rtl ? 0 : 18, paddingRight: rtl ? 18 : 0 }}>
                    {brief.suggested_questions.map((d, i) => (
                      <li key={i} className="small">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.citizen_note && (
                <div className="banner info small">
                  <b>{localize('شہری کا نوٹ:', 'Citizen ka note:', 'Citizen Note:')}</b> {brief.citizen_note}
                </div>
              )}

              <div
                className="card flat small"
                style={{
                  background: 'var(--ivory-alt)',
                  border: '1px solid var(--border-subtle)',
                  padding: 10
                }}
              >
                {localize('خودکار منظوری پر متوقع نقصان:', 'Auto-approval par mutawaqqa nuqsan:', 'Expected loss if auto-approved:')}{' '}
                <b className="mono">{money(brief.expected_cost_if_auto_approved_pkr)}</b> {localize('بمقابلہ جائزے کی لاگت:', 'vs jaize ki laagat:', 'vs review cost:')}{' '}
                <b className="mono">{money(brief.expected_cost_if_reviewed_pkr)}</b>.
              </div>
            </div>
          ) : (
            <p className="small muted">
              {localize(
                'اس دعوے کے لیے کوئی ہینڈ آف بریف ریکارڈ نہیں ہوا (فیصلہ خودکار ہوا یا ڈیٹا محدود ہے)۔',
                'Is claim ke liye koi handoff brief record nahi hua.',
                'No handoff brief recorded for this claim (decision routed automatically or data restricted).'
              )}
            </p>
          )}
        </div>

        {/* Submitted Data & Document Analysis */}
        <div className="card col" style={{ gap: 14 }}>
          <div className="card-header" style={{ margin: 0, paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>
              {localize('درخواست گزار کے کوائف اور شواہد', 'Claimant ke kowaif aur saboot', 'Claimant Submission & Evidence')}
            </h3>
          </div>

          {x.data ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {Object.entries(x.data)
                    .filter(([, v]) => v !== null && v !== '')
                    .map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ width: '40%' }}>{k}</th>
                        <td className="mono">{String(v)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">
              {localize('پرائیویسی ضوابط کے تحت معلومات روک لی گئی ہیں۔', 'Privacy rules ke teht data withheld.', 'Data withheld under privacy regulations.')}
            </p>
          )}

          {docs.data?.length > 0 &&
            docs.data.map((d) => (
              <div
                key={d.id}
                className="col"
                style={{
                  gap: 8,
                  padding: 12,
                  background: 'var(--ivory-alt)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <DocImage id={d.id} />
                <div className="row spread small">
                  <span>
                    {localize('صداقت کا اسکور:', 'Sadaqat ka score:', 'Authenticity Score:')} <b>{d.analysis?.authenticity ?? '-'}</b>
                  </span>
                  {d.analysis?.flag && <span className="badge red">{d.analysis.flag}</span>}
                </div>
                {d.analysis?.flags?.map((f, i) => (
                  <div key={i} className="small subtle">
                    • {f}
                  </div>
                ))}
              </div>
            ))}

          {docs.data?.officerOnly && (
            <p className="small muted">
              {localize(
                'اپ لوڈ کردہ دستاویزات صرف جائزہ لینے والے افسر کو دکھائی دیتی ہیں، اور وہ بھی صرف شہری کی رضامندی کے ساتھ۔',
                'Uploaded dastaweezat sirf reviewing officer ko ijazat ke sath nazar aati hain.',
                'Uploaded documents are visible only to the reviewing officer, and only with the citizen\'s consent.'
              )}
            </p>
          )}

          {docs.data?.denied && (
            <p className="small muted">
              {localize(
                'دستاویز اسٹوریج تک رسائی مسترد: شہری نے دستاویز دیکھنے کی اجازت نہیں دی۔',
                'Dastaweez dekhne ki ijazat nahi di gayi.',
                'Document storage access denied: citizen has not granted document permission.'
              )}
            </p>
          )}
        </div>
      </div>

      {/* Human-in-the-Loop Action Bar (for officers) */}
      {canAct && (
        <div className="card col" style={{ gap: 14, border: '1.5px solid var(--forest)' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {localize('انسانی فیصلہ سازی (Human-in-the-Loop)', 'Insani Faisla Saazi (Human-in-the-Loop)', 'Human Adjudication (Human-in-the-Loop)')}
            </h3>
            <div className="small subtle" style={{ marginTop: 2 }}>
              {localize(
                'آپ کا فیصلہ اور اس کی وجوہات مستقل آڈٹ چین میں محفوظ کی جائیں گی۔',
                'Aap ka faisla audit chain mein record kiya jayega.',
                'Your determination is recorded in the permanent audit chain alongside your reasoning.'
              )}
            </div>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={localize(
              'مسترد کرنے یا مزید ثبوت مانگنے کی لازمی وجہ یا ہدایت یہاں لکھیں…',
              'Mustared karne ya saboot mangne ki lazmi wajah darj karein…',
              'Mandatory reasoning or instruction for rejection / additional proof request…'
            )}
            style={{ minHeight: 90 }}
          />

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button
              disabled={busy || x.redacted}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/review`, { action: 'approve', note }))
              }
            >
              <CheckCircle2 size={16} />
              <span>{localize('منظور کریں اور رقم بھیجیں', 'Manzoor karein aur release karein', 'Approve & Release')}</span>
              <MockTag>MOCK PAY</MockTag>
            </button>

            <button
              className="danger"
              disabled={busy || x.redacted}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/review`, { action: 'reject', note }))
              }
            >
              <XCircle size={16} />
              <span>{localize('درخواست مسترد کریں', 'Darkhast mustared karein', 'Reject Claim')}</span>
            </button>

            <button
              className="warn"
              disabled={busy || x.redacted}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/review`, { action: 'request_proof', note }))
              }
            >
              <Camera size={16} />
              <span>{localize('مزید ثبوت طلب کریں', 'Mazeed saboot maangein', 'Request Proof')}</span>
            </button>

            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => act(() => apiPost(`/cases/${id}/assign`))}
            >
              <UserCheck size={16} />
              <span>{localize('میرے نام تفویض کریں', 'Mere naam assign karein', 'Assign to Me')}</span>
            </button>

            <button
              className="btn ghost"
              disabled={busy || note.length < 3}
              onClick={() =>
                act(() => apiPost(`/cases/${id}/escalate`, { reason: note }))
              }
            >
              <ShieldAlert size={16} />
              <span>{localize('اعلیٰ افسر کو بھیجیں', 'Aala officer ko bhejein', 'Escalate')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Deep Inspection Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ['brief', localize('شہری نوٹس اور وجہ', 'Citizen Notice aur Wajah', 'Citizen Notice & Rationale')],
          ['trace', localize('الگورتھم کا فیصلہ جاتی سراغ', 'Algorithmic Decision Trace', 'Algorithmic Decision Trace')],
          ['time', localize('آڈٹ ٹائم لائن', 'Audit Timeline', 'Audit Timeline')]
        ]}
      />

      {tab === 'brief' && dec.data && (
        <div className="card col" style={{ gap: 12 }}>
          <h3 style={{ margin: 0 }}>
            {localize('شہری کو دکھائی گئی اطلاع', 'Citizen ko dikhaya gaya notice', 'Notice Presented to Claimant')}
          </h3>
          <p style={{ fontSize: '1.05rem', margin: 0 }}>
            {lang === 'ur'
              ? (dec.data.reason_user?.ur || dec.data.reason_user?.en)
              : lang === 'roman'
                ? (dec.data.reason_user?.roman || dec.data.reason_user?.en)
                : dec.data.reason_user?.en}
          </p>
          <div className="small subtle" style={{ marginTop: 8 }}>
            {localize('فیصلہ شناختی نمبر:', 'Faisla ID:', 'Decision ID:')}{' '}
            <code className="mono">{dec.data.id?.slice(0, 8)}</code> ·{' '}
            {localize('قاعدہ ورژن:', 'Rule v:', 'Rule: v')}{dec.data.rule_version} ·{' '}
            {localize('ماڈل:', 'Model:', 'Model:')} {dec.data.model_version} ·{' '}
            {localize('اعتماد:', 'Confidence:', 'Confidence:')} {pct(dec.data.confidence)} ·{' '}
            {localize('وقت:', 'Waqt:', 'Timestamp:')} {when(dec.data.created_at)}
          </div>
        </div>
      )}

      {tab === 'trace' && tr && (
        <div className="col" style={{ gap: 16 }}>
          <div className="grid g2">
            <div className="card col" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>
                {localize('لاگت و نقصان کا موازنہ (PKR Loss)', 'Action Cost Matrix (PKR)', 'Action Cost Matrix (PKR Loss)')}
              </h3>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {Object.entries(tr.decision.action_costs).map(([k, v]) => (
                      <tr
                        key={k}
                        style={
                          k === tr.decision.route
                            ? { background: 'var(--sage-soft)', fontWeight: 600 }
                            : {}
                        }
                      >
                        <td>{k}</td>
                        <td className="mono" style={{ textAlign: rtl ? 'left' : 'right' }}>
                          PKR {Number(v).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small subtle">
                {localize('خودکار منظوری کی حد:', 'Auto-approve threshold:', 'Auto-approve threshold:')} P ≥ {pct(tr.decision.thresholds?.auto_approve_min_p, 2)}.
                {tr.decision.override && <span> {localize('اوور رائیڈ:', 'Override:', 'Override:')} <b>{tr.decision.override}</b></span>}
              </div>
            </div>

            <div className="card col" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>
                {localize('قواعد کا سراغ (Rule Trace)', 'Rule Engine Trace', 'Rule Engine Trace')} (v{tr.rule.version})
              </h3>
              <div className="col" style={{ gap: 6 }}>
                {tr.rule.result?.trace?.map((r) => (
                  <div
                    key={r.id}
                    className="row spread small"
                    style={{
                      padding: '6px 10px',
                      background: 'var(--ivory-alt)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {r.passed === true ? (
                        <CheckCircle2 size={15} style={{ color: 'var(--evergreen)', flexShrink: 0 }} />
                      ) : r.passed === false ? (
                        <XCircle size={15} style={{ color: 'var(--terracotta)', flexShrink: 0 }} />
                      ) : (
                        <HelpCircle size={15} style={{ color: 'var(--champagne)', flexShrink: 0 }} />
                      )}
                      <span>{r.label}</span>
                    </span>
                    <span className="mono subtle">
                      actual: {JSON.stringify(r.actual)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card col" style={{ gap: 10 }}>
            <h3 style={{ margin: 0 }}>
              {localize('شناخت کا تقابل (Fellegi–Sunter)', 'Identity Matching', 'Identity Matching (Fellegi–Sunter Weights)')}
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{localize('رجسٹری فیلڈ', 'Registry Field', 'Registry Attribute')}</th>
                    <th>{localize('مطابقت کی سطح', 'Mutabaqat ki satah', 'Agreement Level')}</th>
                    <th>{localize('امکانی وزن', 'Imkani wazan', 'Log-Likelihood Weight')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tr.identity?.fields || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ fontWeight: 500 }}>{k}</td>
                      <td>{v.level}</td>
                      <td className="mono">{v.weight}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--ivory-alt)', fontWeight: 700 }}>
                    <td>{localize('کل مماثلت کا وزن', 'Kul wazan', 'Total Match Weight')}</td>
                    <td>{tr.identity?.decision}</td>
                    <td className="mono">{tr.identity?.total_weight}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <details className="card" style={{ padding: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              {localize('خام JSON ایگزیکیوشن ٹریس', 'Raw JSON Trace', 'Raw JSON Execution Trace')}
            </summary>
            <div style={{ marginTop: 10 }}>
              <Json data={tr} />
            </div>
          </details>
        </div>
      )}

      {tab === 'time' && (
        <div className="card">
          <ul className="step-list">
            {tl.data?.events.map((e, i) => (
              <li key={i}>
                <div className="row spread">
                  <b style={{ color: 'var(--forest-dark)' }}>{e.kind}</b>
                  <span className="small subtle">{when(e.at)}</span>
                </div>
                {e.note && <div className="small muted" style={{ marginTop: 4 }}>{e.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
