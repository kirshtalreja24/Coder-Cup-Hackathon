import { useEffect, useRef, useState } from 'react'
import {
  Play,
  Send,
  RotateCcw,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  Sliders,
  FileText,
  Sparkles,
  History,
  Lock,
  Activity,
  BarChart2,
  GitBranch,
  Cpu,
  Shield,
  DollarSign,
  Users,
  Eye,
  RefreshCw,
  BookOpen,
  Zap,
  Star
} from 'lucide-react'
import { apiGet, apiPost, getUser, money, pct, when } from '../api'
import { ErrorBox, Spinner, useAsync } from '../ui'

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const GOLD      = '#C49A56'
const GOLD_SOFT = 'rgba(196,154,86,0.12)'
const GOLD_MED  = 'rgba(196,154,86,0.25)'
const FOREST    = '#173D32'
const FOREST_DK = '#0D2318'
const IVORY     = '#F5F0E6'
const CREAM     = '#FDFBF7'
const RED_SOFT  = 'rgba(192,80,70,0.12)'
const RED       = '#C05046'
const GREEN_SFT = 'rgba(23,61,50,0.10)'

/* ═══════════════════════════════════════════════════════════════
   ROUTE META
═══════════════════════════════════════════════════════════════ */
const ROUTE_META = {
  AUTO_APPROVE:       { label: 'Auto-Approved',      color: '#1A7A5E', bg: 'rgba(23,122,94,0.12)',   short: 'AUTO',    dot: '#1A7A5E' },
  HUMAN_REVIEW:       { label: 'Human Review',       color: '#2563EB', bg: 'rgba(37,99,235,0.10)',   short: 'HUMAN',   dot: '#2563EB' },
  ASK_PROOF:          { label: 'Proof Requested',    color: '#B45309', bg: 'rgba(180,83,9,0.10)',    short: 'PROOF',   dot: '#B45309' },
  DECLINE_WITH_APPEAL:{ label: 'Declined (Appeal)',  color: '#B91C1C', bg: 'rgba(185,28,28,0.09)',   short: 'DECLINE', dot: '#B91C1C' }
}

/* ═══════════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════════ */

function GoldDivider() {
  return (
    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD_MED}, transparent)`, margin: '4px 0' }} />
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: GOLD, opacity: 0.9, marginBottom: 4
    }}>
      {children}
    </div>
  )
}

function DeltaBadge({ value, inverted = false, format = (v) => v }) {
  if (value === 0 || value == null) {
    return <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9CA3AF' }}>—</span>
  }
  const worse = inverted ? value > 0 : value < 0
  const better = inverted ? value < 0 : value > 0
  const color = better ? '#059669' : worse ? '#DC2626' : '#6B7280'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color
    }}>
      {value > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {value > 0 ? '+' : ''}{format(value)}
    </span>
  )
}

/* SVG Donut — richer with shadow glow rings */
function DonutChart({ data, size = 140, label = '' }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0)
  if (!total) return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontFamily: 'monospace' }}>no data</span>
    </div>
  )

  const keys  = Object.keys(ROUTE_META).filter(k => data[k] > 0)
  const colors = keys.map(k => ROUTE_META[k].color)
  let cumAngle = -90

  const polar = (cx, cy, r, deg) => {
    const a = (deg * Math.PI) / 180
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  const r  = size / 2 - 12
  const cx = size / 2
  const cy = size / 2
  const inner = r * 0.58

  const slices = keys.map((k, i) => {
    const pct  = (data[k] / total) * 360
    const start = cumAngle
    cumAngle += pct
    return { key: k, pct, start, color: colors[i], count: data[k] }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {slices.map((s, i) => (
            <filter key={i} id={`glow-${i}`}>
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          ))}
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={r - inner + 1} />
        {slices.map((s, i) => {
          if (s.pct < 1) return null
          const start    = polar(cx, cy, (r + inner) / 2, s.start)
          const end      = polar(cx, cy, (r + inner) / 2, s.start + s.pct)
          const startO   = polar(cx, cy, r, s.start)
          const endO     = polar(cx, cy, r, s.start + s.pct)
          const startI   = polar(cx, cy, inner, s.start)
          const endI     = polar(cx, cy, inner, s.start + s.pct)
          const large    = s.pct > 180 ? 1 : 0
          return (
            <path
              key={s.key}
              d={`M ${startO.x} ${startO.y} A ${r} ${r} 0 ${large} 1 ${endO.x} ${endO.y} L ${endI.x} ${endI.y} A ${inner} ${inner} 0 ${large} 0 ${startI.x} ${startI.y} Z`}
              fill={s.color}
              opacity={0.88}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={inner - 1} fill="white" />
        <text x={cx} y={cy - 5} textAnchor="middle" fill={FOREST} fontSize="13" fontWeight="800">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#9CA3AF" fontSize="8" fontFamily="monospace">CASES</text>
        {label && (
          <text x={cx} y={cy + 22} textAnchor="middle" fill={GOLD} fontSize="7" fontFamily="monospace" letterSpacing="1">{label}</text>
        )}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {slices.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.68rem', color: '#374151', fontWeight: 500 }}>{ROUTE_META[s.key]?.short || s.key}</span>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: s.color }}>
              {s.count} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({((s.count / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Animated horizontal bar */
function ProgressBar({ value, max, color, animate = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 999, transition: animate ? 'width 0.6s ease' : 'none'
      }} />
    </div>
  )
}

/* Before / After route bar comparison */
function RouteBar({ routeKey, before, after, total }) {
  const meta  = ROUTE_META[routeKey]
  const pctB  = total > 0 ? ((before / total) * 100).toFixed(1) : 0
  const pctA  = total > 0 ? ((after  / total) * 100).toFixed(1) : 0
  const delta = after - before
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1F2937' }}>{meta.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6B7280' }}>{before} → </span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: meta.color }}>{after}</span>
          <DeltaBadge
            value={delta}
            inverted={routeKey === 'DECLINE_WITH_APPEAL'}
            format={v => (v > 0 ? '+' : '') + v}
          />
        </div>
      </div>
      {/* Two-track bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div>
          <div style={{ height: 7, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctB}%`, background: meta.color, opacity: 0.4, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: '0.6rem', color: '#9CA3AF', fontFamily: 'monospace' }}>CURRENT {pctB}%</span>
        </div>
        <div>
          <div style={{ height: 7, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctA}%`, background: meta.color, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: '0.6rem', color: meta.color, fontFamily: 'monospace', fontWeight: 600 }}>PROPOSED {pctA}%</span>
        </div>
      </div>
    </div>
  )
}

/* Cost waterfall bars */
function CostBar({ label, before, after, icon: Icon }) {
  const max   = Math.max(before, after, 1)
  const delta = after - before
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {Icon && <Icon size={12} style={{ color: GOLD }} />}
          <span style={{ fontSize: '0.76rem', fontWeight: 500, color: '#374151' }}>{label}</span>
        </div>
        <DeltaBadge value={delta} inverted={true} format={v => money(v)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#9CA3AF', width: 72, textAlign: 'right' }}>{money(before)}</span>
        <div style={{ flex: 1, position: 'relative', height: 10 }}>
          <div style={{ position: 'absolute', left: 0, top: 1, height: 8, width: `${(before / max) * 100}%`, background: '#D1D5DB', borderRadius: 999 }} />
          <div style={{ position: 'absolute', left: 0, top: 1, height: 8, width: `${(after / max) * 100}%`, background: delta < 0 ? '#059669' : delta > 0 ? '#DC2626' : '#6B7280', opacity: 0.75, borderRadius: 999 }} />
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: delta < 0 ? '#059669' : delta > 0 ? '#DC2626' : '#374151', width: 80 }}>{money(after)}</span>
      </div>
    </div>
  )
}

/* Lab card wrapper */
function LabCard({ children, style = {}, accent = false }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1.5px solid ${accent ? GOLD_MED : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 12,
      padding: '20px 22px',
      boxShadow: accent
        ? `0 0 0 1px ${GOLD_MED}, 0 4px 20px rgba(196,154,86,0.08)`
        : '0 1px 6px rgba(0,0,0,0.05)',
      ...style
    }}>
      {children}
    </div>
  )
}

/* Card header with icon */
function CardHeader({ icon: Icon, title, subtitle, badge, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${GOLD_SOFT}, rgba(196,154,86,0.06))`,
          border: `1px solid ${GOLD_MED}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={15} style={{ color: GOLD }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: FOREST, lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: 2 }}>{subtitle}</div>}
          {badge && <div style={{ marginTop: 4 }}>{badge}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

/* Confidence threshold display */
function ThresholdViz({ autoMin, proofMin }) {
  const zones = [
    { label: 'DECLINE / HUMAN', from: 0,       to: proofMin, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
    { label: 'PROOF REQUEST',   from: proofMin, to: autoMin,  color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    { label: 'AUTO-APPROVE',    from: autoMin,  to: 1,        color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative', height: 20, borderRadius: 999, overflow: 'hidden', background: 'rgba(0,0,0,0.05)' }}>
        {zones.map(z => (
          <div
            key={z.label}
            style={{
              position: 'absolute',
              left: `${z.from * 100}%`,
              width: `${(z.to - z.from) * 100}%`,
              height: '100%',
              background: z.bg,
              borderRight: `1px solid ${z.color}33`
            }}
          />
        ))}
        {/* Tick marks */}
        {[proofMin, autoMin].map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${p * 100}%`, top: 0, bottom: 0,
            width: 2, background: i === 0 ? '#D97706' : '#059669', transform: 'translateX(-50%)'
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'monospace' }}>
        <span style={{ color: '#EF4444' }}>0%</span>
        <span style={{ color: '#D97706' }}>{(proofMin * 100).toFixed(0)}% PROOF</span>
        <span style={{ color: '#059669' }}>{(autoMin * 100).toFixed(0)}% AUTO</span>
        <span style={{ color: '#059669' }}>100%</span>
      </div>
    </div>
  )
}

