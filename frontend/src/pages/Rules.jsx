import { useEffect, useState } from 'react'
import {
  FileText,
  Play,
  Send,
  RotateCcw,
  History,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldAlert
} from 'lucide-react'
import { apiGet, apiPost, getUser, money, pct, when } from '../api'
import { ErrorBox, Json, Spinner, Tabs, useAsync } from '../ui'
import { useLang } from '../i18n'

const OPS = ['>=', '<=', '>', '<', '==', '!=']

function Diff({ a, b }) {
  const { localize } = useLang()
  const rows = []
  const ca = Object.fromEntries(a.conditions.map((c) => [c.id, c])),
    cb = Object.fromEntries(b.conditions.map((c) => [c.id, c]))
  if (a.amount !== b.amount) rows.push(`amount: ${a.amount} → ${b.amount}`)
  for (const id of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
    if (!ca[id]) rows.push(`+ ${localize('شامل کیا گیا', 'shamil kiya', 'added')} "${cb[id].label}"`)
    else if (!cb[id]) rows.push(`- ${localize('ہٹایا گیا', 'hataya gaya', 'removed')} "${ca[id].label}"`)
    else if (
      JSON.stringify([ca[id].op, ca[id].value, ca[id].hard, ca[id].any_of]) !==
      JSON.stringify([cb[id].op, cb[id].value, cb[id].hard, cb[id].any_of])
    )
      rows.push(
        `~ ${ca[id].label}: ${ca[id].op ?? 'any_of'} ${JSON.stringify(ca[id].value ?? ca[id].any_of)} → ${cb[id].op ?? 'any_of'} ${JSON.stringify(cb[id].value ?? cb[id].any_of)}`
      )
  }
  return rows.length ? (
    <ul className="small" style={{ margin: '6px 0', paddingLeft: 18, paddingRight: 18 }}>
      {rows.map((r, i) => (
        <li key={i} className="mono" style={{ color: 'var(--terracotta-dark)' }}>
          {r}
        </li>
      ))}
    </ul>
  ) : (
    <p className="subtle small" style={{ margin: '4px 0 0' }}>
      {localize('لائیو پروڈکشن رول کے مقابلے میں کوئی تبدیلی نہیں ہے۔', 'No modifications vs live production rule.', 'No modifications vs live production rule.')}
    </p>
  )
}

