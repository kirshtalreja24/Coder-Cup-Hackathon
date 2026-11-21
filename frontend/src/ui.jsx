import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  AlertCircle,
  FileText,
  UserCheck,
  ChevronRight,
  X,
  Info,
  RotateCcw,
  ArrowRight,
  Check,
  Inbox
} from 'lucide-react'

export const MockTag = ({ children = 'MOCK' }) => (
  <span className="mock-tag" title="Simulated: no real person, no real money">
    {children}
  </span>
)

const STATUS_CONFIG = {
  paid: { cls: '', icon: CheckCircle2 },
  approved: { cls: '', icon: CheckCircle2 },
  closed: { cls: 'grey', icon: CheckCircle2 },
  declined: { cls: 'red', icon: XCircle },
  rejected: { cls: 'red', icon: XCircle },
  needs_proof: { cls: 'amber', icon: AlertTriangle },
  needs_consent: { cls: 'amber', icon: Clock },
  awaiting_human: { cls: 'blue', icon: UserCheck },
  escalated: { cls: 'red', icon: ShieldAlert },
  draft: { cls: 'grey', icon: FileText },
  awaiting_payment_consent: { cls: 'amber', icon: Clock }
}

export const StatusBadge = ({ s }) => {
  const conf = STATUS_CONFIG[s] || { cls: 'grey', icon: AlertCircle }
  const Icon = conf.icon
  return (
    <span className={'badge ' + conf.cls}>
      <Icon size={12} strokeWidth={2.5} />
      {(s || '').replaceAll('_', ' ')}
    </span>
  )
}

const ROUTE_CONFIG = {
  AUTO_APPROVE: { cls: '', icon: ShieldCheck },
  ASK_PROOF: { cls: 'amber', icon: AlertTriangle },
  HUMAN_REVIEW: { cls: 'blue', icon: UserCheck },
  DECLINE_WITH_APPEAL: { cls: 'red', icon: XCircle },
  NEEDS_CONSENT: { cls: 'amber', icon: Clock }
}

export const RouteBadge = ({ r }) => {
  const conf = ROUTE_CONFIG[r] || { cls: 'grey', icon: AlertCircle }
  const Icon = conf.icon
  return (
    <span className={'badge ' + conf.cls}>
      <Icon size={12} strokeWidth={2.5} />
      {(r || '').replaceAll('_', ' ')}
    </span>
  )
}

export function useAsync(fn, deps = []) {
  const [state, set] = useState({ loading: true, data: null, error: null })
  const run = async () => {
    set((s) => ({ ...s, loading: true, error: null }))
    try {
      set({ loading: false, data: await fn(), error: null })
    } catch (e) {
      set({ loading: false, data: null, error: e })
    }
  }
  useEffect(() => {
    run()
  }, deps) // eslint-disable-line
  return { ...state, reload: run }
}

export const Skeleton = ({ height = 24, width = '100%', style = {} }) => (
  <div
    className="skeleton"
    style={{
      height,
      width,
      borderRadius: 'var(--radius-sm)',
      ...style
    }}
  />
)

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="row muted small" style={{ padding: '14px 4px', gap: 10 }}>
    <span
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--forest)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}
    />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <span>{label}</span>
  </div>
)

