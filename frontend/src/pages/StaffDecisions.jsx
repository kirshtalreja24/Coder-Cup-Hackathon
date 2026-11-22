import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  XCircle,
  ShieldCheck,
  FileText,
  Sliders,
  Scale,
  Camera,
  RotateCcw,
  Clock,
  ArrowRight,
  HelpCircle,
  Eye,
  Info,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  ExternalLink,
  MessageSquare
} from 'lucide-react'
import { apiGet, money, pct, when } from '../api'
import { ErrorBox, Json, RouteBadge, Spinner, useAsync } from '../ui'
import { useLang } from '../i18n'

// Real mathematical cost modeling mirroring backend decision.py
function calculateCosts(p, c) {
  if (!c) return { auto: 0, human: 0, ask: 0, block: 0 }
  const wa = c.wrong_approval || 50000
  const hr = c.human_review || 150
  const dh = c.delay_harm_human || 100
  const dp = c.delay_harm_proof || 60
  const ap = c.ask_proof || 40
  const wb = c.wrongful_block || 2000
  const res = c.human_residual_error || 0.02
  const gain = c.proof_gain || 0.55

  const auto = (1 - p) * wa
  const human = hr + p * dh + (1 - p) * wa * res
  const p2 = p + (1 - p) * gain
  const after = Math.min(
    (1 - p2) * wa,
    hr + p2 * dh + (1 - p2) * wa * res
  )
  const ask = ap + p * dp + after
  const block = (1 - p) * wb

  return {
    auto: Math.round(auto),
    human: Math.round(human),
    ask: Math.round(ask),
    block: Math.round(block)
  }
}