export default function Rules() {
  const { t, rtl, lang, localize } = useLang()
  const me = getUser()
  const admin = me.role === 'admin'
  const list = useAsync(() => apiGet('/rules'), [])
  const pub = useAsync(() => apiGet('/rules/published'), [])
  const [draft, setDraft] = useState(null)
  const [twin, setTwin] = useState(null)
  const [gate, setGate] = useState(null)
  const [reason, setReason] = useState('')
  const [tab, setTab] = useState('edit')
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (pub.data && !draft) setDraft(JSON.parse(JSON.stringify(pub.data.definition)))
  }, [pub.data])

  if (pub.loading || !draft) return <Spinner label={localize('پالیسی رول انجن لوڈ ہو رہا ہے…', 'Rule engine load ho raha hai…', 'Loading live policy rule engine…')} />

  const setCond = (i, patch) =>
    setDraft({
      ...draft,
      conditions: draft.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c))
    })

  const run = async (fn) => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  const runTwin = () => run(async () => setTwin(await apiPost('/rules/twin', { definition: draft })))

  const publish = () =>
    run(async () => {
      const d = await apiPost('/rules/draft', { definition: draft, note: 'edited in policy editor' })
      try {
        const r = await apiPost(`/rules/${d.id}/publish`, reason.trim() ? { override_reason: reason.trim() } : undefined)
        setMsg(
          localize(
            `لائیو رول v${r.published_version} کامیابی سے شائع ہو گیا۔ تمام اینڈ پوائنٹس پر بغیر کسی تاخیر کے فوری لاگو ہو گیا۔`,
            `Published successfully as live rule v${r.published_version}. Effective immediately across all endpoints.`,
            `Published successfully as live rule v${r.published_version} (was v${r.previous_version}). Effective immediately across all endpoints without code changes or downtime. Old decisions keep their old version.`
          ) +
            (r.safety_gate?.override_reason ? ' ' + localize('حفاظتی رکاوٹ کو تحریری وجہ کے ساتھ بائی پاس کیا گیا۔', 'Safety gate overridden with a recorded reason.', 'Safety gate overridden with a recorded reason.') : '')
        )
        pub.reload()
        list.reload()
        setTwin(null)
        setGate(null)
        setReason('')
      } catch (e) {
        // The safety gate replays the change on past cases and blocks risky publishes until a written reason is given.
        if (e.status === 409 && e.detail?.error === 'safety_gate') {
          setGate({ ...e.detail, draftId: d.id })
          setTwin(e.detail.twin)
        } else throw e
      }
    })

  return (
    <div className={`col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ gap: 20 }}>
      {/* Header */}
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{localize('اہلیت کے قواعد اور ڈیجیٹل ماڈل', 'Rules aur Digital Twin', 'Eligibility Rules & Digital Twin')}</h2>
            <span className="badge">
              {localize('لائیو:', 'Live:', 'Live:')} v{pub.data.version}
            </span>
          </div>
          <div className="small subtle" style={{ marginTop: 2 }}>
            {localize(
              'پالیسی کنفیگریشن · لائیو سسٹم پر لاگو کرنے سے پہلے پچھلے کیسز پر اثرات کا تجزیہ کرتا ہے',
              'Policy configuration · Simulates impact on past cases before committing to live traffic',
              'Deterministic policy configuration · Simulates impact on past cases before committing to live traffic'
            )}
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['edit', localize('قواعد ایڈیٹر و ڈیجیٹل ٹوئن', 'Rule Editor & Digital Twin', 'Rule Editor & Digital Twin')],
            ['versions', localize('ورژن رجسٹری', 'Version Registry', 'Version Registry')],
            ['json', localize('پالیسی کا خاکہ (JSON)', 'Raw Policy Schema', 'Raw Policy Schema')]
          ]}
        />
      </div>

      <ErrorBox e={err} />
      {msg && (
        <div className="banner ok" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div>{msg}</div>
        </div>
      )}

      {tab === 'edit' && (
        <>
          <div className="card col" style={{ gap: 16 }}>
            <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
              <div style={{ flex: 2, minWidth: 220 }}>
                <label>{localize('امدادی پروگرام کا عنوان', 'Imdadi Programme Title', 'Relief Programme Title')}</label>
                <input
                  disabled={!admin}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label>{localize('امداد کی رقم (PKR)', 'Imdad ki Raqam (PKR)', 'Disbursement Amount (PKR)')}</label>
                <input
                  disabled={!admin}
                  type="number"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{localize('قاعدے کی شرط', 'Rule Condition', 'Rule Condition')}</th>
                    <th>{localize('رجسٹری فیکٹ ماخذ', 'Registry Fact Source', 'Registry Fact Source')}</th>
                    <th>{localize('موازنہ اور حد', 'Comparison & Threshold', 'Comparison & Threshold')}</th>
                    <th>{localize('لازمی شرط (Hard Filter)؟', 'Strict Hard Filter?', 'Strict Hard Filter?')}</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.conditions.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.label}</td>
                      <td className="mono subtle small">
                        {c.fact || localize('کوئی بھی:', 'Any of: ', 'Any of: ') + c.any_of?.map((a) => a.fact).join(' | ')}
                      </td>
                      <td>
                        {c.fact ? (
                          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                            <select
                              disabled={!admin}
                              style={{ width: 74, minHeight: 36, padding: '4px 8px' }}
                              value={c.op}
                              onChange={(e) => setCond(i, { op: e.target.value })}
                            >
                              {OPS.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                            <input
                              disabled={!admin}
                              style={{ width: 140, minHeight: 36, padding: '4px 8px' }}
                              value={c.value}
                              onChange={(e) => {
                                const v = e.target.value
                                setCond(i, {
                                  value: isNaN(Number(v)) || v === '' ? v : Number(v)
                                })
                              }}
                            />
                          </div>
                        ) : (
                          <span className="subtle small">{localize('مجموعی قاعدہ گروپ', 'Compound rule group', 'Compound rule group')}</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!admin}
                          style={{ width: 18, height: 18, minHeight: 18 }}
                          checked={c.hard}
                          onChange={(e) => setCond(i, { hard: e.target.checked })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="card flat"
              style={{
                background: 'var(--ivory-alt)',
                border: '1px solid var(--border-subtle)',
                padding: 14
              }}
            >
              <b className="small" style={{ color: 'var(--forest-dark)' }}>
                {localize('لائیو ورژن کے مقابلے میں مجوزہ تبدیلیاں:', 'Proposed Changes vs Live:', 'Proposed Changes vs Live:')} (v{pub.data.version})
              </b>
              <Diff a={pub.data.definition} b={draft} />
            </div>

            <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button disabled={busy} onClick={runTwin}>
                  <Play size={16} />
                  <span>{localize('پچھلے کیسز پر تجزیہ کریں (ڈیجیٹل ٹوئن)', 'Past cases par simulate karein (Digital Twin)', 'Simulate on Past Cases (Digital Twin)')}</span>
                </button>
                {admin && (
                  <button className="warn" disabled={busy} onClick={publish}>
                    <Send size={16} />
                    <span>{localize('لائیو سسٹم پر شائع کریں', 'Live system par publish karein', 'Publish to Live System')}</span>
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => {
                    setDraft(JSON.parse(JSON.stringify(pub.data.definition)))
                    setTwin(null)
                  }}
                >
                  <RotateCcw size={16} />
                  <span>{localize('دوبارہ ترتیب دیں', 'Reset karein', 'Reset')}</span>
                </button>
              </div>

              {!admin && (
                <span className="small subtle">
                  {localize('افسران اور آڈیٹرز کے لیے صرف پڑھنے کا موڈ۔ ٹوئن تجزیہ دستیاب ہے۔', 'Read-only mode for Officers & Auditors. Twin simulation available.', 'Read-only mode for Officers & Auditors. Twin simulation available.')}
                </span>
              )}
            </div>
          </div>

          {/* Publish safety gate (blocked until a written, audited reason is given) */}
          {gate && (
            <div className="card col" style={{ gap: 12, borderColor: 'var(--red)', borderWidth: 2 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <ShieldAlert size={20} style={{ color: 'var(--red)' }} />
                <h3 style={{ margin: 0 }}>{localize('حفاظتی رکاوٹ (Safety Gate) کی طرف سے روکا گیا', 'Safety Gate se roka gaya', 'Blocked by the safety gate')}</h3>
              </div>
              <div className="banner bad">{gate.message}</div>
              <p className="small">
                {localize(
                  'شائع کرنے سے پہلے، سسٹم پچھلے تمام کیسز پر اثرات کی جانچ کرتا ہے۔ ایسے قواعد جن سے خودکار ادائیگیاں 15 فیصد سے زیادہ بڑھ جائیں تحریری وجہ مانگتے ہیں جو آڈٹ لاگ میں درج ہوتی ہے۔',
                  'System har tabdeeli ko pichle cases par check karta hai. Written reason darkaar hai.',
                  'Before publishing, the system replays every change on past cases. Rules that raise automatic payouts by more than 15%, or that would approve more fraud, need a written reason that is stored in the audit log.'
                )}
              </p>
              <label>{localize('تحریری وضاحت (10+ حروف)', 'Written justification (10+ characters)', 'Written justification (10+ characters)')}</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={localize('مثلاً ڈائریکٹر کی طرف سے سیلاب متاثرہ اضلاع کے لیے منظور شدہ پائلٹ', 'e.g. Director-approved pilot for flood-affected districts', 'e.g. Director-approved pilot for flood-affected districts')} />
              <div className="row" style={{ gap: 10 }}>
                <button className="danger" disabled={busy || reason.trim().length < 10} onClick={publish}>
                  {localize('پھر بھی شائع کریں (آڈٹ میں درج)', 'Publish anyway (audited)', 'Publish anyway (audited)')}
                </button>
                <button className="ghost" onClick={() => { setGate(null); setReason('') }}>
                  {localize('منسوخ کریں', 'Mansookh karein', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Digital Twin Simulation Results */}
          {twin && (
            <div className="card col" style={{ gap: 16, border: '1.5px solid var(--forest)' }}>
              <div className="row spread card-header" style={{ margin: 0, paddingBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {localize('ڈیجیٹل ٹوئن ری پلے کے نتائج · ', 'Digital Twin Replay Results · ', 'Digital Twin Replay Results · ')}
                    {twin.cases_replayed} {localize('کیسز کا جائزہ لیا گیا', 'Cases Evaluated', 'Cases Evaluated')}
                  </h3>
                  <span className="small subtle">
                    {localize('پروڈکشن میں کوئی تبدیلی نہیں کی گئی — یہ خالصتاً فرضی موازنہ ہے', 'Purely simulated counterfactuals', 'Zero modifications applied to production — purely simulated counterfactuals')}
                  </span>
                </div>
                <span className="badge grey">{localize('فرضی موازنہ', 'Counterfactual Replay', 'Counterfactual Replay')}</span>
              </div>

              <div className="grid">
                {[
                  [localize('خودکار منظور شدہ', 'Auto-Approved', 'Auto-Approved'), twin.before.routes.AUTO_APPROVE || 0, twin.after.routes.AUTO_APPROVE || 0],
                  [localize('انسانی افسر کو بھیجے گئے', 'Escalated to Humans', 'Escalated to Humans'), twin.before.routes.HUMAN_REVIEW || 0, twin.after.routes.HUMAN_REVIEW || 0],
                  [localize('ثبوت طلب کیے گئے', 'Proof Requested', 'Proof Requested'), twin.before.routes.ASK_PROOF || 0, twin.after.routes.ASK_PROOF || 0],
                  [localize('مسترد (مع اپیل)', 'Declined (Appealable)', 'Declined (Appealable)'), twin.before.routes.DECLINE_WITH_APPEAL || 0, twin.after.routes.DECLINE_WITH_APPEAL || 0],
                  [localize('غلط منظوریاں (دھوکہ دہی پر ادائیگی)', 'Wrong Approvals (Fraud Paid)', 'Wrong Approvals (Fraud Paid)'), twin.before.wrong_approvals, twin.after.wrong_approvals],
                  [localize('حقدار شہری مسترد', 'Genuine Claimants Declined', 'Genuine Claimants Declined'), twin.before.genuine_declined_by_rule, twin.after.genuine_declined_by_rule],
                  [localize('نئے بلاک ہونے والے حقدار شہری', 'Newly Blocked Genuine Claimants', 'Newly Blocked Genuine Claimants'), 0, twin.after.wrongful_declines],
                  [localize('کل خودکار اخراجات', 'Auto-Spend Total', 'Auto-Spend Total'), money(twin.before.auto_spend_pkr), money(twin.after.auto_spend_pkr)],
                  [localize('کل متوقع نقصان', 'Total Expected Loss', 'Total Expected Loss'), money(twin.before.total_cost_pkr), money(twin.after.total_cost_pkr)]
                ].map(([l, a, b]) => (
                  <div key={l} className="card flat" style={{ padding: 14 }}>
                    <div className="kpi-l" style={{ fontSize: '0.74rem' }}>{l}</div>
                    <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                      <span className="subtle small">{a}</span>
                      <ArrowRight size={12} className="subtle" style={{ transform: rtl ? 'rotate(180deg)' : 'none' }} />
                      <b className="kpi" style={{ fontSize: '1.35rem', color: 'var(--forest-dark)' }}>
                        {b}
                      </b>
                    </div>
                  </div>
                ))}
              </div>

              {twin.summary.map((s, i) => (
                <div key={i} className={'banner ' + (s.startsWith('WARNING') ? 'bad' : 'info')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>{s}</div>
                </div>
              ))}

              <div>
                <b className="small" style={{ color: 'var(--forest-dark)' }}>
                  {twin.changed_cases} {localize('درخواستوں کا فیصلہ جاتی راستہ بدلے گا:', 'Claims would experience route changes:', 'Claims Would Experience Route Changes:')}
                </b>
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {twin.transitions.map((t, i) => (
                    <span key={i} className="badge blue">
                      {t.from} → {t.to}: {t.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'versions' && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{localize('ورژن', 'Version', 'Version')}</th>
                <th>{localize('حیثیت', 'Status', 'Status')}</th>
                <th>{localize('شائع کرنے کا وقت', 'Published At', 'Published At')}</th>
                <th>{localize('آڈٹ نوٹ', 'Audit Note', 'Audit Note')}</th>
                <th>{localize('موجودہ ورژن سے فرق', 'Changes vs Current', 'Changes vs Current')}</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    v{r.version}
                  </td>
                  <td>
                    <span className={'badge ' + (r.status === 'published' ? '' : 'grey')}>
                      {r.status === 'published' ? localize('شائع شدہ', 'Published', 'Published') : r.status}
                    </span>
                  </td>
                  <td className="small subtle">{when(r.published_at)}</td>
                  <td className="small">{r.note}</td>
                  <td>
                    <Diff a={pub.data.definition} b={r.definition} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'json' && (
        <div className="card col" style={{ gap: 12 }}>
          <p className="small muted" style={{ margin: 0 }}>
            {localize(
              'واضح JSON خاکہ۔ غیر موجود فیکٹس خودکار طور پر نامعلوم ہو کر انسانی جائزے پر بھیجے جاتے ہیں۔',
              'Declarative JSON schema.',
              'Declarative JSON schema. Missing facts default to UNKNOWN and trigger human triage rather than silent pass.'
            )}
          </p>
          <textarea
            style={{ minHeight: 340, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            disabled={!admin}
            value={JSON.stringify(draft, null, 2)}
            onChange={(e) => {
              try {
                setDraft(JSON.parse(e.target.value))
                setErr(null)
              } catch {
                /* keep typing */
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
