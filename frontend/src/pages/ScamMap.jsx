import { useState, useMemo } from 'react'
import {
  MapPin,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Filter,
  Activity,
  Layers,
  ChevronRight,
  Info,
  Clock,
  Eye,
  Search,
  Radio,
  Sliders,
  Sparkles,
  Lock,
  ArrowUpRight
} from 'lucide-react'
import { apiGet, when } from '../api'
import { ErrorBox, LineChart, Spinner, useAsync } from '../ui'
import { SCAM_TYPES, scamTypeLabel, scamTypeMeta } from '../scamTypes'

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS & METRIC DEFINITIONS
═══════════════════════════════════════════════════════════════ */
const FOREST    = '#173D32'
const FOREST_DK = '#0D2318'
const GOLD      = '#C49A56'
const GOLD_SOFT = 'rgba(196,154,86,0.12)'
const GOLD_MED  = 'rgba(196,154,86,0.25)'
const IVORY     = '#F5F0E6'
const CREAM     = '#FDFBF7'
const TERRA     = '#C05046'
const TERRA_SOFT= 'rgba(192,80,70,0.10)'

// District coordinate projection mapped to SVG viewport 600 x 600
const DISTRICT_COORDS = {
  'Karachi East': { x: 230, y: 510, province: 'Sindh' },
  'Karachi':      { x: 230, y: 510, province: 'Sindh' },
  'Hyderabad':    { x: 260, y: 480, province: 'Sindh' },
  'Sukkur':       { x: 280, y: 400, province: 'Sindh' },
  'Larkana':      { x: 250, y: 410, province: 'Sindh' },
  'Lahore':       { x: 440, y: 280, province: 'Punjab' },
  'Faisalabad':   { x: 395, y: 285, province: 'Punjab' },
  'Multan':       { x: 345, y: 335, province: 'Punjab' },
  'Rawalpindi':   { x: 390, y: 175, province: 'Punjab' },
  'Islamabad':    { x: 395, y: 165, province: 'ICT' },
  'Peshawar':     { x: 340, y: 160, province: 'Khyber Pakhtunkhwa' },
  'Quetta':       { x: 210, y: 320, province: 'Balochistan' },
  'Gwadar':       { x: 120, y: 500, province: 'Balochistan' },
  'Unknown':      { x: 300, y: 300, province: 'Unspecified' }
}

const TYPE_META = SCAM_TYPES