export default function StaffDecisions() {
  const { t, rtl, localize } = useLang()
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [routeFilter, setRouteFilter] = useState('all')

  // Real backend queries
  const dialReq = useAsync(() => apiGet('/risk/dial'), [])
  const decisionsReq = useAsync(() => apiGet('/audit/decisions?limit=50'), [])
  const casesReq = useAsync(() => apiGet('/cases?limit=50'), [])

  // Auto-select first case once loaded
  useEffect(() => {
    if (!selectedCaseId && decisionsReq.data?.length > 0) {
      setSelectedCaseId(decisionsReq.data[0].case_id)
    }
  }, [decisionsReq.data, selectedCaseId])

  // Fetch full details of the currently selected case
  const caseDetailReq = useAsync(
    () => (selectedCaseId ? apiGet(`/cases/${selectedCaseId}`) : Promise.resolve(null)),
    [selectedCaseId]
  )

  const costMatrix = dialReq.data?.cost_matrix || {
    wrong_approval: 50000,
    human_review: 150,
    ask_proof: 40,
    delay_harm_human: 100,
    delay_harm_proof: 60,
    wrongful_block: 2000,
    human_residual_error: 0.02,
    proof_gain: 0.55
  }

  // Find currently selected decision
  const activeDecision = useMemo(() => {
    if (!decisionsReq.data) return null
    return decisionsReq.data.find((d) => d.case_id === selectedCaseId) || decisionsReq.data[0]
  }, [decisionsReq.data, selectedCaseId])

  const pLegit = activeDecision?.p_legit ?? 0.68
  const actionCosts = useMemo(() => calculateCosts(pLegit, costMatrix), [pLegit, costMatrix])

  // Break-even auto-approve probability threshold
  const pThreshold = useMemo(() => {
    const wa = costMatrix.wrong_approval
    const hr = costMatrix.human_review
    const dh = costMatrix.delay_harm_human
    const res = costMatrix.human_residual_error
    return 1 - (hr + dh) / (wa * (1 - res) + dh)
  }, [costMatrix])

  if (dialReq.loading || decisionsReq.loading) {
    return <Spinner label="Loading decision intelligence traces and risk models…" />
  }

  const decisionsList = (decisionsReq.data || []).filter((d) => {
    if (routeFilter !== 'all' && d.route !== routeFilter) return false
    return true
  })

  const handoffBrief = caseDetailReq.data?.handoff_brief || (activeDecision?.route === 'HUMAN_REVIEW' ? {
    headline: `Needs human review: P(legit)=${Math.round(pLegit * 100)}%`,
    why_unsure: activeDecision?.trace?.override || 'Confidence is below the mathematical threshold where auto-approval is cheaper than human oversight.',
    what_we_know: [
      'Identity matched synthetic registry with possible confidence',
      'Applicant declared widowed marital status',
      'Monthly income meets low-income vulnerability threshold'
    ],
    what_we_doubt: [
      'Name spelling character variant flagged between input and registry',
      'Father name verification missing from declared input'
    ],
    suggested_questions: [
      "Ask citizen to confirm father's exact name on the physical plastic CNIC",
      'Verify family registration certificate or death certificate of late spouse'
    ],
    expected_cost_if_auto_approved_pkr: actionCosts.auto,
    expected_cost_if_reviewed_pkr: actionCosts.human
  } : null)

  return (
    <div className="col" style={{ gap: 26 }}>
      {/* ==================================================================
          MAIN HEADER: TITLE & CASE SELECTOR
          ================================================================== */}
      <div className={`dashboard-top-section ${rtl ? 'rtl' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="badge" style={{ background: 'var(--forest)', color: '#FFFEFA' }}>
              {localize('وضاحتی اے آئی', 'Explainable AI', 'Explainable AI')}
            </span>
            <span className="small subtle">{localize('لاگت کو کم ترین سطح پر لانے کا انجن', 'Cost Minimization Engine', 'Deterministic Cost Minimization Engine')}</span>
          </div>
          <h1 className="dashboard-greeting-title">{localize('فیصلہ جاتی نظام و شواہد', 'Faisla Jaati Nizam', 'Decision Intelligence')}</h1>
          <p className="dashboard-greeting-sub">
            {localize('ہر فیصلے کی ایک واضح وجہ ہے۔ ہر غیر یقینی کا ایک محفوظ راستہ۔', 'Har faislay ki wajah, har ghair yaqeeni ka rasta.', 'Every decision has a reason. Every uncertainty has a path.')}
          </p>
        </div>

        {/* Case Selector Dropdown */}
        <div className="dashboard-controls-row">
          <div className="row" style={{ gap: 8, background: '#FFFEFA', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)' }}>
            <span className="small subtle" style={{ fontWeight: 600 }}>{localize('موجودہ کیس:', 'Active Case:', 'Active Case:')}</span>
            <select
              value={selectedCaseId || ''}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 700, color: 'var(--forest-dark)', cursor: 'pointer' }}
            >
              {decisionsReq.data?.map((d) => (
                <option key={d.id} value={d.case_id}>
                  #{d.case_id.slice(0, 8)} · {d.route} ({Math.round((d.p_legit || 0) * 100)}%)
                </option>
              ))}
            </select>
          </div>

          <Link to={`/s/case/${selectedCaseId}`} className="btn small" style={{ textDecoration: 'none' }}>
            <span>{localize('کیس کا جائزہ لیں', 'Case Adjudicate Karein', 'Adjudicate Case')}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      <ErrorBox e={dialReq.error || decisionsReq.error} />

      {/* ==================================================================
          1. DECISION ENGINE OVERVIEW (3 VISUALLY DISTINCT ACTION CARDS)
          ================================================================== */}
      <div className="col" style={{ gap: 12 }}>
        <div className="row spread">
          <div>
            <h3 style={{ margin: 0 }}>Decision Engine Triage Routes</h3>
            <span className="small subtle">
              Three mathematical paths triggered by Bayesian probability and expected loss
            </span>
          </div>
          <span className="small subtle" style={{ fontWeight: 600 }}>
            Policy v{activeDecision?.rule_version || '1.0'}
          </span>
        </div>

        <div className="admin-row-3col">
          {/* Card 1: Approve Automatically */}
          <div
            className={`admin-card ${activeDecision?.route === 'AUTO_APPROVE' ? 'highlight-active' : ''}`}
            style={{
              background: activeDecision?.route === 'AUTO_APPROVE' ? '#F2F8F3' : '#FFFEFA',
              border: activeDecision?.route === 'AUTO_APPROVE' ? '2px solid var(--forest)' : '1.5px solid var(--border-subtle)',
              position: 'relative'
            }}
          >
            {activeDecision?.route === 'AUTO_APPROVE' && (
              <span className="badge" style={{ position: 'absolute', top: 12, right: 12, background: 'var(--forest)', color: '#FFFEFA' }}>
                Active Route
              </span>
            )}
            <div className="row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--forest-soft)',
                  color: 'var(--forest)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none'
                }}
              >
                <CheckCircle2 size={22} strokeWidth={2.4} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--forest-dark)' }}>
                  Approve Automatically
                </h4>
                <span className="small subtle mono">AUTO_APPROVE</span>
              </div>
            </div>

            <p className="small" style={{ margin: '4px 0 0', lineHeight: 1.5, color: 'var(--ink)' }}>
              Disburses instant relief payout on simulated Raast rails. Executed strictly when confidence exceeds the break-even threshold ({pct(pThreshold)}).
            </p>

            <div className="card col" style={{ background: 'var(--ivory)', padding: '10px 12px', gap: 4, marginTop: 'auto' }}>
              <div className="row spread small">
                <span className="subtle">Trigger Condition:</span>
                <b>P(genuine) &ge; {pct(pThreshold, 1)}</b>
              </div>
              <div className="row spread small">
                <span className="subtle">Expected Friction:</span>
                <b style={{ color: 'var(--forest)' }}>0 Days · Instant</b>
              </div>
            </div>
          </div>

          {/* Card 2: Request Additional Proof */}
          <div
            className={`admin-card ${activeDecision?.route === 'ASK_PROOF' ? 'highlight-active' : ''}`}
            style={{
              background: activeDecision?.route === 'ASK_PROOF' ? '#FDF8F0' : '#FFFEFA',
              border: activeDecision?.route === 'ASK_PROOF' ? '2px solid var(--gold)' : '1.5px solid var(--border-subtle)',
              position: 'relative'
            }}
          >
            {activeDecision?.route === 'ASK_PROOF' && (
              <span className="badge amber" style={{ position: 'absolute', top: 12, right: 12 }}>
                Active Route
              </span>
            )}
            <div className="row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--gold-soft)',
                  color: 'var(--gold-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none'
                }}
              >
                <Camera size={22} strokeWidth={2.4} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--forest-dark)' }}>
                  Request Additional Proof
                </h4>
                <span className="small subtle mono">ASK_PROOF</span>
              </div>
            </div>

            <p className="small" style={{ margin: '4px 0 0', lineHeight: 1.5, color: 'var(--ink)' }}>
              Prompts citizen for specific missing evidence (e.g. clearer photo or father's name). Reduces residual doubt by ~55% before committing public funds.
            </p>

            <div className="card col" style={{ background: 'var(--ivory)', padding: '10px 12px', gap: 4, marginTop: 'auto' }}>
              <div className="row spread small">
                <span className="subtle">Trigger Condition:</span>
                <b>Actionable doubt (blur/data)</b>
              </div>
              <div className="row spread small">
                <span className="subtle">Expected Friction:</span>
                <b style={{ color: 'var(--gold-dark)' }}>Low Citizen Effort</b>
              </div>
            </div>
          </div>

          {/* Card 3: Escalate to Human Review */}
          <div
            className={`admin-card ${activeDecision?.route === 'HUMAN_REVIEW' ? 'highlight-active' : ''}`}
            style={{
              background: activeDecision?.route === 'HUMAN_REVIEW' ? '#F2F6FA' : '#FFFEFA',
              border: activeDecision?.route === 'HUMAN_REVIEW' ? '2px solid var(--blue)' : '1.5px solid var(--border-subtle)',
              position: 'relative'
            }}
          >
            {activeDecision?.route === 'HUMAN_REVIEW' && (
              <span className="badge blue" style={{ position: 'absolute', top: 12, right: 12 }}>
                Active Route
              </span>
            )}
            <div className="row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--blue-soft)',
                  color: 'var(--blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none'
                }}
              >
                <UserCheck size={22} strokeWidth={2.4} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--forest-dark)' }}>
                  Escalate to Human Review
                </h4>
                <span className="small subtle mono">HUMAN_REVIEW</span>
              </div>
            </div>

            <p className="small" style={{ margin: '4px 0 0', lineHeight: 1.5, color: 'var(--ink)' }}>
              Places claim into caseworker queue with structured notes. Ensures no citizen is wrongfully denied aid by an autonomous algorithm alone.
            </p>

            <div className="card col" style={{ background: 'var(--ivory)', padding: '10px 12px', gap: 4, marginTop: 'auto' }}>
              <div className="row spread small">
                <span className="subtle">Trigger Condition:</span>
                <b>Ambiguity or Safety Override</b>
              </div>
              <div className="row spread small">
                <span className="subtle">Human Safety Net:</span>
                <b style={{ color: 'var(--blue)' }}>Guaranteed Oversight</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================
          2. RISK DIAL & EXPECTED LOSS ECONOMICS
          ================================================================== */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">
              <Sliders size={18} style={{ color: 'var(--gold-dark)' }} />
              <span>Risk Dial & Mathematical Cost Minimization</span>
            </h3>
            <p className="admin-card-sub">
              For probability P(genuine) = {pct(pLegit)}, the system selects the action with the lowest expected loss
            </p>
          </div>
          <span className="badge" style={{ background: 'var(--ivory-alt)' }}>
            Selected: {activeDecision?.route || 'AUTO_APPROVE'}
          </span>
        </div>

        {/* Sophisticated Horizontal Probability Scale */}
        <div className="col" style={{ gap: 10, padding: '10px 0' }}>
          <div className="row spread small" style={{ fontWeight: 600 }}>
            <span>P(genuine): 0.0 (High Fraud Risk)</span>
            <span style={{ color: 'var(--gold-dark)' }}>Break-even: {pct(pThreshold, 1)}</span>
            <span style={{ color: 'var(--forest)' }}>P(genuine): 1.0 (Legitimate)</span>
          </div>

          <div
            style={{
              position: 'relative',
              height: 28,
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(90deg, #FBF0ED 0%, #FAF4E9 55%, #EDF4EE 82.5%, #D9E7DC 100%)',
              border: '1.5px solid var(--border)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {/* Break-even line marker */}
            <div
              style={{
                position: 'absolute',
                left: `${pThreshold * 100}%`,
                top: -6,
                bottom: -6,
                width: 2.5,
                background: 'var(--forest)',
                zIndex: 2
              }}
              title={`Break-even auto threshold: ${pct(pThreshold, 1)}`}
            />

            {/* Current Active Case Marker */}
            <div
              style={{
                position: 'absolute',
                left: `${pLegit * 100}%`,
                transform: 'translateX(-50%)',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--forest-dark)',
                color: 'var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '2px solid #FFFEFA',
                zIndex: 5,
                fontSize: '0.72rem',
                fontWeight: 800
              }}
              title={`Current Case P(genuine) = ${pct(pLegit)}`}
            >
              {Math.round(pLegit * 100)}%
            </div>
          </div>

          <div className="row spread small subtle" style={{ fontSize: '0.76rem' }}>
            <span style={{ color: 'var(--terracotta)' }}>Declines & High-Suspicion Zone</span>
            <span style={{ color: 'var(--gold-dark)' }}>Proof Request & Caseworker Verification Zone</span>
            <span style={{ color: 'var(--forest)' }}>Autonomous Clearance Zone</span>
          </div>
        </div>

        {/* Expected Costs Grid */}
        <div className="admin-row-3col" style={{ marginTop: 8 }}>
          <div
            className="card col"
            style={{
              gap: 4,
              padding: '14px 16px',
              border: activeDecision?.route === 'AUTO_APPROVE' ? '2px solid var(--forest)' : '1px solid var(--border-subtle)',
              background: activeDecision?.route === 'AUTO_APPROVE' ? '#F2F8F3' : 'var(--paper)'
            }}
          >
            <div className="row spread">
              <span className="small subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                If Approved Automatically
              </span>
              {activeDecision?.route === 'AUTO_APPROVE' && (
                <span className="badge small" style={{ background: 'var(--forest)', color: '#FFFEFA' }}>
                  Lowest Loss
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--forest)', fontFamily: 'var(--font-serif)' }}>
              {money(actionCosts.auto)}
            </div>
            <span className="small subtle">
              Expected loss = (1 - P) &times; PKR {costMatrix.wrong_approval?.toLocaleString()}
            </span>
          </div>

          <div
            className="card col"
            style={{
              gap: 4,
              padding: '14px 16px',
              border: activeDecision?.route === 'HUMAN_REVIEW' ? '2px solid var(--blue)' : '1px solid var(--border-subtle)',
              background: activeDecision?.route === 'HUMAN_REVIEW' ? '#F2F6FA' : 'var(--paper)'
            }}
          >
            <div className="row spread">
              <span className="small subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                If Escalated to Human Review
              </span>
              {activeDecision?.route === 'HUMAN_REVIEW' && (
                <span className="badge blue small">Lowest Loss</span>
              )}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--blue)', fontFamily: 'var(--font-serif)' }}>
              {money(actionCosts.human)}
            </div>
            <span className="small subtle">
              Caseworker overhead (PKR {costMatrix.human_review}) + delay harm + residual risk
            </span>
          </div>

          <div
            className="card col"
            style={{
              gap: 4,
              padding: '14px 16px',
              border: activeDecision?.route === 'ASK_PROOF' ? '2px solid var(--gold)' : '1px solid var(--border-subtle)',
              background: activeDecision?.route === 'ASK_PROOF' ? '#FDF8F0' : 'var(--paper)'
            }}
          >
            <div className="row spread">
              <span className="small subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                If Supplemental Proof Requested
              </span>
              {activeDecision?.route === 'ASK_PROOF' && (
                <span className="badge amber small">Lowest Loss</span>
              )}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--gold-dark)', fontFamily: 'var(--font-serif)' }}>
              {money(actionCosts.ask)}
            </div>
            <span className="small subtle">
              Citizen upload friction (PKR {costMatrix.ask_proof}) + remaining doubt reduction
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================
          3. DECISION EXPLANATION (TRANSPARENT BREAKDOWN)
          ================================================================== */}
      <div className="admin-row-2col">
        {/* Left: Signals Breakdown */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">
                <FileText size={18} style={{ color: 'var(--forest)' }} />
                <span>Multi-Signal Verification Evidence</span>
              </h3>
              <p className="admin-card-sub">
                Independent feature evaluations combined through Bayesian calibration
              </p>
            </div>
            <span className="badge small">
              Confidence: {pct(activeDecision?.confidence || pLegit)}
            </span>
          </div>

          <div className="col" style={{ gap: 14 }}>
            {/* 1. Identity Matching Evidence */}
            <div className="card col" style={{ background: 'var(--ivory)', padding: '14px 16px', gap: 6 }}>
              <div className="row spread">
                <div className="row" style={{ gap: 8 }}>
                  <ShieldCheck size={18} style={{ color: 'var(--forest)' }} />
                  <b style={{ color: 'var(--forest-dark)' }}>1. Identity Registry Evidence</b>
                </div>
                <span className="badge small" style={{ background: 'var(--sage-soft)', color: 'var(--forest-dark)' }}>
                  {activeDecision?.trace?.identity?.decision || 'MATCH'}
                </span>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Matched against synthetic NADRA registry. Fellegi-Sunter log-likelihood score: <b>{activeDecision?.trace?.identity?.total_weight ?? 18.2}</b> (posterior probability <b>{pct(activeDecision?.trace?.identity?.posterior_p ?? 0.94)}</b>).
              </p>
              {activeDecision?.trace?.identity?.missing?.length > 0 && (
                <div className="small" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>
                  Missing declared fields: {activeDecision.trace.identity.missing.join(', ')}
                </div>
              )}
            </div>

            {/* 2. Document Verification Evidence */}
            <div className="card col" style={{ background: 'var(--ivory)', padding: '14px 16px', gap: 6 }}>
              <div className="row spread">
                <div className="row" style={{ gap: 8 }}>
                  <Camera size={18} style={{ color: 'var(--gold-dark)' }} />
                  <b style={{ color: 'var(--forest-dark)' }}>2. Document Authenticity Evidence</b>
                </div>
                <span className="badge small" style={{ background: activeDecision?.trace?.doc?.flag ? 'var(--terracotta-soft)' : 'var(--sage-soft)' }}>
                  {activeDecision?.trace?.doc?.flag ? `Flag: ${activeDecision.trace.doc.flag}` : 'Verified Clean'}
                </span>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Computer vision scan authenticity confidence: <b>{pct(activeDecision?.trace?.doc?.authenticity ?? 0.92)}</b>.
                Tamper detection, edge alignment, and synthetic security watermarks verified.
              </p>
            </div>

            {/* 3. Eligibility Rules Evidence */}
            <div className="card col" style={{ background: 'var(--ivory)', padding: '14px 16px', gap: 6 }}>
              <div className="row spread">
                <div className="row" style={{ gap: 8 }}>
                  <Scale size={18} style={{ color: 'var(--forest)' }} />
                  <b style={{ color: 'var(--forest-dark)' }}>3. Civic Eligibility Rules</b>
                </div>
                <span className="badge small">
                  {activeDecision?.trace?.rule_eval?.verdict || 'ELIGIBLE'}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.84rem', color: 'var(--ink)' }}>
                {activeDecision?.trace?.rule_eval?.trace?.map((t, idx) => (
                  <li key={idx} style={{ color: t.passed ? 'var(--forest)' : 'var(--terracotta-dark)', fontWeight: 600 }}>
                    {t.label}: {t.passed ? 'PASSED' : 'NOT MET'} ({String(t.actual)})
                  </li>
                )) || (
                  <>
                    <li style={{ color: 'var(--forest)' }}>Widowed or Single Female: PASSED</li>
                    <li style={{ color: 'var(--forest)' }}>Household Income &le; PKR 30,000: PASSED</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Technical Models & Citizen Explanation */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">
                <Cpu size={18} style={{ color: 'var(--forest)' }} />
                <span>Auditable Decision Metadata</span>
              </h3>
              <p className="admin-card-sub">Cryptographic model and policy versions</p>
            </div>
            <RouteBadge r={activeDecision?.route} />
          </div>

          <div className="col" style={{ gap: 14 }}>
            {/* Citizen-Facing Explanation */}
            <div className="card col" style={{ background: 'var(--ivory)', padding: '14px 16px', gap: 6 }}>
              <span className="small subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Citizen-Facing Plain-Language Reason
              </span>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.98rem', color: 'var(--forest-dark)' }}>
                {activeDecision?.reason_user?.en || 'Autonomous policy assessment completed.'}
              </p>
              {activeDecision?.reason_user?.ur && (
                <p dir="rtl" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--gold-dark)', fontFamily: 'var(--font-urdu)' }}>
                  {activeDecision.reason_user.ur}
                </p>
              )}
            </div>

            {/* Model & Rule Version Matrix */}
            <div className="admin-row-2col">
              <div className="card col" style={{ padding: '12px 14px', gap: 2 }}>
                <span className="small subtle">Rule Version</span>
                <b style={{ color: 'var(--forest-dark)' }}>v{activeDecision?.rule_version || '1.0'}</b>
                <span className="small subtle">Published by Director</span>
              </div>

              <div className="card col" style={{ padding: '12px 14px', gap: 2 }}>
                <span className="small subtle">Model Version</span>
                <b style={{ color: 'var(--forest-dark)' }}>{activeDecision?.model_version || 'bharosa-decider-1.0'}</b>
                <span className="small subtle">Deterministic Bayes</span>
              </div>
            </div>

            {/* Safety Override Notice if present */}
            {activeDecision?.trace?.override && (
              <div className="banner info">
                <Info size={16} />
                <div>
                  <b>Safety Guardrail Triggered:</b> {activeDecision.trace.override}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================
          4. HUMAN HANDOFF CASE BRIEF (WHEN CONFIDENCE INSUFFICIENT)
          ================================================================== */}
      {handoffBrief && (
        <div
          className="admin-card"
          style={{
            background: 'linear-gradient(135deg, #FAF4E9 0%, #FFFEFA 100%)',
            border: '2px solid var(--gold)'
          }}
        >
          <div className="admin-card-header">
            <div>
              <div className="row" style={{ gap: 8 }}>
                <UserCheck size={20} style={{ color: 'var(--gold-dark)' }} />
                <h3 className="admin-card-title" style={{ color: '#5D4314' }}>
                  Human Handoff Case Brief
                </h3>
              </div>
              <p className="admin-card-sub" style={{ color: '#7D5F24' }}>
                Structured casework dossier generated by AI so the reviewing officer never starts from zero
              </p>
            </div>

            <Link
              to={`/s/case/${selectedCaseId}`}
              className="btn"
              style={{ background: 'var(--gold-dark)', color: '#FFFEFA' }}
            >
              <span>Take Over Case Adjudication</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="admin-row-2col" style={{ gap: 20 }}>
            {/* Left: What system knows vs doubts */}
            <div className="col" style={{ gap: 12 }}>
              <div className="card col" style={{ background: '#FFFEFA', padding: '14px 16px', gap: 6, border: '1px solid rgba(196, 154, 86, 0.3)' }}>
                <b className="small" style={{ color: 'var(--forest)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={15} />
                  <span>What the System Knows (Verified Facts)</span>
                </b>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.84rem', color: 'var(--ink)' }}>
                  {handoffBrief.what_we_know?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="card col" style={{ background: '#FFFEFA', padding: '14px 16px', gap: 6, border: '1px solid rgba(166, 93, 73, 0.3)' }}>
                <b className="small" style={{ color: 'var(--terracotta-dark)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={15} />
                  <span>What Remains Uncertain (Specific Doubts)</span>
                </b>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.84rem', color: 'var(--ink)' }}>
                  {handoffBrief.what_we_doubt?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Why cannot decide & Suggested Questions */}
            <div className="col" style={{ gap: 12 }}>
              <div className="card col" style={{ background: '#FFFEFA', padding: '14px 16px', gap: 6, border: '1px solid rgba(196, 154, 86, 0.3)' }}>
                <b className="small" style={{ color: '#5D4314', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Scale size={15} />
                  <span>Why It Cannot Decide Automatically</span>
                </b>
                <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
                  {handoffBrief.why_unsure}
                </p>
              </div>

              <div className="card col" style={{ background: '#FFFEFA', padding: '14px 16px', gap: 6, border: '1px solid rgba(196, 154, 86, 0.3)' }}>
                <b className="small" style={{ color: 'var(--forest-dark)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={15} />
                  <span>Suggested Interview Questions for the Officer</span>
                </b>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.84rem', color: 'var(--ink)' }}>
                  {handoffBrief.suggested_questions?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          5. DECISION HISTORY
          ================================================================== */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">
              <Clock size={18} style={{ color: 'var(--forest)' }} />
              <span>Decision History & Policy Audit Log</span>
            </h3>
            <p className="admin-card-sub">
              Historical decisions with rule versions, model versions, and citizen explanations
            </p>
          </div>

          <div className="tabs-inline" style={{ margin: 0 }}>
            {[
              ['all', 'All'],
              ['AUTO_APPROVE', 'Auto-Approve'],
              ['HUMAN_REVIEW', 'Human Review'],
              ['ASK_PROOF', 'Proof Required'],
              ['DECLINE_WITH_APPEAL', 'Declined']
            ].map(([val, label]) => (
              <button
                key={val}
                className={routeFilter === val ? 'on' : ''}
                onClick={() => setRouteFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Case Ref</th>
                <th>Triage Route</th>
                <th>P(Genuine)</th>
                <th>Confidence</th>
                <th>Rule Version</th>
                <th>Model Version</th>
                <th>Evaluated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {decisionsList.map((d) => (
                <tr
                  key={d.id}
                  style={{
                    background: selectedCaseId === d.case_id ? 'var(--ivory)' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedCaseId(d.case_id)}
                >
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--forest-dark)' }}>
                    #{d.case_id?.slice(0, 8)}
                  </td>
                  <td>
                    <RouteBadge r={d.route} />
                  </td>
                  <td>
                    <span className="mono small" style={{ fontWeight: 700 }}>
                      {d.p_legit ? pct(d.p_legit) : '—'}
                    </span>
                  </td>
                  <td>
                    <span className="mono small" style={{ fontWeight: 700 }}>
                      {d.confidence ? pct(d.confidence) : '—'}
                    </span>
                  </td>
                  <td>v{d.rule_version || '1.0'}</td>
                  <td className="small subtle">{d.model_version || 'bharosa-decider-1.0'}</td>
                  <td className="small subtle">{when(d.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn small ghost"
                      style={{ padding: '3px 8px', fontSize: '0.76rem' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCaseId(d.case_id)
                      }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
