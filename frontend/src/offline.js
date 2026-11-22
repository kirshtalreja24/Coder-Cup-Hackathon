// Offline-first outbox. Claims are saved locally at every step, and synced later with idempotency keys,
// so a dropped connection never loses work and a retry never creates duplicates.
import { api } from './api'

const KEY = 'bh_outbox_v1'
const LAST_SYNC_KEY = 'bh_last_sync_ts'
const SIM_OFFLINE_KEY = 'bh_sim_offline'

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const isSimulatedOffline = () => {
  try { return sessionStorage.getItem(SIM_OFFLINE_KEY) === 'true' } catch { return false }
}

export const setSimulatedOffline = (val) => {
  try {
    sessionStorage.setItem(SIM_OFFLINE_KEY, val ? 'true' : 'false')
    window.dispatchEvent(new Event(val ? 'offline' : 'online'))
    emit()
  } catch {}
}

export const isEffectiveOnline = () => {
  return navigator.onLine && !isSimulatedOffline()
}

export const getLastSync = () => {
  try { return Number(localStorage.getItem(LAST_SYNC_KEY)) || null } catch { return null }
}

export const setLastSync = (ts = Date.now()) => {
  try { localStorage.setItem(LAST_SYNC_KEY, String(ts)) } catch {}
}

export const loadBox = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

const saveBox = (b) => localStorage.setItem(KEY, JSON.stringify(b))

const listeners = new Set()
export const onBox = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let syncStatus = {
  isSyncing: false,
  current: 0,
  total: 0,
  lastError: null
}

const emit = () => {
  const currentBox = loadBox()
  listeners.forEach((fn) => fn(currentBox, syncStatus))
}

export function queueClaim({ data, consent, photo, citizen_id }) {
  const box = loadBox()
  const item = {
    id: uuid(),
    temp_id: 'tmp-' + uuid().slice(0, 8),
    data,
    consent,
    photo: photo || null,
    citizen_id: citizen_id || null,
    state: 'queued',
    created: Date.now(),
    caseId: null,
    photoDone: !photo,
    result: null,
    error: null
  }
  box.push(item)
  saveBox(box)
  emit()
  return item
}

export const pending = () => loadBox().filter((x) => x.state !== 'done').length

export const retryClaim = (id) => {
  const box = loadBox().map((x) => (x.id === id ? { ...x, state: 'queued', error: null } : x))
  saveBox(box)
  emit()
  if (isEffectiveOnline()) {
    flush()
  }
}

export const removeClaim = (id) => {
  const box = loadBox().filter((x) => x.id !== id)
  saveBox(box)
  emit()
}

let flushing = false
export const isFlushing = () => flushing

export async function flush() {
  if (flushing || !isEffectiveOnline()) return
  flushing = true
  const initialBox = loadBox()
  const pendingItems = initialBox.filter((x) => x.state !== 'done')
  
  syncStatus = {
    isSyncing: true,
    current: 0,
    total: pendingItems.length,
    lastError: null
  }
  emit()

  try {
    let processed = 0
    for (const item of loadBox()) {
      if (item.state === 'done') continue
      processed++
      syncStatus.current = processed
      emit()

      const upd = (patch) => {
        const b = loadBox().map((x) => (x.id === item.id ? { ...x, ...patch } : x))
        saveBox(b)
        Object.assign(item, patch)
        emit()
      }

      try {
        if (!item.caseId) {
          const r = await api('/sync/batch', {
            method: 'POST',
            body: {
              ops: [
                {
                  op_id: item.id + '-c',
                  type: 'case.create',
                  payload: { temp_id: item.temp_id, citizen_id: item.citizen_id, data: item.data }
                }
              ]
            }
          })
          const res = r.results ? r.results[0] : r
          const id = res?.result?.id || (res?.result && res.result.case?.id) || res?.id
          if (!id) throw new Error(res?.error || 'create failed')
          upd({ caseId: id })
        }

        if (!item.photoDone && item.photo) {
          const blob = await (await fetch(item.photo)).blob()
          const fd = new FormData()
          fd.append('file', blob, 'id.jpg')
          await api(`/cases/${item.caseId}/documents`, { method: 'POST', formData: fd, timeout: 40000 })
          upd({ photoDone: true, photo: null })
        }

        const s = await api('/sync/batch', {
          method: 'POST',
          body: {
            ops: [
              { op_id: item.id + '-s', type: 'case.submit', payload: { case_id: item.caseId, consent: item.consent } }
            ]
          }
        })
        const finalRes = s.results ? (s.results[0].result || s.results[0]) : s
        upd({ state: 'done', result: finalRes, error: null })
        setLastSync(Date.now())
      } catch (e) {
        if (e.offline || !isEffectiveOnline()) {
          syncStatus.lastError = 'Connection dropped during sync. Remaining items queued safely.'
          break // still no signal: keep everything, try later
        }
        upd({ state: 'error', error: String(e.message || e).slice(0, 200) })
        syncStatus.lastError = String(e.message || e).slice(0, 160)
      }
    }
    setLastSync(Date.now())
  } finally {
    flushing = false
    syncStatus.isSyncing = false
    emit()
  }
}

export function startAutoSync() {
  window.addEventListener('online', () => {
    if (!isSimulatedOffline()) flush()
  })
  setInterval(() => {
    if (isEffectiveOnline()) flush()
  }, 15000)
  if (isEffectiveOnline()) flush()
}

// ---- draft progress (saved at every step so a dropped connection or closed tab never loses answers) ----
const DKEY = 'bh_draft_v1'
export const loadDraft = () => {
  try { return JSON.parse(localStorage.getItem(DKEY) || 'null') } catch { return null }
}
export const saveDraft = (d) => localStorage.setItem(DKEY, JSON.stringify(d))
export const clearDraft = () => localStorage.removeItem(DKEY)

// The blank claim form. Lives here so the claim page and the voice assistant start from the same defaults.
export const EMPTY_FORM = {
  name: '',
  father_name: '',
  cnic: '',
  marital_status: '',
  monthly_income: '',
  household_size: 4,
  district: 'Karachi East',
  dob: ''
}

// Voice / typed intent: put what the person said into the claim draft. The form still opens at step 1 for them to check.
export function prefillDraft(fields, familyId = null) {
  const cur = loadDraft()
  const base = cur && cur.forFamily === familyId ? cur.d : EMPTY_FORM
  const d = { ...EMPTY_FORM, ...base }
  for (const [k, v] of Object.entries(fields || {})) {
    if (v === null || v === undefined || v === '') continue
    d[k] = k === 'monthly_income' ? String(v) : v
  }
  saveDraft({ d, photo: cur?.photo || null, forFamily: familyId })
}

// shrink a camera photo to ~100-200KB so it uploads on 2G
export function shrinkImage(file, max = 1000, q = 0.7) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', q))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
