import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare,
  RefreshCw,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Clock
} from 'lucide-react'
import { apiGet, money, pct, when } from '../api'
import { ErrorBox, RouteBadge, Spinner, StatusBadge, useAsync, Bar } from '../ui'
import { useLang } from '../i18n'

export default function Queue() {
  const { t, rtl, lang, localize } = useLang()
  const [sort, setSort] = useState('priority')
  const [waiting, setWaiting] = useState(false)
  const { data, loading, error, reload } = useAsync(
    () => apiGet(`/queue?sort=${sort}&include_waiting=${waiting}`),
    [sort, waiting]
  )

  const PRI = {
    1: [localize('P1 فوری', 'P1 Fori', 'P1 Urgent'), 'red'],
    2: [localize('P2 اہم', 'P2 Aham', 'P2 High'), 'amber'],
    3: [localize('P3 عام', 'P3 Aam', 'P3 Normal'), 'blue'],
    4: [localize('P4 کم ترجیح', 'P4 Kam tarjeeh', 'P4 Low'), 'grey']
  }

  return (
    <div className={`col ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'} style={{ gap: 20 }}>
      {/* Header and Filter Controls */}
      <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>{localize('جائزہ کی قطار', 'Jaiza ki qataar', 'Review Queue')}</h2>
          <div className="small subtle" style={{ marginTop: 2 }}>
            {localize(
              'وہ درخواستیں جہاں خودکار فیصلے کے انجن نے انسانی افسر کے جائزے کے لیے کیس بھیجا ہے',
              'Woh darkhastein jahan khudkaar decision engine ne insani jaize ke liye case bheja hai',
              'Cases where the autonomous decision engine abstained or flagged uncertainty for human-in-the-loop oversight'
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label
            className="row small"
            style={{
              margin: 0,
              gap: 8,
              cursor: 'pointer',
              background: 'var(--paper)',
              padding: '8px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <input
              type="checkbox"
              style={{ width: 16, height: 16, minHeight: 16, margin: 0 }}
              checked={waiting}
              onChange={(e) => setWaiting(e.target.checked)}
            />
            <span>{localize('دستاویز کی منتظر شامل کریں', 'Dastaweez ki muntazir shamil karein', 'Include awaiting proof')}</span>
          </label>

          <select
            style={{ width: 'auto', minWidth: 170 }}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="priority">{localize('ترتیب: ترجیح (P1 پہلے)', 'Tarteeb: Tarjeeh (P1 pehle)', 'Sort: Priority (P1 first)')}</option>
            <option value="confidence">{localize('ترتیب: کم ترین اعتماد پہلے', 'Tarteeb: Kam tareen aitemaad pehle', 'Sort: Least confident first')}</option>
            <option value="age">{localize('ترتیب: پرانی ترین پہلے', 'Tarteeb: Purani tareen pehle', 'Sort: Oldest first')}</option>
          </select>

          <button
            className="btn ghost icon-btn"
            onClick={reload}
            title={localize('قطار ریفریش کریں', 'Queue refresh karein', 'Refresh queue')}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <ErrorBox e={error} />
      {loading && <Spinner label={localize('قطار تازہ ہو رہی ہے…', 'Queue taaza ho rahi hai…', 'Refreshing triage queue…')} />}

      {data && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{localize('ترجیح', 'Tarjeeh', 'Priority')}</th>
                <th>{localize('درخواست شناخت', 'Case Shanakht', 'Case Identifier')}</th>
                <th>{localize('حیثیت', 'Status', 'Status')}</th>
                <th>{localize('سسٹم کا راستہ', 'System Route', 'System Route')}</th>
                <th>{localize('امکانِ صداقت', 'Imkaan-e-Sadaqat', 'P(Genuine)')}</th>
                <th>{localize('شک کی وجہ', 'Shak ki wajah', 'Uncertainty Driver')}</th>
                <th>{localize('امداد کی رقم', 'Imdad ki raqam', 'Disbursement')}</th>
                <th>{localize('جمع کرنے کا وقت', 'Jama shuda waqt', 'Submitted')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={'badge ' + (PRI[c.priority]?.[1] || 'grey')}>
                      {PRI[c.priority]?.[0] || 'P3 Normal'}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={'/s/case/' + c.id}
                      className="mono"
                      style={{ fontWeight: 700, textDecoration: 'none' }}
                    >
                      #{c.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge s={c.status} />
                  </td>
                  <td>
                    <RouteBadge r={c.route} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div className="row spread small mono" style={{ marginBottom: 4 }}>
                      <span>{pct(c.p_legit)}</span>
                    </div>
                    <Bar
                      value={c.p_legit ?? 0}
                      color={
                        c.p_legit > 0.9
                          ? 'var(--forest)'
                          : c.p_legit > 0.5
                            ? 'var(--gold)'
                            : 'var(--terracotta)'
                      }
                    />
                  </td>
                  <td className="small" style={{ maxWidth: 260 }}>
                    {c.headline || localize('عام دستی جائزہ درکار ہے', 'Aam jaiza darkaar hai', 'General manual review required')}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {money(c.amount)}
                  </td>
                  <td className="small subtle">{when(c.created_at)}</td>
                  <td>
                    <Link
                      to={'/s/case/' + c.id}
                      className="btn ghost small"
                      style={{ padding: '4px 8px' }}
                      title={localize('تفصیلات دیکھیں', 'Tafseelaat dekhein', 'View details')}
                    >
                      <ChevronRight size={14} style={{ transform: rtl ? 'rotate(180deg)' : 'none' }} />
                    </Link>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px 16px' }}>
                    <div className="col" style={{ alignItems: 'center', gap: 6 }}>
                      <CheckSquare size={36} className="subtle" />
                      <b style={{ color: 'var(--forest-dark)' }}>{localize('قطار بالکل صاف ہے', 'Queue bilkul saaf hai', 'Queue is clear')}</b>
                      <span className="small subtle">
                        {localize(
                          'اس وقت کوئی کیس انسانی جائزے کے لیے منتظر نہیں ہے۔',
                          'Is waqt koi case insani jaize ke liye muntazir nahi hai.',
                          'No cases currently pending human adjudication.'
                        )}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
