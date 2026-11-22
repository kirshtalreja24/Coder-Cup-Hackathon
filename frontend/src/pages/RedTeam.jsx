import { useEffect, useRef, useState } from 'react'
import {
  Flame,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Play,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  Activity,
  AlertTriangle,
  RotateCw,
  Lock,
  Fingerprint,
  Users,
  Eye,
  Zap,
  FileWarning,
  Code2,
  Database,
  Link,
  BarChart2,
  Terminal,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Cpu,
  RadioTower,
  Star
} from 'lucide-react'
import { apiPost, apiGet } from '../api'
import { ErrorBox } from '../ui'

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const FOREST    = '#173D32'
const FOREST_DK = '#0D2318'
const GOLD      = '#C49A56'
const GOLD_SOFT = 'rgba(196,154,86,0.12)'
const GOLD_MED  = 'rgba(196,154,86,0.25)'
const IVORY     = '#F5F0E6'
const CREAM     = '#FDFBF7'
const RED       = '#DC2626'
const RED_SOFT  = '#FEF2F2'
const RED_BRD   = '#FECACA'
const GREEN     = '#16A34A'
const GREEN_SOFT = '#F0FDF4'
const GREEN_BRD = '#BBF7D0'
const AMBER     = '#D97706'

/* ═══════════════════════════════════════════════════════════
   CATEGORY METADATA — maps backend category strings to UI
═══════════════════════════════════════════════════════════ */
const CAT_META = {
  security: {
    label:    'Authentication & Access',
    icon:     Lock,
    color:    '#7C3AED',
    bg:       'rgba(124,58,237,0.08)',
    border:   'rgba(124,58,237,0.2)',
    desc:     'JWT forgery, role escalation, public API key abuse, rate limiting',
  },
  privacy: {
    label:    'Data Privacy & PII',
    icon:     Eye,
    color:    '#0369A1',
    bg:       'rgba(3,105,161,0.08)',
    border:   'rgba(3,105,161,0.2)',
    desc:     'PII masking, auditor data access boundaries',
  },
  consent: {
    label:    'Consent Enforcement',
    icon:     Fingerprint,
    color:    FOREST,
    bg:       'rgba(23,61,50,0.08)',
    border:   'rgba(23,61,50,0.2)',
    desc:     'Real-time consent revocation, payment consent gating',
  },
  'ai-safety': {
    label:    'Prompt Injection',
    icon:     Zap,
    color:    '#B45309',
    bg:       'rgba(180,83,9,0.08)',
    border:   'rgba(180,83,9,0.2)',
    desc:     'Adversarial text in form fields attempting to override AI decisions',
  },
  'bad-data': {
    label:    'Input Adversarial / Garbage',
    icon:     FileWarning,
    color:    '#6B7280',
    bg:       'rgba(107,114,128,0.08)',
    border:   'rgba(107,114,128,0.2)',
    desc:     'SQL injection, XSS payloads, malformed images, missing fields',
  },
  fraud: {
    label:    'Identity Forgery',
    icon:     ShieldAlert,
    color:    RED,
    bg:       'rgba(220,38,38,0.07)',
    border:   'rgba(220,38,38,0.18)',
    desc:     'Edited ID cards, QR signature invalidation, forged document uploads',
  },
  reliability: {
    label:    'Reliability & Upload Limits',
    icon:     RadioTower,
    color:    '#374151',
    bg:       'rgba(55,65,81,0.07)',
    border:   'rgba(55,65,81,0.15)',
    desc:     'Oversized file uploads, edge-case form validation',
  },
  'ai-uncertainty': {
    label:    'AI Uncertainty Handling',
    icon:     Cpu,
    color:    '#0E7490',
    bg:       'rgba(14,116,144,0.08)',
    border:   'rgba(14,116,144,0.2)',
    desc:     'Blurry photos, name spelling variations — system must abstain, not guess',
  },
  rules: {
    label:    'Rule Manipulation',
    icon:     Code2,
    color:    '#6D28D9',
    bg:       'rgba(109,40,217,0.07)',
    border:   'rgba(109,40,217,0.18)',
    desc:     'Live rule publishing, Digital Twin replay, version pinning on past decisions',
  },
  audit: {
    label:    'Audit Integrity',
    icon:     Database,
    color:    FOREST,
    bg:       'rgba(23,61,50,0.08)',
    border:   'rgba(23,61,50,0.2)',
    desc:     'Hash-chain verification, tamper simulation detection',
  },
  scam: {
    label:    'Scam Shield',
    icon:     ShieldOff,
    color:    '#BE185D',
    bg:       'rgba(190,24,93,0.07)',
    border:   'rgba(190,24,93,0.18)',
    desc:     'Fake relief SMS detection, false-alarm rate, genuine message preservation',
  },
  guardrail: {
    label:    'Guardrails',
    icon:     Link,
    color:    AMBER,
    bg:       'rgba(217,119,6,0.08)',
    border:   'rgba(217,119,6,0.2)',
    desc:     'Large payout caps, automatic payment limit enforcement',
  },
}