/* OPS selector */
const OPS = ['>=', '<=', '>', '<', '==', '!=']

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function DigitalTwin() {
  const me      = getUser()
  const isAdmin = me?.role === 'admin'

  const pubReq  = useAsync(() => apiGet('/rules/published'), [])
  const listReq = useAsync(() => apiGet('/rules'), [])

  /* Simulation state */
  const [draft,         setDraft]         = useState(null)
  const [twinResult,    setTwinResult]    = useState(null)
  const [simBusy,       setSimBusy]       = useState(false)
  const [simErr,        setSimErr]        = useState(null)

  /* Publish state */
  const [pubBusy,       setPubBusy]       = useState(false)
  const [pubErr,        setPubErr]        = useState(null)
  const [pubMsg,        setPubMsg]        = useState(null)
  const [confirmPublish,setConfirmPublish]= useState(false)
  const [publishNote,   setPublishNote]   = useState('')

  /* Config state */
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [openCaseIdx,       setOpenCaseIdx]        = useState(null)
  const [configSection,     setConfigSection]      = useState('conditions') // 'conditions' | 'costs' | 'thresholds'

  const [costMatrix, setCostMatrix] = useState({
    wrong_approval: 50000,
    human_review:   150,
    ask_proof:      40,
    wrongful_block: 2000
  })

  const [thresholds, setThresholds] = useState({
    auto_approve_min_p: 0.825,
    ask_proof_min_p:    0.55
  })

  /* Seed draft from live policy once */
  useEffect(() => {
    if (pubReq.data && !draft) {
      setDraft(JSON.parse(JSON.stringify(pubReq.data.definition)))
    }
  }, [pubReq.data])

  const resultsRef = useRef(null)

  if (pubReq.loading || !draft) return <Spinner label="Initialising Policy Simulation Laboratory…" />
  if (pubReq.error)             return <ErrorBox e={pubReq.error} />

  /* ---- helpers ---- */
  const setCond = (i, patch) =>
    setDraft({ ...draft, conditions: draft.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  const runSimulation = async () => {
    setSimBusy(true)
    setSimErr(null)
    setTwinResult(null)
    try {
      const res = await apiPost('/rules/twin', {
        definition:  draft,
        cost_matrix: costMatrix,
        thresholds
      })
      setTwinResult(res)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } catch (e) {
      setSimErr(e)
    } finally {
      setSimBusy(false)
    }
  }

  const handlePublish = async () => {
    setPubBusy(true)
    setPubErr(null)
    setPubMsg(null)
    try {
      const draftRes = await apiPost('/rules/draft', {
        definition: draft,
        note: publishNote || 'Published from Digital Twin Policy Lab'
      })
      const pub = await apiPost(`/rules/${draftRes.id}/publish`)
      setPubMsg(`Live update confirmed: v${pub.published_version} now effective across all decision endpoints.`)
      setConfirmPublish(false)
      pubReq.reload()
      listReq.reload()
      setTwinResult(null)
    } catch (e) {
      setPubErr(e)
    } finally {
      setPubBusy(false)
    }
  }

  const liveVersion    = pubReq.data?.version ?? 2
  const versionsHistory = listReq.data || []
  const tr             = twinResult

  /* Derived */
  const totalChanged     = tr?.changed_cases ?? 0
  const wrongApprovalDelta = tr?.delta?.wrong_approvals ?? 0
  const wrongfulDeclines = tr?.after?.wrongful_declines ?? 0
  const costDelta        = tr?.delta?.total_cost_pkr ?? 0

  /* ═══════════ RENDER ═══════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ══════════════════════════════════════════════
          LABORATORY HEADER BANNER
      ══════════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(135deg, ${FOREST_DK} 0%, #173D32 55%, #1D4A3D 100%)`,
        borderRadius: 16,
        padding: '32px 36px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(13,35,24,0.35), inset 0 1px 0 rgba(196,154,86,0.2)`
      }}>
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.045,
          backgroundImage: `linear-gradient(${GOLD} 1px, transparent 1px), linear-gradient(90deg, ${GOLD} 1px, transparent 1px)`,
          backgroundSize: '28px 28px'
        }} />
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 240, height: 240,
          background: `radial-gradient(circle, rgba(196,154,86,0.12) 0%, transparent 70%)`,
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          {/* Left text */}
          <div>
            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `rgba(196,154,86,0.18)`, border: `1px solid rgba(196,154,86,0.4)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FlaskConical size={19} style={{ color: GOLD }} />
              </div>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: `rgba(196,154,86,0.85)`, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  BHAROSA · POLICY SIMULATION LABORATORY
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                  Counterfactual Analysis · Zero Write-Through · Fully Reversible
                </div>
              </div>
            </div>

            <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, color: CREAM, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Digital Twin
            </h1>
            <p style={{ margin: '10px 0 0', fontSize: '1.0rem', color: 'rgba(253,251,247,0.68)', maxWidth: 520, lineHeight: 1.6 }}>
              Test policy changes before they affect real decisions. Adjust eligibility rules,
              cost parameters, and confidence thresholds — then replay against synthetic historical cases.
              <strong style={{ color: 'rgba(196,154,86,0.9)' }}> Nothing changes until you publish.</strong>
            </p>
          </div>

          {/* Right status pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            {/* Live policy box */}
            <div style={{
              background: 'rgba(196,154,86,0.12)', border: `1px solid rgba(196,154,86,0.3)`,
              borderRadius: 10, padding: '12px 18px', textAlign: 'right'
            }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(196,154,86,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Live Policy
              </div>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: '1.15rem', marginTop: 2 }}>
                v{liveVersion}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {pubReq.data?.definition?.title?.slice(0, 32) || 'Eligibility Rules'}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                Since {when(pubReq.data?.published_at)}
              </div>
            </div>

            {/* Sim status pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'monospace', fontSize: '0.72rem', padding: '6px 14px',
              background: tr ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${tr ? 'rgba(5,150,105,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 999, color: tr ? '#6EE7B7' : 'rgba(255,255,255,0.4)'
            }}>
              {tr ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>{tr.cases_replayed} cases simulated</span>
                </>
              ) : (
                <span>Awaiting simulation run</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SIMULATION DISCLAIMER
      ══════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: `linear-gradient(135deg, rgba(196,154,86,0.08), rgba(196,154,86,0.04))`,
        border: `1.5px solid ${GOLD_MED}`,
        borderRadius: 10, padding: '12px 18px'
      }}>
        <FlaskConical size={16} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: '0.8rem', color: '#4B3B1A', lineHeight: 1.6 }}>
          <strong>Simulation vs Publishing:</strong> Running a simulation has <em>zero effect</em> on the live system.
          It replays your draft rules against <strong>SYNTHETIC</strong> historical cases only.
          Publishing is a separate, audited, confirmed step available only to administrators.
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MAIN TWO-COLUMN LAYOUT
      ══════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,400px) 1fr', gap: 22, alignItems: 'start' }}>

        {/* ════════════════════════════════
            LEFT COLUMN — CONFIGURATION
        ════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Version Selector ── */}
          <LabCard>
            <CardHeader
              icon={Layers}
              title="Rule Version"
              subtitle="Load a historical policy snapshot as the baseline for simulation"
            />
            <select
              value={selectedVersionId || ''}
              onChange={(e) => {
                const id = e.target.value
                setSelectedVersionId(id)
                if (!id) {
                  setDraft(JSON.parse(JSON.stringify(pubReq.data.definition)))
                } else {
                  const v = versionsHistory.find(r => r.id === id)
                  if (v) setDraft(JSON.parse(JSON.stringify(v.definition)))
                }
                setTwinResult(null)
              }}
              style={{ background: IVORY, border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '8px 10px', fontSize: '0.85rem', width: '100%', color: FOREST }}
            >
              <option value="">v{liveVersion} — Live (Current Policy)</option>
              {versionsHistory.filter(v => v.id !== pubReq.data?.id).map(v => (
                <option key={v.id} value={v.id}>v{v.version} — {v.note || 'Historical Version'}</option>
              ))}
            </select>
          </LabCard>

          {/* ── Tab selector for config sections ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(0,0,0,0.07)', borderRadius: 10, padding: 3 }}>
            {[
              { key: 'conditions', label: 'Rules',       icon: FileText  },
              { key: 'costs',      label: 'Costs',       icon: DollarSign},
              { key: 'thresholds', label: 'Thresholds',  icon: Sparkles  }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setConfigSection(key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontWeight: configSection === key ? 700 : 500,
                  fontSize: '0.76rem',
                  background: configSection === key ? '#FFFFFF' : 'transparent',
                  color: configSection === key ? FOREST : '#6B7280',
                  boxShadow: configSection === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Eligibility Conditions ── */}
          {configSection === 'conditions' && (
            <LabCard>
              <CardHeader
                icon={FileText}
                title="Eligibility Conditions"
                subtitle="Modify rule conditions to test their impact on the case population"
                right={!isAdmin && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                    background: 'rgba(0,0,0,0.04)', borderRadius: 999,
                    fontSize: '0.68rem', color: '#9CA3AF'
                  }}>
                    <Lock size={10} /> Read-only
                  </div>
                )}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Programme Title</label>
                  <input
                    disabled={!isAdmin}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    style={{ width: '100%', background: isAdmin ? '#FFFFFF' : IVORY, border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '7px 10px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Disbursement Amount (PKR)
                  </label>
                  <input
                    disabled={!isAdmin}
                    type="number"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                    style={{ width: '100%', background: isAdmin ? '#FFFFFF' : IVORY, border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '7px 10px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <GoldDivider />

              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SectionLabel>Rule Conditions</SectionLabel>
                {draft.conditions.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      background: c.hard ? `linear-gradient(135deg, ${GREEN_SFT}, rgba(23,61,50,0.04))` : IVORY,
                      border: `1.5px solid ${c.hard ? 'rgba(23,61,50,0.25)' : 'rgba(0,0,0,0.07)'}`,
                      borderRadius: 10, padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: FOREST }}>{c.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {c.hard && (
                          <span style={{
                            fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em',
                            background: FOREST, color: '#fff', padding: '2px 7px', borderRadius: 999
                          }}>HARD FILTER</span>
                        )}
                        <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#9CA3AF' }}>{c.fact}</span>
                      </div>
                    </div>
                    {c.fact && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          disabled={!isAdmin}
                          value={c.op}
                          onChange={(e) => setCond(i, { op: e.target.value })}
                          style={{ width: 68, border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 7, padding: '5px 6px', fontSize: '0.82rem', background: isAdmin ? '#fff' : IVORY }}
                        >
                          {OPS.map(o => <option key={o}>{o}</option>)}
                        </select>
                        <input
                          disabled={!isAdmin}
                          value={c.value}
                          onChange={(e) => {
                            const v = e.target.value
                            setCond(i, { value: isNaN(Number(v)) || v === '' ? v : Number(v) })
                          }}
                          style={{ flex: 1, border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 7, padding: '5px 9px', fontSize: '0.85rem', background: isAdmin ? '#fff' : IVORY }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </LabCard>
          )}

          {/* ── Decision Cost Parameters ── */}
          {configSection === 'costs' && (
            <LabCard>
              <CardHeader
                icon={DollarSign}
                title="Decision Cost Parameters"
                subtitle="Asymmetric cost weights driving route selection in the decision engine"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { key: 'wrong_approval', label: 'Wrongful Approval Penalty', help: 'Cost of approving a fraudulent claim', min: 10000, max: 200000, step: 5000, color: '#DC2626' },
                  { key: 'wrongful_block',  label: 'Wrongful Decline Harm',     help: 'Cost of blocking a genuine applicant', min: 500,   max: 10000,  step: 500,  color: '#D97706' },
                  { key: 'human_review',    label: 'Human Review Cost',         help: 'Per-case officer processing cost',      min: 0,     max: 1000,   step: 10,   color: '#2563EB' },
                  { key: 'ask_proof',       label: 'Proof Request Cost',        help: 'Cost of a resubmission cycle',          min: 0,     max: 500,    step: 5,    color: '#D97706' }
                ].map(({ key, label, help, min, max, step, color }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1F2937' }}>{label}</div>
                        <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{help}</div>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color }}>
                        {costMatrix[key].toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step}
                      value={costMatrix[key]}
                      onChange={(e) => setCostMatrix({ ...costMatrix, [key]: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: color, height: 4 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#D1D5DB', fontFamily: 'monospace' }}>
                      <span>{min.toLocaleString()}</span>
                      <span>{max.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cost summary preview */}
              <div style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 8,
                background: `linear-gradient(135deg, rgba(196,154,86,0.07), rgba(196,154,86,0.03))`,
                border: `1px solid ${GOLD_MED}`, fontSize: '0.74rem', lineHeight: 1.8, color: '#4B3B1A',
                fontFamily: 'monospace'
              }}>
                <div>Fraud penalty: <strong>PKR {costMatrix.wrong_approval.toLocaleString()}</strong></div>
                <div>Human officer: <strong>PKR {costMatrix.human_review}/case</strong></div>
                <div>Proof cycle: <strong>PKR {costMatrix.ask_proof}/case</strong></div>
                <div>Wrongful block: <strong>PKR {costMatrix.wrongful_block}/case</strong></div>
              </div>
            </LabCard>
          )}

          {/* ── Confidence Thresholds ── */}
          {configSection === 'thresholds' && (
            <LabCard>
              <CardHeader
                icon={Sparkles}
                title="Confidence Thresholds"
                subtitle="P(genuine) probability thresholds that determine which route each case takes"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  {
                    key: 'auto_approve_min_p', label: 'Auto-Approve Minimum', min: 60, max: 99, step: 0.5,
                    color: '#059669', desc: 'P ≥ this → system auto-approves without human review'
                  },
                  {
                    key: 'ask_proof_min_p', label: 'Proof Request Minimum', min: 30, max: 80, step: 0.5,
                    color: '#D97706', desc: 'P ≥ this AND below auto threshold → system requests additional proof'
                  }
                ].map(({ key, label, min, max, step, color, desc }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1F2937' }}>{label}</div>
                        <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{desc}</div>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.0rem', color }}>
                        {(thresholds[key] * 100).toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step}
                      value={thresholds[key] * 100}
                      onChange={(e) => setThresholds({ ...thresholds, [key]: Number(e.target.value) / 100 })}
                      style={{ width: '100%', accentColor: color }}
                    />
                  </div>
                ))}

                {/* Visual route map */}
                <div style={{ marginTop: 4 }}>
                  <SectionLabel>Decision Route Map</SectionLabel>
                  <ThresholdViz
                    autoMin={thresholds.auto_approve_min_p}
                    proofMin={thresholds.ask_proof_min_p}
                  />
                  <div style={{ marginTop: 10, fontSize: '0.72rem', lineHeight: 1.7, color: '#374151', fontFamily: 'monospace' }}>
                    P ≥ <span style={{ color: '#059669', fontWeight: 700 }}>{(thresholds.auto_approve_min_p * 100).toFixed(1)}%</span> → AUTO-APPROVE<br />
                    P ≥ <span style={{ color: '#D97706', fontWeight: 700 }}>{(thresholds.ask_proof_min_p * 100).toFixed(1)}%</span> → REQUEST PROOF<br />
                    P {'<'} <span style={{ color: '#D97706', fontWeight: 700 }}>{(thresholds.ask_proof_min_p * 100).toFixed(1)}%</span> → HUMAN REVIEW / DECLINE
                  </div>
                </div>
              </div>
            </LabCard>
          )}

          {/* ── RUN SIMULATION BUTTON ── */}
          <button
            onClick={runSimulation}
            disabled={simBusy}
            style={{
              width: '100%', padding: '16px 20px', fontSize: '1.0rem', fontWeight: 800,
              background: simBusy
                ? 'rgba(0,0,0,0.08)'
                : `linear-gradient(135deg, ${FOREST_DK} 0%, ${FOREST} 100%)`,
              color: simBusy ? '#9CA3AF' : CREAM,
              border: `2px solid ${simBusy ? 'rgba(0,0,0,0.1)' : GOLD_MED}`,
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: simBusy ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              boxShadow: simBusy ? 'none' : `0 4px 20px rgba(13,35,24,0.3), inset 0 1px 0 rgba(196,154,86,0.2)`,
              transition: 'all 0.2s ease'
            }}
          >
            {simBusy ? (
              <>
                <div style={{
                  width: 18, height: 18,
                  border: '2.5px solid rgba(255,255,255,0.2)',
                  borderTopColor: GOLD, borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                <span>Running Policy Simulation…</span>
              </>
            ) : (
              <>
                <Play size={18} />
                <span>Run Simulation on Historical Cases</span>
              </>
            )}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => {
              setDraft(JSON.parse(JSON.stringify(pubReq.data.definition)))
              setCostMatrix({ wrong_approval: 50000, human_review: 150, ask_proof: 40, wrongful_block: 2000 })
              setThresholds({ auto_approve_min_p: 0.825, ask_proof_min_p: 0.55 })
              setTwinResult(null)
              setSelectedVersionId(null)
            }}
            style={{
              width: '100%', padding: '10px', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10,
              background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 600, color: '#6B7280'
            }}
          >
            <RotateCcw size={13} />
            Reset to Live v{liveVersion} Defaults
          </button>

          {simErr && <ErrorBox e={simErr} />}
        </div>

        {/* ════════════════════════════════
            RIGHT COLUMN — RESULTS
        ════════════════════════════════ */}
        <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── EMPTY STATE ── */}
          {!tr && !simBusy && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 18, padding: '80px 32px',
              background: `linear-gradient(135deg, ${IVORY}, rgba(245,240,230,0.5))`,
              border: `2px dashed rgba(196,154,86,0.3)`, borderRadius: 16, textAlign: 'center',
              minHeight: 320
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: `radial-gradient(circle, rgba(196,154,86,0.15), rgba(196,154,86,0.04))`,
                border: `1.5px solid ${GOLD_MED}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Activity size={30} style={{ color: GOLD }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: FOREST, letterSpacing: '-0.01em' }}>
                  Policy Lab Ready
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#6B7280', maxWidth: 380, lineHeight: 1.6 }}>
                  Configure rule conditions, decision costs, and confidence thresholds on the left,
                  then click <strong>Run Simulation</strong> to replay against{' '}
                  {pubReq.data ? '214' : '—'} synthetic historical cases.
                </p>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'monospace', fontSize: '0.72rem',
                background: GOLD_SOFT, border: `1px solid ${GOLD_MED}`,
                borderRadius: 999, padding: '6px 14px', color: '#78531A'
              }}>
                <FlaskConical size={12} />
                Non-destructive · No live data modified · Synthetic dataset only
              </div>
            </div>
          )}

          {/* ── SIMULATION RESULTS ── */}
          {tr && (
            <>
              {/* ─ KPI Header Row ─ */}
              <div style={{
                background: `linear-gradient(135deg, ${FOREST_DK} 0%, #1A4035 100%)`,
                borderRadius: 14, padding: '22px 26px',
                boxShadow: `0 6px 24px rgba(13,35,24,0.25), inset 0 1px 0 rgba(196,154,86,0.15)`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(196,154,86,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      Simulation Complete · Counterfactual Replay
                    </div>
                    <div style={{ color: CREAM, fontWeight: 800, fontSize: '1.3rem', marginTop: 4 }}>
                      {tr.cases_replayed} Historical Cases Evaluated
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.72rem', padding: '4px 12px',
                      background: GOLD_SOFT, border: `1px solid ${GOLD_MED}`,
                      borderRadius: 999, color: GOLD
                    }}>
                      Live v{tr.live_rule_version} → Proposed
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.72rem', padding: '4px 12px',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 999, color: 'rgba(255,255,255,0.5)'
                    }}>
                      Synthetic only
                    </span>
                  </div>
                </div>

                {/* 5 KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  {[
                    {
                      label: 'Cases Replayed',
                      value: tr.cases_replayed,
                      sub: 'Synthetic corpus',
                      color: GOLD,
                      icon: Activity
                    },
                    {
                      label: 'Routes Changed',
                      value: totalChanged,
                      sub: `${((totalChanged / tr.cases_replayed) * 100).toFixed(1)}% of corpus`,
                      color: totalChanged > 0 ? '#FCD34D' : '#6EE7B7',
                      icon: GitBranch
                    },
                    {
                      label: 'Wrongful Declines',
                      value: wrongfulDeclines,
                      sub: wrongfulDeclines > 0 ? 'Genuine applicants blocked' : 'No collateral impact',
                      color: wrongfulDeclines > 0 ? '#FCA5A5' : '#6EE7B7',
                      icon: Users
                    },
                    {
                      label: 'Fraud Leakage Δ',
                      value: (wrongApprovalDelta > 0 ? '+' : '') + wrongApprovalDelta,
                      sub: wrongApprovalDelta < 0 ? 'Fewer wrong approvals' : wrongApprovalDelta > 0 ? 'MORE wrong approvals' : 'No change',
                      color: wrongApprovalDelta > 0 ? '#FCA5A5' : wrongApprovalDelta < 0 ? '#6EE7B7' : 'rgba(255,255,255,0.4)',
                      icon: Shield
                    },
                    {
                      label: 'Est. Cost Δ',
                      value: costDelta === 0 ? '—' : (costDelta > 0 ? '+' : '') + 'PKR ' + Math.abs(costDelta / 1000).toFixed(0) + 'K',
                      sub: costDelta < 0 ? 'Net cost reduction' : costDelta > 0 ? 'Net cost increase' : 'No cost change',
                      color: costDelta > 0 ? '#FCA5A5' : costDelta < 0 ? '#6EE7B7' : 'rgba(255,255,255,0.4)',
                      icon: DollarSign
                    }
                  ].map(({ label, value, sub, color, icon: Icon }) => (
                    <div key={label} style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '12px 14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <Icon size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {label}
                        </div>
                      </div>
                      <div style={{ fontSize: '1.55rem', fontWeight: 800, color, lineHeight: 1.1, fontFamily: 'monospace' }}>
                        {value}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.3 }}>
                        {sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─ Verdict Banners ─ */}
              {tr.summary?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tr.summary.map((s, i) => {
                    const isWarn = s.startsWith('WARNING') || s.includes('blocked') || s.includes('more wrong') || s.includes('MORE')
                    const isGood = s.includes('reduced') || s.includes('decreases') || s.includes('fewer') || s.includes('Lower')
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                        borderRadius: 10, border: `1.5px solid ${isWarn ? '#FECACA' : isGood ? '#BBF7D0' : '#FEF08A'}`,
                        background: isWarn ? '#FEF2F2' : isGood ? '#F0FDF4' : '#FEFCE8'
                      }}>
                        {isWarn
                          ? <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                          : isGood
                          ? <CheckCircle2 size={16} style={{ color: '#16A34A', flexShrink: 0, marginTop: 1 }} />
                          : <Info size={16} style={{ color: '#CA8A04', flexShrink: 0, marginTop: 1 }} />
                        }
                        <span style={{ fontSize: '0.82rem', lineHeight: 1.5, color: '#1F2937' }}>{s}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─ BEFORE VS AFTER SECTION ─ */}
              <LabCard>
                <CardHeader
                  icon={BarChart2}
                  title="Before vs After — Decision Distribution"
                  subtitle="How the proposed configuration shifts case routing compared to the current live policy"
                  badge={
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.65rem', padding: '2px 8px',
                      background: 'rgba(23,61,50,0.08)', border: '1px solid rgba(23,61,50,0.15)',
                      borderRadius: 999, color: FOREST
                    }}>Synthetic Dataset Only</span>
                  }
                />

                {/* Donut pair */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'center', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                      Current · v{tr.live_rule_version}
                    </div>
                    <DonutChart data={tr.before.routes} size={160} label="CURRENT" />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'center', color: FOREST, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10 }}>
                      Proposed · Draft
                    </div>
                    <DonutChart data={tr.after.routes} size={160} label="PROPOSED" />
                  </div>
                </div>

                <GoldDivider />

                {/* Bar comparison per route */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                  {Object.entries(ROUTE_META).map(([route]) => (
                    <RouteBar
                      key={route}
                      routeKey={route}
                      before={tr.before.routes[route] || 0}
                      after={tr.after.routes[route]  || 0}
                      total={tr.cases_replayed}
                    />
                  ))}
                </div>
              </LabCard>

              {/* ─ COST COMPARISON ─ */}
              <LabCard>
                <CardHeader
                  icon={DollarSign}
                  title="Cost Analysis"
                  subtitle="Expected programme expenditure and operational costs under current vs proposed policy"
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <CostBar
                    label="Auto-Disbursement Total (PKR)"
                    before={tr.before.auto_spend_pkr}
                    after={tr.after.auto_spend_pkr}
                    icon={Zap}
                  />
                  <CostBar
                    label="Total Expected Program Cost (PKR)"
                    before={tr.before.total_cost_pkr}
                    after={tr.after.total_cost_pkr}
                    icon={DollarSign}
                  />
                </div>

                {/* Per-case cost */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                  {[
                    { label: 'Avg Cost / Case — Current', val: `PKR ${tr.before.avg_cost_per_case_pkr}`, accent: false },
                    { label: 'Avg Cost / Case — Proposed', val: `PKR ${tr.after.avg_cost_per_case_pkr}`, accent: true  }
                  ].map(({ label, val, accent }) => (
                    <div key={label} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: accent ? GOLD_SOFT : IVORY,
                      border: `1.5px solid ${accent ? GOLD_MED : 'rgba(0,0,0,0.07)'}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.68rem', color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.0rem', color: accent ? '#78531A' : FOREST }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              </LabCard>

              {/* ─ FULL METRICS TABLE ─ */}
              <LabCard>
                <CardHeader
                  icon={Eye}
                  title="Full Comparison Metrics"
                  subtitle="Detailed side-by-side metric comparison between current and proposed configuration"
                />
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(0,0,0,0.07)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: `linear-gradient(135deg, ${FOREST_DK}, ${FOREST})` }}>
                        {['Metric', `Current (v${tr.live_rule_version})`, 'Proposed', 'Change'].map((h, i) => (
                          <th key={h} style={{
                            padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right',
                            fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700,
                            color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em',
                            whiteSpace: 'nowrap'
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Auto-Approval Rate',               a: pct(tr.before.auto_rate, 1), b: pct(tr.after.auto_rate, 1), delta: <DeltaBadge value={tr.delta.auto_rate} format={v => (v * 100).toFixed(1) + 'pp'} /> },
                        { label: 'Human Review Rate',                 a: pct(tr.before.human_rate, 1), b: pct(tr.after.human_rate, 1), delta: <DeltaBadge value={tr.delta.human_rate} inverted format={v => (v * 100).toFixed(1) + 'pp'} /> },
                        { label: 'Wrong Approvals (Fraud Paid)',      a: tr.before.wrong_approvals, b: tr.after.wrong_approvals, delta: <DeltaBadge value={tr.delta.wrong_approvals} inverted format={v => (v > 0 ? '+' : '') + v} /> },
                        { label: 'Genuine Applicants Newly Blocked',  a: 0, b: tr.after.wrongful_declines, delta: <DeltaBadge value={tr.after.wrongful_declines} inverted format={v => v} /> },
                        { label: 'Genuine Applicants Waiting',        a: tr.before.genuine_people_waiting, b: tr.after.genuine_people_waiting, delta: <DeltaBadge value={tr.after.genuine_people_waiting - tr.before.genuine_people_waiting} inverted format={v => (v > 0 ? '+' : '') + v} /> },
                        { label: 'Auto-Disbursement Total',           a: money(tr.before.auto_spend_pkr), b: money(tr.after.auto_spend_pkr), delta: <DeltaBadge value={tr.delta.auto_spend_pkr} format={v => money(v)} /> },
                        { label: 'Total Expected Program Cost',       a: money(tr.before.total_cost_pkr), b: money(tr.after.total_cost_pkr), delta: <DeltaBadge value={tr.delta.total_cost_pkr} inverted format={v => money(v)} /> }
                      ].map(({ label, a, b, delta }, ri) => (
                        <tr key={label} style={{ background: ri % 2 === 0 ? '#FFFFFF' : IVORY }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1F2937' }}>{label}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#9CA3AF' }}>{a}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: FOREST }}>{b}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{delta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </LabCard>

              {/* ─ CASE-LEVEL TRANSITION TABLE ─ */}
              {tr.transitions?.length > 0 && (
                <LabCard>
                  <CardHeader
                    icon={GitBranch}
                    title="Decision Route Transitions"
                    subtitle={`${tr.changed_cases} cases would switch routes under the proposed configuration`}
                  />

                  {/* Transition flow chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {tr.transitions.map((t, i) => {
                      const fm = ROUTE_META[t.from] || { label: t.from, color: '#9CA3AF', bg: '#F9FAFB', short: t.from }
                      const tm = ROUTE_META[t.to]   || { label: t.to,   color: '#9CA3AF', bg: '#F9FAFB', short: t.to   }
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                          background: IVORY, borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.08)'
                        }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', background: fm.bg, color: fm.color, padding: '2px 8px', borderRadius: 6 }}>
                            {fm.short}
                          </span>
                          <ArrowRight size={13} style={{ color: '#9CA3AF' }} />
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', background: tm.bg, color: tm.color, padding: '2px 8px', borderRadius: 6 }}>
                            {tm.short}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: FOREST, fontSize: '0.88rem' }}>{t.count}</span>
                          <span style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>cases</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Individual case sample */}
                  {tr.sample_changes?.length > 0 && (
                    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(0,0,0,0.07)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: IVORY }}>
                            {['Case ID', 'Ground Truth', 'Current Route', 'Proposed Route', 'Verdict Change'].map((h, i) => (
                              <th key={h} style={{
                                padding: '9px 12px', textAlign: 'left',
                                fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 700,
                                color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
                                borderBottom: '1px solid rgba(0,0,0,0.07)'
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tr.sample_changes.map((s, i) => {
                            const fm = ROUTE_META[s.from] || { label: s.from, color: '#9CA3AF', bg: '#F9FAFB' }
                            const tm = ROUTE_META[s.to]   || { label: s.to,   color: '#9CA3AF', bg: '#F9FAFB' }
                            const isExpanded = openCaseIdx === i
                            return (
                              <tr
                                key={i}
                                style={{ background: i % 2 === 0 ? '#fff' : IVORY, cursor: 'pointer' }}
                                onClick={() => setOpenCaseIdx(isExpanded ? null : i)}
                              >
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', color: FOREST, fontWeight: 700 }}>
                                  {s.case_id}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{
                                    fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace',
                                    padding: '2px 8px', borderRadius: 999,
                                    background: s.truth === 'legit' ? '#DCFCE7' : '#FEE2E2',
                                    color: s.truth === 'legit' ? '#15803D' : '#B91C1C'
                                  }}>
                                    {s.truth === 'legit' ? 'GENUINE' : 'FRAUD'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', background: fm.bg, color: fm.color, padding: '2px 8px', borderRadius: 6 }}>
                                    {s.from}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', background: tm.bg, color: tm.color, padding: '2px 8px', borderRadius: 6 }}>
                                    {s.to}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.76rem', color: '#6B7280' }}>
                                  {s.verdict_before} → {s.verdict_after}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </LabCard>
              )}

              {/* Footnote */}
              <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.74rem', color: '#9CA3AF', padding: '0 20px' }}>
                {tr.note}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          POLICY PUBLISHING SECTION
      ══════════════════════════════════════════════ */}
      {pubMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
          background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10
        }}>
          <CheckCircle2 size={18} style={{ color: '#16A34A', flexShrink: 0 }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#14532D' }}>{pubMsg}</span>
        </div>
      )}

      {isAdmin && (
        <div style={{
          borderRadius: 16, overflow: 'hidden',
          border: `2px solid ${GOLD_MED}`,
          boxShadow: `0 4px 24px rgba(196,154,86,0.12)`
        }}>
          {/* Publishing header */}
          <div style={{
            background: `linear-gradient(135deg, #FDFBF7 0%, #F5F0E6 100%)`,
            padding: '22px 28px',
            borderBottom: `1px solid ${GOLD_MED}`
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: GOLD_SOFT, border: `1px solid ${GOLD_MED}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Send size={18} style={{ color: GOLD }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: FOREST }}>
                    Policy Publishing Console
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 3 }}>
                    Publish a new live policy · Audited · Effective immediately · Irreversible without re-publishing
                  </div>
                </div>
              </div>

              {/* Version badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: '8px 18px', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#9CA3AF', textTransform: 'uppercase' }}>Live</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#15803D', fontSize: '1.1rem' }}>v{liveVersion}</div>
                </div>
                <ArrowRight size={16} style={{ color: '#9CA3AF' }} />
                <div style={{ textAlign: 'center', padding: '8px 18px', background: GOLD_SOFT, border: `1.5px solid ${GOLD_MED}`, borderRadius: 10 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#9CA3AF', textTransform: 'uppercase' }}>Proposed</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#78531A', fontSize: '1.1rem' }}>v{liveVersion + 1}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 18px', background: tr ? '#F0FDF4' : '#F9FAFB', border: `1.5px solid ${tr ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 10 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#9CA3AF', textTransform: 'uppercase' }}>Simulation</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: tr ? '#15803D' : '#9CA3AF' }}>
                    {tr ? 'Completed' : 'Pending'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Publishing body */}
          <div style={{ background: '#FFFFFF', padding: '22px 28px' }}>
            {!tr && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, marginBottom: 18
              }}>
                <Info size={15} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '0.8rem', color: '#78350F', lineHeight: 1.5 }}>
                  <strong>Recommended:</strong> Run a simulation first to understand the full impact of these policy changes on historical cases before publishing to live traffic.
                </div>
              </div>
            )}

            {!confirmPublish ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ fontSize: '0.82rem', color: '#4B5563', maxWidth: 500, lineHeight: 1.6 }}>
                  Publishing immediately replaces live policy <strong>v{liveVersion}</strong> with the current draft across
                  all decision endpoints — without code changes or server restarts. The action is permanently logged
                  in the tamper-evident audit trail.
                </div>
                <button
                  onClick={() => setConfirmPublish(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', fontSize: '0.9rem', fontWeight: 700,
                    background: `linear-gradient(135deg, #B45309, #D97706)`,
                    color: '#FFF', border: 'none', borderRadius: 10, cursor: 'pointer',
                    boxShadow: '0 3px 12px rgba(180,83,9,0.3)', whiteSpace: 'nowrap'
                  }}
                >
                  <Send size={15} />
                  Publish to Live System…
                </button>
              </div>
            ) : (
              <div style={{ border: '2px solid #FECACA', borderRadius: 12, padding: '20px 24px', background: '#FFF5F5' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <AlertTriangle size={22} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.0rem', color: '#991B1B' }}>Confirm Policy Publication</div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#B91C1C', lineHeight: 1.5 }}>
                      This will replace live v{liveVersion} with the proposed configuration.
                      All subsequent decisions will use the new rules <strong>immediately</strong>.
                      This action is permanent and permanently audit-logged.
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Audit Note for Policy Change (required for audit trail)
                  </label>
                  <input
                    value={publishNote}
                    onChange={(e) => setPublishNote(e.target.value)}
                    placeholder="e.g. Stricter income threshold pilot — approved by Director Tariq Jamil"
                    style={{ width: '100%', border: '1.5px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem', boxSizing: 'border-box', background: '#FFFFFF' }}
                  />
                </div>

                <ErrorBox e={pubErr} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setConfirmPublish(false); setPubErr(null) }}
                    disabled={pubBusy}
                    style={{
                      padding: '10px 20px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 9,
                      background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={pubBusy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '11px 22px', fontSize: '0.9rem', fontWeight: 800,
                      background: pubBusy ? '#D1D5DB' : '#DC2626',
                      color: '#fff', border: 'none', borderRadius: 9, cursor: pubBusy ? 'not-allowed' : 'pointer',
                      boxShadow: pubBusy ? 'none' : '0 3px 12px rgba(220,38,38,0.3)'
                    }}
                  >
                    {pubBusy ? (
                      <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Publishing…</>
                    ) : (
                      <><Send size={15} /> Confirm: Publish v{liveVersion + 1} Live Now</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
          background: IVORY, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10
        }}>
          <Lock size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>
            Policy publishing requires the <strong>Admin</strong> role.
            Simulation is available to all officers and auditors for counterfactual analysis.
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          VERSION REGISTRY
      ══════════════════════════════════════════════ */}
      <LabCard>
        <CardHeader
          icon={BookOpen}
          title="Version Registry"
          subtitle="Complete history of published, draft, and superseded policy versions"
        />
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: IVORY }}>
                {['Version', 'Status', 'Date', 'Audit Note', 'Conditions Summary'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 700,
                    color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
                    borderBottom: '1px solid rgba(0,0,0,0.07)'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versionsHistory.map((r, ri) => {
                const isLive = r.status === 'published' || r.version === liveVersion
                return (
                  <tr key={r.id} style={{ background: ri % 2 === 0 ? '#fff' : IVORY }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: FOREST, fontSize: '0.9rem' }}>
                      v{r.version}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.07em',
                        padding: '3px 9px', borderRadius: 999,
                        background: isLive ? '#DCFCE7' : r.status === 'draft' ? '#FEF9C3' : '#F3F4F6',
                        color: isLive ? '#15803D' : r.status === 'draft' ? '#854D0E' : '#6B7280'
                      }}>
                        {isLive ? 'LIVE' : r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.76rem', color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {when(r.published_at || r.created_at)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#374151' }}>
                      {r.note || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.definition?.conditions?.map((c) => (
                          <span key={c.id} style={{
                            fontFamily: 'monospace', fontSize: '0.65rem',
                            background: IVORY, padding: '2px 7px',
                            borderRadius: 5, border: '1px solid rgba(0,0,0,0.08)', color: FOREST
                          }}>
                            {c.fact} {c.op} {c.value}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </LabCard>

    </div>
  )
}