export default function ScamMap() {
  const [days, setDays] = useState(30)
  const [selectedArea, setSelectedArea] = useState(null)
  const [selectedType, setSelectedType] = useState('ALL')
  const [searchFilter, setSearchFilter] = useState('')

  const { data, loading, error, reload } = useAsync(() => apiGet('/scam/map?days=' + days), [days])
  const recent = useAsync(() => apiGet('/scam/recent?limit=30'), [])

  // Normalize by_area / by_type / by_day whether returned as Array of pairs or Object
  const areaList = useMemo(() => {
    if (!data?.by_area) return []
    return Array.isArray(data.by_area)
      ? data.by_area
      : Object.entries(data.by_area)
  }, [data?.by_area])

  const typeList = useMemo(() => {
    if (!data?.by_type) return []
    return Array.isArray(data.by_type)
      ? data.by_type
      : Object.entries(data.by_type)
  }, [data?.by_type])

  const dayList = useMemo(() => {
    if (!data?.by_day) return []
    return Array.isArray(data.by_day)
      ? data.by_day
      : Object.entries(data.by_day)
  }, [data?.by_day])

  const risingAreas = data?.rising_areas || []
  const areaTypeMatrix = data?.area_x_type || {}

  // Filtered areas according to search
  const filteredAreas = useMemo(() => {
    return areaList.filter(([name]) =>
      name.toLowerCase().includes(searchFilter.toLowerCase())
    )
  }, [areaList, searchFilter])

  // Filter recent messages for the selected area or type
  const filteredRecent = useMemo(() => {
    const list = recent.data || []
    return list.filter((r) => {
      if (selectedArea && r.area !== selectedArea) return false
      if (selectedType !== 'ALL' && r.type !== selectedType) return false
      return true
    })
  }, [recent.data, selectedArea, selectedType])

  if (loading) return <Spinner label="Loading geographic scam intelligence feed…" />
  if (error) return <ErrorBox e={error} />

  const totalReports = data.total_reports || 0
  const totalFlagged = data.flagged || 0
  const maxAreaCount = Math.max(1, ...areaList.map(([, v]) => v))

  // Detail for the selected area
  const activeAreaMeta = selectedArea ? DISTRICT_COORDS[selectedArea] || { x: 300, y: 300, province: 'Regional' } : null
  const activeAreaCount = selectedArea ? (areaList.find(([a]) => a === selectedArea)?.[1] || 0) : 0
  const activeAreaTypes = selectedArea ? areaTypeMatrix[selectedArea] || {} : {}
  const activeAreaRising = risingAreas.find((r) => r.area === selectedArea)

  // Chart line points
  const daysPts = dayList.map(([d, n], i, arr) => ({
    p: arr.length > 1 ? i / (arr.length - 1) : 0,
    n
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ═══════════════════════════════════════════════════════════
          HEADER BANNER
      ═══════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: `linear-gradient(135deg, ${FOREST_DK} 0%, ${FOREST} 60%, #1A4035 100%)`,
          borderRadius: 'var(--radius-xl, 18px)',
          padding: '26px 32px',
          color: '#FDFBF7',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(13, 35, 24, 0.35), inset 0 1px 0 rgba(196, 154, 86, 0.2)'
        }}
      >
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.62rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  background: 'rgba(196, 154, 86, 0.2)',
                  color: GOLD,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(196, 154, 86, 0.3)'
                }}
              >
                GEOGRAPHIC THREAT RADAR · جغرافیائی نقشہ
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.62rem',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.5)'
                }}
              >
                Aggregated Telemetry · Zero Citizen PII
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: '#FDFBF7', fontWeight: 800 }}>
              Scam Intelligence & Map
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.92rem', color: 'rgba(253, 251, 247, 0.72)', maxWidth: '580px', lineHeight: 1.5 }}>
              Syndicated fraud patterns and high-density clusters classified from citizen submissions.
              Select any district to inspect active archetypes and real-time alerts.
            </p>
          </div>

          {/* Time Filter & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(196, 154, 86, 0.3)',
                borderRadius: '10px',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Calendar size={14} style={{ color: GOLD }} />
              <select
                style={{
                  background: 'transparent',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '0.82rem',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[7, 14, 30, 60, 90].map((d) => (
                  <option key={d} value={d} style={{ color: '#000' }}>
                    Past {d} Days
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn ghost icon-btn"
              onClick={() => {
                reload()
                recent.reload()
              }}
              style={{
                color: '#FFF',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                width: 38,
                height: 38
              }}
              title="Refresh geographic feed"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          KPI OVERVIEW CARDS
      ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div className="card col" style={{ gap: 4, padding: '16px 18px', background: '#FFF' }}>
          <div className="kpi-l">Screened Messages</div>
          <div className="kpi" style={{ color: FOREST_DK }}>{totalReports}</div>
          <div className="small subtle">Across SMS & voice transcripts</div>
        </div>

        <div className="card col" style={{ gap: 4, padding: '16px 18px', background: '#FFF' }}>
          <div className="kpi-l">Confirmed Scam / Risk</div>
          <div className="kpi" style={{ color: TERRA }}>{totalFlagged}</div>
          <div className="small subtle">
            {totalReports > 0 ? `${Math.round((totalFlagged / totalReports) * 100)}% detection rate` : 'No data'}
          </div>
        </div>

        <div className="card col" style={{ gap: 4, padding: '16px 18px', background: '#FFF' }}>
          <div className="kpi-l">Rising Threat Districts</div>
          <div className="kpi" style={{ color: GOLD }}>{risingAreas.length}</div>
          <div className="small subtle">
            {risingAreas.length > 0
              ? risingAreas.map((r) => r.area).join(', ')
              : 'Zero emerging velocity anomalies'}
          </div>
        </div>

        <div className="card col" style={{ gap: 4, padding: '16px 18px', background: '#FFF' }}>
          <div className="kpi-l">Active Fraud Archetypes</div>
          <div className="kpi" style={{ color: FOREST }}>{typeList.length}</div>
          <div className="small subtle">
            {typeList.length > 0 ? typeList.slice(0, 3).map(([t]) => scamTypeLabel(t)).join(', ') : 'No incidents in this window'}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          INTERACTIVE MAP & SIDE DETAIL PANEL
      ═══════════════════════════════════════════════════════════ */}
      <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
        {/* Left: Stylized Map Card */}
        <div
          className="card col"
          style={{
            gap: 14,
            padding: '20px 24px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1.5px solid rgba(0,0,0,0.08)',
            position: 'relative'
          }}
        >
          <div className="row spread" style={{ alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: FOREST_DK }}>
                Pakistan Regional Threat Density
              </h3>
              <div className="small subtle">
                Interactive district cluster map · Click pin to inspect local pattern
              </div>
            </div>

            {selectedArea && (
              <button
                type="button"
                className="ghost small"
                onClick={() => setSelectedArea(null)}
                style={{ fontSize: '0.74rem', color: GOLD }}
              >
                Clear Selection (Show All)
              </button>
            )}
          </div>

          {/* SVG Geographic Visualizer */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '420px',
              background: 'linear-gradient(180deg, #0D2318 0%, #122F25 100%)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Grid Mesh */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={GOLD} strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#radarGrid)" />
            </svg>

            {/* Stylized Outline of Pakistan Provinces */}
            <svg
              viewBox="0 0 600 600"
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            >
              {/* Province Land Mass Silhouettes */}
              <g fill="none" stroke="rgba(196, 154, 86, 0.25)" strokeWidth="1.5">
                {/* Simplified contour for national borders */}
                <path
                  d="M 330 90 L 400 120 L 440 180 L 470 270 L 420 320 L 330 420 L 290 520 L 220 540 L 110 510 L 90 410 L 170 330 L 280 230 L 310 140 Z"
                  fill="rgba(23, 61, 50, 0.45)"
                  stroke="rgba(196, 154, 86, 0.35)"
                  strokeWidth="2"
                />
                {/* Sindh region accent */}
                <path
                  d="M 210 520 L 290 520 L 300 420 L 230 410 Z"
                  fill="rgba(196, 154, 86, 0.08)"
                  stroke="rgba(196, 154, 86, 0.4)"
                  strokeDasharray="4 4"
                />
              </g>

              {/* Province Label Watermarks */}
              <text x="350" y="240" fill="rgba(255,255,255,0.15)" fontSize="14" fontWeight="800" fontFamily="sans-serif">PUNJAB</text>
              <text x="220" y="460" fill="rgba(255,255,255,0.15)" fontSize="14" fontWeight="800" fontFamily="sans-serif">SINDH</text>
              <text x="140" y="360" fill="rgba(255,255,255,0.15)" fontSize="14" fontWeight="800" fontFamily="sans-serif">BALOCHISTAN</text>
              <text x="310" y="140" fill="rgba(255,255,255,0.15)" fontSize="12" fontWeight="800" fontFamily="sans-serif">KPK</text>

              {/* Interactive District Threat Hubs */}
              {areaList.map(([name, count]) => {
                const coords = DISTRICT_COORDS[name] || { x: 300, y: 300 }
                const isSelected = selectedArea === name
                const isRising = risingAreas.some((r) => r.area === name)
                const radius = Math.max(10, Math.min(28, (count / maxAreaCount) * 26 + 10))

                return (
                  <g
                    key={name}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedArea(isSelected ? null : name)}
                  >
                    {/* Pulsing warning aura for rising areas */}
                    {isRising && (
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r={radius + 8}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="1.5"
                        opacity="0.6"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Outer glow ring */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius + 3}
                      fill={isSelected ? GOLD_MED : 'rgba(220, 38, 38, 0.2)'}
                      stroke={isSelected ? GOLD : isRising ? '#EF4444' : 'rgba(220, 38, 38, 0.5)'}
                      strokeWidth={isSelected ? 2 : 1}
                    />

                    {/* Core Hub Marker */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius}
                      fill={isSelected ? GOLD : isRising ? '#DC2626' : '#B91C1C'}
                      opacity="0.9"
                    />

                    {/* Report count in center */}
                    <text
                      x={coords.x}
                      y={coords.y + 4}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {count}
                    </text>

                    {/* District name label */}
                    <text
                      x={coords.x}
                      y={coords.y + radius + 12}
                      textAnchor="middle"
                      fill={isSelected ? '#FCD34D' : '#E5E7EB'}
                      fontSize="10"
                      fontWeight={isSelected ? 800 : 600}
                    >
                      {name}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Map Legend (Bottom Right) */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 14,
                background: 'rgba(13, 35, 24, 0.85)',
                border: '1px solid rgba(196, 154, 86, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.68rem',
                color: '#E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
                <span>Active Threat Hub</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', border: '1px dashed #FFF' }} />
                <span>Rising Velocity Area (Anomalous)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD }} />
                <span>Selected District</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Area Detail Side Panel */}
        <div
          className="card col"
          style={{
            gap: 16,
            padding: '20px 22px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1.5px solid rgba(0,0,0,0.08)'
          }}
        >
          <div className="row spread">
            <h4 style={{ margin: 0, fontSize: '1rem', color: FOREST_DK }}>
              District Intelligence
            </h4>
            {selectedArea && (
              <span className="badge amber small" style={{ fontSize: '0.68rem' }}>
                Active Filter
              </span>
            )}
          </div>

          {selectedArea ? (
            <div className="col" style={{ gap: 14 }}>
              <div
                style={{
                  background: 'var(--ivory, #F5F0E6)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  border: '1px solid var(--border-subtle, #E5E7EB)'
                }}
              >
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                  {activeAreaMeta?.province || 'District'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: FOREST_DK, marginTop: 2 }}>
                  {selectedArea}
                </div>
                <div className="row" style={{ gap: 8, fontSize: '0.76rem', color: TERRA, fontWeight: 700, marginTop: 4 }}>
                  <span>{activeAreaCount} flagged fraud messages</span>
                  {activeAreaRising && (
                    <span className="badge red small" style={{ fontSize: '0.65rem' }}>
                      RISING ({activeAreaRising.earlier} → {activeAreaRising.recent})
                    </span>
                  )}
                </div>
              </div>

              {/* Archetypes in this Area */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: FOREST_DK, marginBottom: 8 }}>
                  Observed Modus Operandi
                </div>
                <div className="col" style={{ gap: 6 }}>
                  {Object.entries(activeAreaTypes).map(([type, count]) => {
                    const meta = scamTypeMeta(type)
                    return (
                      <div
                        key={type}
                        style={{
                          background: '#FFF',
                          border: '1px solid var(--border-subtle, #E5E7EB)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1F2937' }}>{meta.label}</span>
                        </div>
                        <span className="mono bold" style={{ fontSize: '0.8rem', color: FOREST }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                  {Object.keys(activeAreaTypes).length === 0 && (
                    <div className="small subtle">No subcategory breakdown available for this area.</div>
                  )}
                </div>
              </div>

              {/* Safety Recommendation */}
              <div
                style={{
                  background: 'rgba(196, 154, 86, 0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  border: '1px solid rgba(196, 154, 86, 0.3)',
                  fontSize: '0.76rem',
                  lineHeight: 1.45,
                  color: '#78350F'
                }}
              >
                <strong>Caseworker Action:</strong> Deploy community voice broadcast in {selectedArea} cautioning beneficiaries against unofficial JazzCash/EasyPaisa advance fee demands.
              </div>
            </div>
          ) : (
            /* Empty selection helper */
            <div
              style={{
                textAlign: 'center',
                padding: '36px 12px',
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '12px',
                border: '1.5px dashed var(--border-subtle, #E5E7EB)'
              }}
            >
              <MapPin size={32} style={{ color: 'var(--muted, #9CA3AF)', margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, color: FOREST_DK, fontSize: '0.9rem' }}>
                No District Selected
              </div>
              <p className="small muted" style={{ margin: '4px 0 0', lineHeight: 1.4 }}>
                Click any marker on the map to filter threat telemetry and view specific district patterns.
              </p>
            </div>
          )}

          {/* Quick Area Filter List */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: FOREST_DK, marginBottom: 6 }}>
              All Districts by Volume
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '180px', overflowY: 'auto' }}>
              {areaList.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedArea(selectedArea === name ? null : name)}
                  style={{
                    background: selectedArea === name ? 'rgba(196, 154, 86, 0.2)' : 'transparent',
                    border: `1px solid ${selectedArea === name ? GOLD : 'transparent'}`,
                    borderRadius: '6px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: FOREST_DK, fontWeight: selectedArea === name ? 700 : 500 }}>
                    {name}
                  </span>
                  <span className="mono" style={{ fontSize: '0.74rem', color: TERRA, fontWeight: 700 }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ARCHETYPE BREAKDOWN & DAILY VELOCITY CHART
      ═══════════════════════════════════════════════════════════ */}
      <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
        {/* Fraud Archetypes */}
        <div className="card col" style={{ gap: 14, padding: '20px 22px', background: '#FFF' }}>
          <div className="row spread">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: FOREST_DK }}>
                Incidents by Fraud Archetype
              </h3>
              <div className="small subtle">Distribution across classified attack profiles</div>
            </div>
            {selectedType !== 'ALL' && (
              <button
                type="button"
                className="ghost small"
                onClick={() => setSelectedType('ALL')}
                style={{ fontSize: '0.72rem', color: GOLD }}
              >
                Clear Type Filter
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {typeList.map(([type, count]) => {
              const meta = scamTypeMeta(type)
              const pct = totalFlagged > 0 ? ((count / totalFlagged) * 100).toFixed(1) : 0
              const isSelected = selectedType === type

              return (
                <div
                  key={type}
                  onClick={() => setSelectedType(isSelected ? 'ALL' : type)}
                  style={{
                    background: isSelected ? 'rgba(196, 154, 86, 0.12)' : 'var(--ivory, #F5F0E6)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    border: `1.5px solid ${isSelected ? GOLD : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div className="row spread" style={{ marginBottom: 6 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: FOREST_DK }}>{meta.label}</span>
                    </div>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="mono bold" style={{ fontSize: '0.9rem', color: meta.color }}>{count}</span>
                      <span className="small subtle">({pct}%)</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted, #6B7280)', marginTop: 4 }}>
                    {meta.desc}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Daily Velocity Trendline */}
        <div className="card col" style={{ gap: 14, padding: '20px 22px', background: '#FFF' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: FOREST_DK }}>
              Temporal Trajectory & Detection Velocity
            </h3>
            <div className="small subtle">Daily count of flagged fraudulent messages over time</div>
          </div>

          {daysPts.length > 1 ? (
            <div style={{ marginTop: 8 }}>
              <LineChart
                points={daysPts}
                series={[{ key: 'n', label: 'Flagged Messages / Day', color: TERRA }]}
                xLabel={`${dayList[0]?.[0] || ''} → ${dayList.at(-1)?.[0] || ''}`}
                hideX={false}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #6B7280)' }}>
              Insufficient daily velocity data points for chart rendering in selected window.
            </div>
          )}

          <div
            style={{
              marginTop: 'auto',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--ivory, #F5F0E6)',
              fontSize: '0.74rem',
              color: 'var(--muted, #6B7280)'
            }}
          >
            Spikes correspond to coordinated bulk SMS dispatch windows often matching relief distribution announcement cycles.
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RECENT CLASSIFIED STREAM TABLE
      ═══════════════════════════════════════════════════════════ */}
      <div
        className="card col"
        style={{
          gap: 14,
          padding: 0,
          background: '#FFF',
          borderRadius: '16px',
          border: '1.5px solid rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '18px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: FOREST_DK }}>
              Recent Classified Threat Feed
            </h3>
            <div className="small subtle">
              {filteredRecent.length} classified message(s) {selectedArea ? `in ${selectedArea}` : ''}{' '}
              {selectedType !== 'ALL' ? `matching ${scamTypeLabel(selectedType)}` : ''}
            </div>
          </div>

          {(selectedArea || selectedType !== 'ALL') && (
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setSelectedArea(null)
                setSelectedType('ALL')
              }}
              style={{ fontSize: '0.74rem', color: GOLD }}
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr style={{ background: 'var(--ivory, #F5F0E6)' }}>
                <th style={{ width: '130px' }}>Time</th>
                <th style={{ width: '120px' }}>District</th>
                <th style={{ width: '100px' }}>Classification</th>
                <th style={{ width: '150px' }}>Fraud Type</th>
                <th>Redacted Content</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecent.map((r) => (
                <tr key={r.id}>
                  <td className="small subtle mono">{when(r.at)}</td>
                  <td style={{ fontWeight: 600, color: FOREST_DK }}>{r.area || 'Unknown'}</td>
                  <td>
                    <span
                      className={
                        'badge ' +
                        (r.verdict === 'SCAM'
                          ? 'red'
                          : r.verdict === 'SUSPICIOUS'
                            ? 'amber'
                            : r.verdict === 'UNSURE'
                              ? 'blue'
                              : 'green')
                      }
                      style={{ fontSize: '0.68rem', fontWeight: 700 }}
                    >
                      {r.verdict}
                    </span>
                  </td>
                  <td className="small mono" style={{ color: 'var(--muted, #6B7280)' }}>
                    {r.verdict === 'LIKELY_REAL' ? 'Not a scam' : r.verdict === 'UNSURE' && !r.type ? 'Needs a person to check' : scamTypeLabel(r.type)}
                  </td>
                  <td className="small" style={{ maxWidth: '380px', lineHeight: 1.4 }}>
                    {r.text}
                  </td>
                </tr>
              ))}

              {filteredRecent.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--muted, #6B7280)' }}>
                    No messages match current active filter combination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="small subtle" style={{ textAlign: 'center', margin: '4px 0 12px' }}>
        {data.note || 'Built from classified synthetic and reported messages. District attribution as reported.'}
      </div>
    </div>
  )
}