export const ErrorBox = ({ e }) => {
  if (!e) return null
  return (
    <div className="banner bad">
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        {e.offline
          ? 'No connection to the server. Your work is saved locally and will sync once reconnected.'
          : typeof e.detail === 'string'
            ? e.detail
            : e.message || 'An error occurred'}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs-inline">
      {tabs.map(([k, l]) => (
        <button
          key={k}
          className={value === k ? 'on' : ''}
          onClick={() => onChange(k)}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export const Json = ({ data, max = 360 }) => (
  <pre className="trace" style={{ maxHeight: max }}>
    {JSON.stringify(data, null, 2)}
  </pre>
)

export function Bar({ value, color }) {
  return (
    <div className="bar">
      <i
        style={{
          width: Math.max(0, Math.min(100, value * 100)) + '%',
          background: color || 'var(--forest)'
        }}
      />
    </div>
  )
}

// Minimal SVG line chart: lightweight, zero external library dependency
export function LineChart({
  points,
  series,
  width = 640,
  height = 260,
  xLabel,
  yLabel,
  yMax,
  marks = [],
  hideX
}) {
  const pad = { l: 56, r: 14, t: 14, b: 38 }
  const W = width - pad.l - pad.r,
    H = height - pad.t - pad.b
  const ymax =
    yMax ||
    Math.max(...series.flatMap((s) => points.map((p) => p[s.key] ?? 0))) * 1.05 ||
    1
  const x = (v) => pad.l + v * W
  const y = (v) => pad.t + H - (v / ymax) * H

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
      role="img"
      aria-label={yLabel}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={y(g * ymax)}
            y2={y(g * ymax)}
            stroke="var(--border-subtle)"
            strokeDasharray="2 3"
          />
          <text
            x={pad.l - 8}
            y={y(g * ymax) + 4}
            textAnchor="end"
            fontSize="10"
            fontFamily="var(--font-sans)"
            fill="var(--ink-secondary)"
          >
            {Math.round(g * ymax).toLocaleString()}
          </text>
        </g>
      ))}

      {series.map((s) => (
        <polyline
          key={s.key}
          fill="none"
          stroke={s.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points
            .map((p) => `${x(p.p)},${y(Math.min(p[s.key] ?? 0, ymax))}`)
            .join(' ')}
        />
      ))}

      {marks.map((m) => (
        <g key={m.label}>
          <line
            x1={x(m.p)}
            x2={x(m.p)}
            y1={pad.t}
            y2={pad.t + H}
            stroke={m.color}
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={x(m.p) - 4}
            y={pad.t + 12}
            textAnchor="end"
            fontSize="10"
            fontWeight="600"
            fill={m.color}
          >
            {m.label}
          </text>
        </g>
      ))}

      {!hideX &&
        [0, 0.25, 0.5, 0.75, 1].map((g) => (
          <text
            key={g}
            x={x(g)}
            y={height - 20}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-sans)"
            fill="var(--ink-secondary)"
          >
            {g}
          </text>
        ))}

      <text
        x={width / 2}
        y={height - 4}
        textAnchor="middle"
        fontSize="11"
        fontFamily="var(--font-sans)"
        fontWeight="600"
        fill="var(--ink-secondary)"
      >
        {xLabel}
      </text>

      {series.map((s, i) => (
        <g key={s.key}>
          <circle
            cx={pad.l + 8 + i * 140}
            cy={pad.t - 2}
            r="4.5"
            fill={s.color}
          />
          <text
            x={pad.l + 18 + i * 140}
            y={pad.t + 2}
            fontSize="11"
            fontFamily="var(--font-sans)"
            fontWeight="500"
            fill="var(--ink)"
          >
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function BarList({ rows, max, color = 'var(--forest)' }) {
  const m = max || Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="col" style={{ gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="row spread small" style={{ marginBottom: 3 }}>
            <span style={{ fontWeight: 500 }}>{k}</span>
            <b className="mono">{v}</b>
          </div>
          <div className="bar">
            <i style={{ width: (v / m) * 100 + '%', background: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: BREADCRUMBS
// --------------------------------------------------------------------------
export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          const Icon = item.icon

          return (
            <li key={idx} className="breadcrumbs-item">
              {idx > 0 && <ChevronRight size={13} className="breadcrumbs-separator" aria-hidden="true" />}
              {isLast || !item.to ? (
                <span className="breadcrumbs-current" aria-current={isLast ? 'page' : undefined}>
                  {Icon && <Icon size={13} className="breadcrumbs-icon" />}
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="breadcrumbs-link">
                  {Icon && <Icon size={13} className="breadcrumbs-icon" />}
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: PAGE HEADER
// --------------------------------------------------------------------------
export function PageHeader({
  title,
  urdu,
  subtitle,
  badge,
  breadcrumbs = [],
  actions,
  children
}) {
  return (
    <header className="page-header">
      {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

      <div className="page-header-row">
        <div className="page-header-titles">
          <div className="page-header-title-wrap">
            <h1 className="page-header-title">{title}</h1>
            {urdu && (
              <span className="page-header-urdu" dir="rtl">
                {urdu}
              </span>
            )}
            {badge && <span className="page-header-badge">{badge}</span>}
          </div>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>

        {actions && <div className="page-header-actions">{actions}</div>}
      </div>

      {children && <div className="page-header-extra">{children}</div>}
    </header>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: REUSABLE EMPTY STATE
// --------------------------------------------------------------------------
export function EmptyState({
  icon: Icon = Inbox,
  title = 'No items found',
  urdu,
  description = 'There are no records to display at this time.',
  actionText,
  onAction,
  actionTo,
  secondaryText,
  onSecondary
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon-wrap">
        <Icon size={28} className="empty-state-icon" />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {urdu && (
        <div className="empty-state-urdu" dir="rtl">
          {urdu}
        </div>
      )}
      <p className="empty-state-desc">{description}</p>
      {(actionText || secondaryText) && (
        <div className="empty-state-actions">
          {actionTo ? (
            <Link to={actionTo} className="btn">
              {actionText}
            </Link>
          ) : actionText ? (
            <button type="button" className="btn" onClick={onAction}>
              {actionText}
            </button>
          ) : null}

          {secondaryText && (
            <button type="button" className="btn ghost" onClick={onSecondary}>
              {secondaryText}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: REUSABLE ERROR STATE
// --------------------------------------------------------------------------
export function ErrorState({
  error,
  onRetry,
  title = 'Unable to load content',
  urdu = 'مواد لوڈ کرنے میں خرابی پیش آئی'
}) {
  const message =
    error?.detail ||
    error?.message ||
    (typeof error === 'string' ? error : 'A server or network error occurred.')

  return (
    <div className="error-state">
      <div className="error-state-icon-wrap">
        <AlertTriangle size={28} className="error-state-icon" />
      </div>
      <h3 className="error-state-title">{title}</h3>
      {urdu && (
        <div className="error-state-urdu" dir="rtl">
          {urdu}
        </div>
      )}
      <p className="error-state-desc">{message}</p>
      {onRetry && (
        <button type="button" className="btn ghost small error-state-btn" onClick={onRetry}>
          <RotateCcw size={14} />
          <span>Retry</span>
        </button>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: ACCESSIBLE CONFIRM DIALOG
// --------------------------------------------------------------------------
export function ConfirmDialog({
  isOpen,
  title = 'Please Confirm',
  urdu,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel
}) {
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onCancel()
      }
      window.addEventListener('keydown', handleKeyDown)
      if (confirmBtnRef.current) confirmBtnRef.current.focus()
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal-dialog-box" style={{ maxWidth: 460 }}>
        <div className="modal-dialog-header">
          <div>
            <h3 id="confirm-dialog-title" className="modal-dialog-title">
              {title}
            </h3>
            {urdu && (
              <div className="modal-dialog-urdu" dir="rtl">
                {urdu}
              </div>
            )}
          </div>
          <button
            type="button"
            className="ghost icon-btn small"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-dialog-body">
          <p style={{ margin: 0, fontSize: '0.96rem', lineHeight: 1.55, color: 'var(--ink)' }}>
            {message}
          </p>
        </div>

        <div className="modal-dialog-footer">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn ${isDestructive ? 'danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: TOOLTIP
// --------------------------------------------------------------------------
export function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false)

  if (!text) return children

  return (
    <span
      className="tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className={`tooltip-bubble tooltip-${position}`} role="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: REUSABLE CARD
// --------------------------------------------------------------------------
export function Card({
  children,
  variant = 'default',
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const variantClass = variant !== 'default' ? `card-${variant}` : ''
  const isClickable = !!onClick

  return (
    <div
      className={`card ${variantClass} ${isClickable ? 'card-clickable' : ''} ${className}`}
      style={style}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(e)
              }
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: SKELETON LOADERS
// --------------------------------------------------------------------------
export function CardSkeleton({ count = 1, height = 160 }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <div className="row spread" style={{ marginBottom: 12 }}>
            <Skeleton width="40%" height={20} />
            <Skeleton width="15%" height={20} />
          </div>
          <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={14} style={{ marginBottom: 16 }} />
          <div className="row" style={{ gap: 8 }}>
            <Skeleton width="25%" height={32} />
            <Skeleton width="25%" height={32} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="card flat" style={{ padding: 16, overflow: 'hidden' }}>
      <div className="row spread" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} width={`${Math.floor(80 / cols)}%`} height={16} />
        ))}
      </div>
      <div className="col" style={{ gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="row spread" style={{ alignItems: 'center' }}>
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} width={`${Math.floor(80 / cols)}%`} height={14} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MetricSkeleton() {
  return (
    <div className="card" style={{ padding: 20 }}>
      <Skeleton width="50%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={32} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={12} />
    </div>
  )
}

// --------------------------------------------------------------------------
// DESIGN SYSTEM: ACCESSIBLE TOAST NOTIFICATION CONTEXT
// --------------------------------------------------------------------------
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = (toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6)
    const newToast = {
      id,
      type: toast.type || 'info', // 'success' | 'error' | 'warn' | 'info'
      message: toast.message,
      duration: toast.duration || 4000
    }

    setToasts((prev) => [...prev, newToast])

    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const toast = {
    success: (message, duration) => addToast({ type: 'success', message, duration }),
    error: (message, duration) => addToast({ type: 'error', message, duration }),
    warn: (message, duration) => addToast({ type: 'warn', message, duration }),
    info: (message, duration) => addToast({ type: 'info', message, duration })
  }

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Graceful fallback if used outside provider
    return {
      toast: {
        success: (m) => console.log('Toast (success):', m),
        error: (m) => console.error('Toast (error):', m),
        warn: (m) => console.warn('Toast (warn):', m),
        info: (m) => console.log('Toast (info):', m)
      }
    }
  }
  return ctx
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => {
        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'error'
              ? XCircle
              : t.type === 'warn'
                ? AlertTriangle
                : Info

        return (
          <div key={t.id} className={`toast-item toast-${t.type}`} role="status">
            <Icon size={18} className="toast-icon" />
            <span className="toast-message">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => onRemove(t.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
