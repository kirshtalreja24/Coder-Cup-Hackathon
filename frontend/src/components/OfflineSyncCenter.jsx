import { useEffect, useState } from 'react'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import {
  loadBox,
  onBox,
  flush,
  pending,
  retryClaim,
  removeClaim,
  getLastSync,
  isEffectiveOnline,
  isSimulatedOffline,
  setSimulatedOffline,
  isFlushing
} from '../offline'
import { when } from '../api'

export default function OfflineSyncCenter({ isOpen, onClose }) {
  const [box, setBox] = useState(loadBox())
  const [syncState, setSyncState] = useState({ isSyncing: isFlushing(), current: 0, total: 0 })
  const [online, setOnline] = useState(isEffectiveOnline())
  const [simulated, setSimulated] = useState(isSimulatedOffline())
  const [lastSync, setLastSyncState] = useState(getLastSync())

  useEffect(() => {
    const unsub = onBox((newBox, st) => {
      setBox(newBox)
      if (st) setSyncState(st)
      setLastSyncState(getLastSync())
    })

    const handleConn = () => {
      setOnline(isEffectiveOnline())
      setSimulated(isSimulatedOffline())
    }

    window.addEventListener('online', handleConn)
    window.addEventListener('offline', handleConn)

    return () => {
      unsub()
      window.removeEventListener('online', handleConn)
      window.removeEventListener('offline', handleConn)
    }
  }, [])

  if (!isOpen) return null

  const queued = box.filter((x) => x.state === 'queued')
  const errors = box.filter((x) => x.state === 'error')
  const done = box.filter((x) => x.state === 'done')
  const total = box.length
  const isBusy = syncState.isSyncing || isFlushing()

  const handleToggleSimulate = () => {
    const next = !simulated
    setSimulatedOffline(next)
    setSimulated(next)
    setOnline(!next && navigator.onLine)
  }

  const handleManualSync = () => {
    if (!online) return
    flush()
  }

  const formatLastSync = (ts) => {
    if (!ts) return 'No sync recorded yet'
    const diffMs = Date.now() - ts
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins === 1) return '1 minute ago'
    if (mins < 60) return `${mins} minutes ago`
    return when(ts)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(13, 35, 24, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--paper, #FFFFFF)',
          borderRadius: 'var(--radius-xl, 18px)',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(196, 154, 86, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0D2318 0%, #173D32 60%, #1A4035 100%)',
            padding: '20px 24px',
            color: '#FDFBF7',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(196, 154, 86, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: online ? 'rgba(22, 163, 74, 0.2)' : 'rgba(196, 154, 86, 0.25)',
                border: `1px solid ${online ? 'rgba(74, 222, 128, 0.4)' : 'rgba(196, 154, 86, 0.5)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {online ? (
                <Wifi size={22} style={{ color: '#4ADE80' }} />
              ) : (
                <WifiOff size={22} style={{ color: '#FCD34D' }} />
              )}
            </div>
            <div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#FDFBF7', fontWeight: 700 }}>
                  Offline Storage & Synchronization
                </h3>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: online ? 'rgba(74, 222, 128, 0.2)' : 'rgba(252, 211, 77, 0.2)',
                    color: online ? '#86EFAC' : '#FDE68A',
                    border: `1px solid ${online ? 'rgba(74, 222, 128, 0.4)' : 'rgba(252, 211, 77, 0.4)'}`
                  }}
                >
                  {online ? '● ONLINE' : '◯ OFFLINE STAGING'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'rgba(253, 251, 247, 0.72)' }}>
                Encrypted on-device queue with idempotency keys · Zero work lost
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ghost icon-btn"
            style={{ color: 'rgba(255,255,255,0.7)', padding: 6, minHeight: 'auto', background: 'transparent' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Calming Visual Explanation Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(196, 154, 86, 0.08) 0%, rgba(23, 61, 50, 0.05) 100%)',
              border: '1.5px solid rgba(196, 154, 86, 0.3)',
              borderRadius: 'var(--radius-lg, 14px)',
              padding: '16px 18px',
              display: 'flex',
              gap: 14,
              alignItems: 'center'
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(196, 154, 86, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <HardDrive size={24} style={{ color: 'var(--gold-dark, #92400E)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--forest-dark, #0D2318)', lineHeight: 1.3 }}>
                Your application is saved on this device. It will sync when your connection returns.
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--gold-dark, #92400E)',
                  marginTop: 4,
                  lineHeight: 1.4,
                  direction: 'rtl',
                  fontFamily: 'Noto Nastaliq Urdu, serif, Tahoma'
                }}
              >
                آپ کی درخواست اس فون پر محفوظ ہے۔ جیسے ہی نیٹ ورک بحال ہوگا یہ خود بخود جمع ہو جائے گی۔
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted, #6B7280)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={13} style={{ color: 'var(--forest, #173D32)' }} />
                <span>
                  {total > 0
                    ? `Verified in local browser database: ${total} stored claim record(s).`
                    : 'Local storage ready: No unsaved drafts currently waiting.'}
                </span>
              </div>
            </div>
          </div>

          {/* Sync & Storage KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '10px',
                padding: '10px 12px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Pending Sync
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: queued.length > 0 ? 'var(--gold-dark, #B45309)' : 'var(--forest, #173D32)' }}>
                {queued.length}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted, #9CA3AF)' }}>Waiting for signal</div>
            </div>

            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '10px',
                padding: '10px 12px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Synced to Server
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16A34A' }}>
                {done.length}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted, #9CA3AF)' }}>Confirmed processed</div>
            </div>

            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '10px',
                padding: '10px 12px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Sync Errors
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: errors.length > 0 ? '#DC2626' : 'var(--muted, #9CA3AF)' }}>
                {errors.length}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted, #9CA3AF)' }}>
                {errors.length > 0 ? 'Needs retry' : 'No errors'}
              </div>
            </div>

            <div
              style={{
                background: 'var(--ivory, #F5F0E6)',
                borderRadius: '10px',
                padding: '10px 12px',
                border: '1px solid var(--border-subtle, #E5E7EB)'
              }}
            >
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted, #6B7280)', fontFamily: 'monospace' }}>
                Last Sync
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--forest-dark, #0D2318)', marginTop: 4 }}>
                {formatLastSync(lastSync)}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted, #9CA3AF)', marginTop: 4 }}>
                Auto-syncs q15s
              </div>
            </div>
          </div>

          {/* Sync Progress Bar (if in-flight) */}
          {isBusy && (
            <div
              style={{
                background: '#F0FDF4',
                border: '1.5px solid #BBF7D0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div className="row spread" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534' }}>
                <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <RotateCcw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Synchronizing claims with Bharosa server…
                </span>
                <span className="mono">
                  {syncState.current} / {Math.max(syncState.total, queued.length + errors.length)}
                </span>
              </div>
              <div style={{ height: 6, background: '#DCFCE7', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: syncState.total > 0 ? `${(syncState.current / syncState.total) * 100}%` : '50%',
                    background: '#16A34A',
                    borderRadius: 999,
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          )}

          {/* Saved Claims List */}
          <div>
            <div className="row spread" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--forest-dark, #0D2318)' }}>
                Saved Claims on This Device ({total})
              </div>
              <span className="small subtle">Idempotent op-keys prevent duplicates</span>
            </div>

            {total === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--ivory, #F5F0E6)',
                  borderRadius: '12px',
                  border: '1.5px dashed var(--border-subtle, #E5E7EB)'
                }}
              >
                <CheckCircle2 size={32} style={{ color: 'var(--forest, #173D32)', margin: '0 auto 8px', opacity: 0.7 }} />
                <div style={{ fontWeight: 600, color: 'var(--forest-dark, #0D2318)', fontSize: '0.95rem' }}>
                  All Stored Claims Are Synchronized
                </div>
                <p className="small muted" style={{ margin: '4px 0 0', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                  If you submit a claim while disconnected, it will be securely staged here and uploaded automatically as soon as connection is restored.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '280px', overflowY: 'auto' }}>
                {box.map((item) => {
                  const applicantName = item.data?.name || 'Relief Beneficiary'
                  const income = item.data?.monthly_income ? `PKR ${Number(item.data.monthly_income).toLocaleString()}` : ''
                  const isDone = item.state === 'done'
                  const isErr = item.state === 'error'
                  const isQ = item.state === 'queued'

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 14px',
                        background: '#FFFFFF',
                        borderRadius: '10px',
                        border: `1.5px solid ${isErr ? '#FECACA' : isDone ? '#BBF7D0' : 'rgba(196, 154, 86, 0.4)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '8px',
                            background: isDone ? '#DCFCE7' : isErr ? '#FEE2E2' : 'rgba(196, 154, 86, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {isDone ? (
                            <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
                          ) : isErr ? (
                            <AlertTriangle size={18} style={{ color: '#DC2626' }} />
                          ) : (
                            <Clock size={18} style={{ color: 'var(--gold-dark, #B45309)' }} />
                          )}
                        </div>

                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--forest-dark, #0D2318)' }}>
                            {applicantName} {income && <span className="small muted">· {income}</span>}
                          </div>
                          <div className="row" style={{ gap: 8, fontSize: '0.72rem', color: 'var(--muted, #6B7280)', marginTop: 2 }}>
                            <span className="mono">ID: {item.temp_id}</span>
                            <span>•</span>
                            <span>Saved: {when(item.created)}</span>
                            {item.caseId && (
                              <>
                                <span>•</span>
                                <span className="mono" style={{ color: '#16A34A', fontWeight: 600 }}>
                                  Server Case #{item.caseId.slice(0, 8)}
                                </span>
                              </>
                            )}
                          </div>
                          {isErr && (
                            <div style={{ fontSize: '0.74rem', color: '#DC2626', marginTop: 4, fontWeight: 500 }}>
                              Sync error: {item.error || 'Server unreachable. Tap retry.'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isQ && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: '#FEF3C7',
                              color: '#92400E',
                              border: '1px solid #FDE68A'
                            }}
                          >
                            WAITING SYNC
                          </span>
                        )}

                        {isDone && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: '#DCFCE7',
                              color: '#15803D',
                              border: '1px solid #BBF7D0'
                            }}
                          >
                            ✓ SYNCED
                          </span>
                        )}

                        {isErr && (
                          <button
                            className="small btn"
                            onClick={() => retryClaim(item.id)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              background: '#DC2626',
                              color: '#FFF',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <RotateCcw size={12} /> Retry
                          </button>
                        )}

                        {isDone && (
                          <button
                            className="ghost small icon-btn"
                            onClick={() => removeClaim(item.id)}
                            title="Clear from local device memory"
                            style={{ color: '#9CA3AF' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            background: 'var(--ivory, #F5F0E6)',
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          {/* Hackathon Demo Simulation Tool */}
          <button
            type="button"
            className="ghost small"
            onClick={handleToggleSimulate}
            style={{
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: simulated ? '#B45309' : 'var(--muted, #6B7280)'
            }}
            title="Toggle simulated offline state for judge demos"
          >
            <Sparkles size={13} style={{ color: 'var(--gold, #C49A56)' }} />
            <span>{simulated ? 'Restore Live Connection' : 'Demo: Simulate Disconnected Mode'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn ghost small"
              onClick={onClose}
              style={{ fontWeight: 600 }}
            >
              Close
            </button>

            <button
              type="button"
              className="btn"
              onClick={handleManualSync}
              disabled={!online || isBusy || (queued.length === 0 && errors.length === 0)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                padding: '8px 18px',
                background: online ? 'var(--forest, #173D32)' : '#9CA3AF',
                color: '#FFF'
              }}
            >
              <RefreshCw size={14} style={{ animation: isBusy ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isBusy ? 'Syncing Now…' : 'Sync All Pending Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