function getCatMeta(cat) {
  return CAT_META[cat] || {
    label: cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: Activity,
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.08)',
    border: 'rgba(107,114,128,0.15)',
    desc: '',
  }
}

/* ═══════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════ */

function PassBadge({ passed }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: '0.68rem',
      fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.07em',
      background: passed ? GREEN_SOFT : RED_SOFT,
      color: passed ? GREEN : RED,
      border: `1px solid ${passed ? GREEN_BRD : RED_BRD}`,
    }}>
      {passed
        ? <><CheckCircle2 size={11} /> PASS</>
        : <><XCircle size={11} /> FAIL</>
      }
    </span>
  )
}

function ScoreRing({ passed, total, size = 80 }) {
  const pct    = total > 0 ? passed / total : 0
  const r      = size / 2 - 8
  const circ   = 2 * Math.PI * r
  const dash   = pct * circ
  const color  = pct === 1 ? GREEN : pct >= 0.8 ? AMBER : RED

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={7} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="monospace">
        {passed}
      </text>
      <text x={size/2} y={size/2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">
        /{total}
      </text>
    </svg>
  )
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 999, transition: 'width 0.6s ease'
      }} />
    </div>
  )
}

/* Terminal-style scrolling lines during execution */
function TerminalLog({ lines }) {
  return (
    <div style={{
      background: '#0A1A14', border: `1px solid rgba(196,154,86,0.2)`,
      borderRadius: 10, padding: '14px 18px', fontFamily: 'monospace',
      fontSize: '0.74rem', color: '#6EE7B7', lineHeight: 1.7,
      maxHeight: 160, overflowY: 'auto'
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.color || '#6EE7B7' }}>
          <span style={{ color: 'rgba(196,154,86,0.5)', marginRight: 10 }}>{'>'}</span>
          {l.text}
        </div>
      ))}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GOLD }}>
        <span style={{ color: 'rgba(196,154,86,0.5)' }}>{'>'}</span>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '0.9rem' }}>⟳</span>
        <span>Executing attack vectors…</span>
      </div>
    </div>
  )
}

/* Individual test row — expandable */
function TestRow({ result, idx }) {
  const [open, setOpen] = useState(false)
  const actual = typeof result.actual === 'object'
    ? JSON.stringify(result.actual, null, 2)
    : String(result.actual ?? '—')

  return (
    <>
      <tr
        style={{
          background: idx % 2 === 0 ? '#fff' : IVORY,
          cursor: 'pointer',
          borderLeft: `3px solid ${result.passed ? 'transparent' : RED}`
        }}
        onClick={() => setOpen(o => !o)}
      >
        <td style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>
          {result.passed
            ? <CheckCircle2 size={16} style={{ color: GREEN, verticalAlign: 'middle' }} />
            : <XCircle     size={16} style={{ color: RED,   verticalAlign: 'middle' }} />
          }
        </td>
        <td style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#1F2937', lineHeight: 1.3 }}>
            {result.attack}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#9CA3AF', marginTop: 2 }}>
            {result.id}
          </div>
        </td>
        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#374151', maxWidth: 240 }}>
          {result.safe_behaviour}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <span style={{
            fontFamily: 'monospace', fontSize: '0.74rem', fontWeight: 600,
            color: result.passed ? GREEN : RED,
            background: result.passed ? GREEN_SOFT : RED_SOFT,
            border: `1px solid ${result.passed ? GREEN_BRD : RED_BRD}`,
            padding: '2px 8px', borderRadius: 6, display: 'inline-block'
          }}>
            {actual.length > 60 ? actual.slice(0, 57) + '…' : actual}
          </span>
        </td>
        <td style={{ padding: '10px 12px', width: 24, textAlign: 'center' }}>
          {open
            ? <ChevronDown size={14} style={{ color: '#9CA3AF' }} />
            : <ChevronRight size={14} style={{ color: '#9CA3AF' }} />
          }
        </td>
      </tr>
      {open && (
        <tr style={{ background: result.passed ? '#FAFFFE' : '#FFF8F8' }}>
          <td colSpan={5} style={{ padding: '0 12px 14px 50px' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              borderTop: `1px solid ${result.passed ? GREEN_BRD : RED_BRD}`,
              paddingTop: 12, marginTop: 2
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Expected Safe Behaviour
                </div>
                <div style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.5 }}>{result.safe_behaviour}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Actual System Response
                </div>
                <pre style={{
                  margin: 0, fontSize: '0.76rem', fontFamily: 'monospace',
                  color: result.passed ? '#065F46' : '#991B1B',
                  background: result.passed ? GREEN_SOFT : RED_SOFT,
                  border: `1px solid ${result.passed ? GREEN_BRD : RED_BRD}`,
                  padding: '8px 10px', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {actual}
                </pre>
              </div>
              {result.evidence != null && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Evidence / Detail
                  </div>
                  <pre style={{
                    margin: 0, fontSize: '0.73rem', fontFamily: 'monospace', color: '#374151',
                    background: '#F9FAFB', border: '1px solid #E5E7EB',
                    padding: '8px 10px', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                  }}>
                    {typeof result.evidence === 'object'
                      ? JSON.stringify(result.evidence, null, 2)
                      : String(result.evidence)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* Category section card */
function CategorySection({ cat, results }) {
  const [collapsed, setCollapsed] = useState(false)
  const meta    = getCatMeta(cat)
  const Icon    = meta.icon
  const passed  = results.filter(r => r.passed).length
  const total   = results.length
  const allPass = passed === total
  const anyFail = passed < total

  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${anyFail ? RED_BRD : meta.border}`,
      overflow: 'hidden',
      boxShadow: anyFail ? `0 0 0 1px rgba(220,38,38,0.08)` : '0 1px 4px rgba(0,0,0,0.04)'
    }}>
      {/* Category Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer',
          background: anyFail ? '#FFF5F5' : '#FFFFFF',
          borderBottom: collapsed ? 'none' : `1px solid ${anyFail ? RED_BRD : 'rgba(0,0,0,0.07)'}`,
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Category icon pill */}
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: meta.bg, border: `1px solid ${meta.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={15} style={{ color: meta.color }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937' }}>{meta.label}</div>
            {meta.desc && (
              <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 1 }}>{meta.desc}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Mini pass bar */}
          <div style={{ width: 80 }}>
            <div style={{ height: 4, background: 'rgba(0,0,0,0.07)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(passed / total) * 100}%`,
                background: allPass ? GREEN : anyFail ? RED : AMBER,
                borderRadius: 999
              }} />
            </div>
            <div style={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2, textAlign: 'center' }}>
              {passed}/{total}
            </div>
          </div>

          <span style={{
            fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace',
            padding: '3px 10px', borderRadius: 999,
            background: allPass ? GREEN_SOFT : RED_SOFT,
            color: allPass ? GREEN : RED,
            border: `1px solid ${allPass ? GREEN_BRD : RED_BRD}`
          }}>
            {allPass ? 'ALL PASS' : `${total - passed} FAIL`}
          </span>

          {collapsed
            ? <ChevronRight size={16} style={{ color: '#9CA3AF' }} />
            : <ChevronDown  size={16} style={{ color: '#9CA3AF' }} />
          }
        </div>
      </div>

      {/* Results table */}
      {!collapsed && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: IVORY }}>
                {['', 'Attack Vector', 'Expected Safe Behaviour', 'Actual Response', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700,
                    color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
                    borderBottom: '1px solid rgba(0,0,0,0.07)',
                    whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <TestRow key={r.id} result={r} idx={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   STATIC ATTACK MANIFEST — a preview of the attacks, shown before a run
   (categories and descriptions from backend source of truth)
═══════════════════════════════════════════════════════════ */
const ATTACK_MANIFEST = [
  { id: 'sec-01',  cat: 'security',         label: 'No auth token → GET /cases' },
  { id: 'sec-02',  cat: 'security',         label: 'Citizen calls auditor endpoint' },
  { id: 'sec-03',  cat: 'security',         label: 'Officer tries to edit rules (admin only)' },
  { id: 'sec-04',  cat: 'security',         label: 'JWT signed with wrong secret' },
  { id: 'sec-05',  cat: 'security',         label: 'JWT alg=none bypass attempt' },
  { id: 'sec-06',  cat: 'security',         label: 'Citizen token tampered to claim admin' },
  { id: 'sec-07',  cat: 'security',         label: 'Citizen tries to publish rules' },
  { id: 'sec-08',  cat: 'security',         label: 'Public API without API key' },
  { id: 'sec-09',  cat: 'security',         label: 'Public API with invalid API key' },
  { id: 'sec-10',  cat: 'security',         label: 'API key rate limit hammered 5×' },
  { id: 'sec-11',  cat: 'security',         label: 'API key used outside its granted scope' },
  { id: 'sec-12',  cat: 'security',         label: 'Cross-tenant case read (tenant isolation)' },
  { id: 'sec-13',  cat: 'privacy',          label: 'Auditor opens case — PII masking check' },
  { id: 'sec-14',  cat: 'security',         label: 'Auditor (read-only) tries to approve a claim' },
  { id: 'sec-15',  cat: 'security',         label: 'Admin tries to decide a claim (separation of duties)' },
  { id: 'con-01',  cat: 'consent',          label: 'Officer reads case WITH consent granted' },
  { id: 'con-02',  cat: 'consent',          label: 'Consent withdrawn — data must redact immediately' },
  { id: 'con-03',  cat: 'consent',          label: 'Officer tries to approve after consent withdrawn' },
  { id: 'con-04',  cat: 'consent',          label: 'Officer opens documents without document consent' },
  { id: 'con-05',  cat: 'consent',          label: 'Withdrawal appears in audit log' },
  { id: 'con-06',  cat: 'consent',          label: 'Claim submitted with zero consent granted' },
  { id: 'ai-01',   cat: 'ai-safety',        label: 'Prompt injection in applicant name field' },
  { id: 'ai-02',   cat: 'bad-data',         label: 'SQL injection / XSS / absurd values in form' },
  { id: 'ai-03',   cat: 'bad-data',         label: 'Name misspelling + missing DOB + wrong ID digit' },
  { id: 'ai-04',   cat: 'bad-data',         label: 'Only CNIC supplied — almost everything missing' },
  { id: 'ai-05',   cat: 'fraud',            label: 'Upload edited ID card (QR signature invalid)' },
  { id: 'ai-06',   cat: 'bad-data',         label: 'Upload garbage bytes as photo' },
  { id: 'ai-07',   cat: 'reliability',      label: 'Upload 5 MB+ oversized file' },
  { id: 'ai-08',   cat: 'ai-uncertainty',   label: 'Blurry ID photo — system must not guess' },
  { id: 'ai-09',   cat: 'consent',          label: 'Eligible claim — payment consent withheld' },
  { id: 'scam-01', cat: 'scam',             label: 'Fake SMS from personal number asking for fee' },
  { id: 'scam-02', cat: 'scam',             label: 'Genuine BISP message from 8171' },
  { id: 'scam-03', cat: 'scam',             label: 'Utility bill SMS (false-alarm check)' },
  { id: 'scam-04', cat: 'scam',             label: 'Ambiguous junk text — must abstain, not block' },
  { id: 'rule-01', cat: 'rules',            label: 'Digital Twin replay — live rule must stay unchanged' },
  { id: 'rule-02', cat: 'rules',            label: 'Published rule applies to next case immediately' },
  { id: 'rule-03', cat: 'rules',            label: 'Past decision pinned to its original rule version' },
  { id: 'aud-01',  cat: 'audit',            label: 'Audit hash-chain integrity verification' },
  { id: 'aud-02',  cat: 'audit',            label: 'Tamper simulation — corruption must be detected' },
  { id: 'guard-01',cat: 'guardrail',        label: 'PKR 90,000 payout above auto-payment cap' },
]

const CAT_ORDER = ['security', 'privacy', 'consent', 'ai-safety', 'bad-data', 'fraud', 'reliability', 'ai-uncertainty', 'scam', 'rules', 'audit', 'guardrail']

/* Busy terminal log lines */
const LOG_LINES = [
  { text: 'Spinning up isolated sandbox department…', color: '#6EE7B7' },
  { text: 'Creating synthetic users: admin, officer, auditor, citizen, helper…', color: '#6EE7B7' },
  { text: 'Generating test CNIC and MockNadra registry entry…', color: '#6EE7B7' },
  { text: 'Publishing baseline eligibility ruleset…', color: '#6EE7B7' },
  { text: 'Acquiring authentication tokens for all roles…', color: '#6EE7B7' },
  { text: '[SEC] Launching authentication & access attacks (sec-01 → sec-15)…', color: GOLD },
  { text: '[CONSENT] Testing consent revocation real-time enforcement…', color: GOLD },
  { text: '[AI] Injecting adversarial text in name field (ai-01)…', color: GOLD },
  { text: '[FRAUD] Uploading forged ID card with invalid QR signature…', color: GOLD },
  { text: '[SCAM] Running scam classifier on 4 test messages…', color: GOLD },
  { text: '[RULES] Publishing stricter income cap; replaying next claim…', color: GOLD },
  { text: '[AUDIT] Verifying hash-chain integrity → simulating tamper…', color: GOLD },
  { text: '[GUARD] Submitting PKR 90,000 payout above auto-pay limit…', color: GOLD },
  { text: 'Collecting results and computing scorecard…', color: '#6EE7B7' },
]

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function RedTeam() {
  // The scorecard runs in the background on the server and fills in live, so it works even on a slow link.
  const [prog, setProg] = useState(null)
  const [err,  setErr]  = useState(null)
  const timer = useRef(null)

  const poll = async () => {
    try {
      const p = await apiGet('/redteam/progress', { timeout: 30000 })
      setProg(p)
      if (p.status === 'running') timer.current = setTimeout(poll, 1500)
    } catch (e) { setErr(e); timer.current = setTimeout(poll, 4000) }
  }
  useEffect(() => { poll(); return () => clearTimeout(timer.current) }, []) // eslint-disable-line

  const run = async () => {
    setErr(null); clearTimeout(timer.current)
    try {
      await apiPost('/redteam/start')
      setProg({ status: 'running', results: [], done: 0, passed: 0, expected: prog?.expected || 61, phase: 'starting' })
      poll()
    } catch (e) { setErr(e) }
  }

  const busy = prog?.status === 'running'
  const rows = prog?.results || []
  // Final scorecard when finished; a live partial one while the attacks are still running.
  const res = prog?.result || (rows.length ? (() => {
    const by = {}
    rows.forEach((r) => { const b = by[r.category] || (by[r.category] = [0, 0]); b[1] += 1; if (r.passed) b[0] += 1 })
    const ok = rows.filter((r) => r.passed).length
    return { results: rows, passed: ok, failed: rows.length - ok, total: rows.length, score: `${ok}/${rows.length}`,
      by_category: Object.fromEntries(Object.entries(by).map(([k, [a, b]]) => [k, `${a}/${b}`])),
      duration_s: prog.elapsed_s ?? 0, sandbox_department: 'running…', ran_at: 'running now', false_alarm_check: null }
  })() : null)
  const expected = prog?.expected || 61

  /* Derived from results */
  const cats    = res ? [...new Set(res.results.map(r => r.category))].sort((a, b) => (CAT_ORDER.indexOf(a) + 100) % 100 - (CAT_ORDER.indexOf(b) + 100) % 100) : []
  const passed  = res?.passed  ?? 0
  const failed  = res?.failed  ?? 0
  const total   = res?.total   ?? 0
  const score   = res?.score   ?? '—'
  const allPass = res && failed === 0 && !busy

  /* Category breakdown with pass/fail */
  const catStats = res
    ? Object.entries(res.by_category).map(([k, v]) => {
        const [p, t] = v.split('/').map(Number)
        return { key: k, passed: p, total: t, label: getCatMeta(k).label }
      })
    : []

  /* ═══════════ RENDER ═══════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ══════════════════════════════════════════
          HEADER BANNER
      ══════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(135deg, ${FOREST_DK} 0%, ${FOREST} 55%, #1D4A3D 100%)`,
        borderRadius: 16, padding: '32px 36px',
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(13,35,24,0.35), inset 0 1px 0 rgba(196,154,86,0.2)`
      }}>
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: `linear-gradient(${GOLD} 1px, transparent 1px), linear-gradient(90deg, ${GOLD} 1px, transparent 1px)`,
          backgroundSize: '28px 28px'
        }} />
        {/* Radial glow left */}
        <div style={{
          position: 'absolute', top: -80, left: -80, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          {/* Left */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Flame size={20} style={{ color: '#FCA5A5' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(252,165,165,0.8)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  BHAROSA · ADVERSARIAL SECURITY TESTING SUITE
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                  Isolated Sandbox · Real HTTP Semantics · Zero Production Impact
                </div>
              </div>
            </div>

            <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, color: CREAM, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Red Team Security Center
            </h1>
            <p style={{ margin: '10px 0 0', fontSize: '1.0rem', color: 'rgba(253,251,247,0.65)', maxWidth: 540, lineHeight: 1.6 }}>
              {expected} adversarial scenarios. One accountable system.
              <br />
              <span style={{ color: 'rgba(252,165,165,0.8)', fontSize: '0.88rem' }}>
                Every attack states what a safe system <em>must</em> do. Failures are shown, not hidden.
              </span>
            </p>
          </div>

          {/* Right — score ring or scenario count */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            {res ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <ScoreRing passed={passed} total={total} size={90} />
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Security Score
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: allPass ? '#6EE7B7' : '#FCA5A5', lineHeight: 1 }}>
                    {score}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {res.duration_s}s · {res.sandbox_department}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(196,154,86,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Attack Scenarios
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: GOLD, lineHeight: 1 }}>
                  {expected}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  Across {Object.keys(CAT_META).length} attack categories
                </div>
              </div>
            )}

            <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
              {res ? `Last run: ${res.ran_at}` : 'Awaiting execution'}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          INFO BANNER
      ══════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: 'rgba(220,38,38,0.05)', border: '1.5px solid rgba(220,38,38,0.15)',
        borderRadius: 10, padding: '12px 18px'
      }}>
        <Info size={16} style={{ color: RED, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.6 }}>
          <strong>Real behaviour over claims:</strong> This suite launches{' '}
          <strong>{total || expected} real attack vectors</strong> — forged authentication tokens,
          privilege escalation, consent revocation bypass, forged national IDs, prompt injection,
          rule tampering, and audit-chain corruption — against the running server in an isolated sandbox department.
          Failures are displayed transparently. <strong>No production data is touched.</strong>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SCORECARD — shown after results
      ══════════════════════════════════════════ */}
      {res && (
        <div style={{
          background: `linear-gradient(135deg, ${FOREST_DK} 0%, #1A4035 100%)`,
          borderRadius: 14, padding: '22px 26px',
          boxShadow: `0 6px 24px rgba(13,35,24,0.25), inset 0 1px 0 rgba(196,154,86,0.15)`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <ShieldCheck size={16} style={{ color: GOLD }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(196,154,86,0.8)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Security Scorecard
            </span>
          </div>

          {/* Top 4 KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Scenarios', value: total, color: GOLD, icon: Activity },
              { label: 'Passed',          value: passed, color: '#6EE7B7', icon: CheckCircle2 },
              { label: 'Failed',          value: failed, color: failed > 0 ? '#FCA5A5' : '#6EE7B7', icon: failed > 0 ? XCircle : CheckCircle2 },
              { label: 'Duration',        value: `${res.duration_s}s`, color: 'rgba(255,255,255,0.7)', icon: Clock },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Icon size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {label}
                  </div>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Category breakdown bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {catStats.map(({ key, passed: p, total: t, label }) => {
              const meta = getCatMeta(key)
              const pct  = t > 0 ? (p / t) * 100 : 0
              const fail = t - p
              return (
                <div key={key} style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '10px 12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                      {meta.label}
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700,
                      color: fail > 0 ? '#FCA5A5' : '#6EE7B7'
                    }}>
                      {p}/{t}
                    </span>
                  </div>
                  <ProgressBar value={p} max={t} color={fail > 0 ? RED : '#059669'} />
                </div>
              )
            })}
          </div>

          {/* False-alarm check */}
          {res.false_alarm_check && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 9,
              background: 'rgba(196,154,86,0.08)', border: `1px solid ${GOLD_MED}`,
              display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap'
            }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(196,154,86,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Scam Classifier Performance
              </div>
              {[
                { label: 'False-Alarm Rate', value: res.false_alarm_check.scam_false_alarm_rate },
                { label: 'Scam Recall',       value: res.false_alarm_check.scam_recall },
                { label: 'Handed to Human',   value: res.false_alarm_check.handed_to_human },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: GOLD, fontSize: '0.95rem' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          ATTACK MANIFEST — pre-execution preview
      ══════════════════════════════════════════ */}
      {!res && !busy && prog && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <BookOpen size={15} style={{ color: GOLD }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: FOREST }}>Attack Scenario Manifest</div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 1 }}>
                A preview of {ATTACK_MANIFEST.length} of the {expected} attacks across {Object.keys(CAT_META).length} categories. The full set runs live against the server.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
            {CAT_ORDER.map((cat) => {
              const catTests = ATTACK_MANIFEST.filter(a => a.cat === cat)
              if (!catTests.length) return null
              const meta = getCatMeta(cat)
              const Icon = meta.icon
              return (
                <div key={cat} style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={13} style={{ color: meta.color }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1F2937' }}>{meta.label}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.68rem', color: '#9CA3AF' }}>{catTests.length}</span>
                  </div>
                  {catTests.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#D1D5DB', marginTop: 6, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#9CA3AF', marginRight: 5 }}>{a.id}</span>
                        <span style={{ fontSize: '0.74rem', color: '#4B5563' }}>{a.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          EXECUTION PANEL
      ══════════════════════════════════════════ */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px 28px',
        border: `1.5px solid ${busy ? 'rgba(220,38,38,0.25)' : GOLD_MED}`,
        boxShadow: busy ? '0 0 0 3px rgba(220,38,38,0.08)' : `0 0 0 1px ${GOLD_SOFT}`
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Terminal size={16} style={{ color: GOLD }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: FOREST }}>Security Test Execution</span>
              {busy && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: 'monospace', fontSize: '0.65rem', padding: '2px 8px',
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                  borderRadius: 999, color: RED, animation: 'pulse 1.5s ease-in-out infinite'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block' }} />
                  <span>LIVE</span>
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280', maxWidth: 500, lineHeight: 1.6 }}>
              Runs all {expected} attack vectors live against the server in an isolated sandbox department.
              Takes ~30–90 seconds. No production data is modified.
              {res && <strong style={{ color: FOREST }}> Last run: {res.ran_at} · Score: {score}</strong>}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <button
              onClick={run}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', fontSize: '0.95rem', fontWeight: 800,
                background: busy
                  ? 'rgba(0,0,0,0.07)'
                  : `linear-gradient(135deg, ${FOREST_DK} 0%, ${FOREST} 100%)`,
                color: busy ? '#9CA3AF' : CREAM,
                border: `2px solid ${busy ? 'rgba(0,0,0,0.1)' : 'rgba(220,38,38,0.4)'}`,
                borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: busy ? 'none' : '0 4px 20px rgba(13,35,24,0.3)',
                letterSpacing: '0.01em', transition: 'all 0.2s ease', whiteSpace: 'nowrap'
              }}
            >
              {busy ? (
                <>
                  <div style={{
                    width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.2)',
                    borderTopColor: RED, borderRadius: '50%', animation: 'spin 0.7s linear infinite'
                  }} />
                  Executing {expected} Attack Vectors…
                </>
              ) : (
                <>
                  <Flame size={18} style={{ color: '#FCA5A5' }} />
                  {res ? 'Re-run Attack Suite' : 'Launch Attack Suite'}
                </>
              )}
            </button>

            {res && !busy && (
              <div style={{
                fontFamily: 'monospace', fontSize: '0.68rem', color: '#9CA3AF',
                display: 'flex', alignItems: 'center', gap: 5
              }}>
                <RotateCw size={11} />
                Re-run will create a new isolated sandbox
              </div>
            )}
          </div>
        </div>

        {/* Terminal log during execution */}
        {busy && (
          <div style={{ marginTop: 20 }}>
            <TerminalLog lines={LOG_LINES} />
          </div>
        )}

        <ErrorBox e={err} />
      </div>

      {/* ══════════════════════════════════════════
          RESULTS — GROUPED BY CATEGORY
      ══════════════════════════════════════════ */}
      {res && (
        <>
          {/* Overall verdict banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px',
            borderRadius: 12,
            background: allPass ? GREEN_SOFT : RED_SOFT,
            border: `2px solid ${allPass ? GREEN_BRD : RED_BRD}`
          }}>
            {allPass
              ? <ShieldCheck size={24} style={{ color: GREEN, flexShrink: 0 }} />
              : <ShieldAlert  size={24} style={{ color: RED,   flexShrink: 0 }} />
            }
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.0rem', color: allPass ? '#14532D' : '#7F1D1D' }}>
                {allPass
                  ? `All ${total} security scenarios passed — system behaviour verified`
                  : `${failed} scenario${failed > 1 ? 's' : ''} failed — review highlighted rows below`
                }
              </div>
              <div style={{ fontSize: '0.78rem', color: allPass ? '#166534' : '#991B1B', marginTop: 2 }}>
                {res.note}
              </div>
            </div>
          </div>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={16} style={{ color: GOLD }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: FOREST }}>
              Detailed Results by Attack Category
            </span>
            <span style={{
              marginLeft: 6, fontFamily: 'monospace', fontSize: '0.68rem', padding: '2px 9px',
              background: GOLD_SOFT, border: `1px solid ${GOLD_MED}`,
              borderRadius: 999, color: '#78531A'
            }}>
              Click any row to expand · Click header to collapse
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cats.map(cat => (
              <CategorySection
                key={cat}
                cat={cat}
                results={res.results.filter(r => r.category === cat)}
              />
            ))}
          </div>

          {/* Footnote */}
          <div style={{
            textAlign: 'center', fontSize: '0.74rem', color: '#9CA3AF',
            fontStyle: 'italic', padding: '0 24px'
          }}>
            {res.note}
          </div>
        </>
      )}

    </div>
  )
}
