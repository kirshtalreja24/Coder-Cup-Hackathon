// Offline-first outbox. Claims are saved locally at every step, and synced later with idempotency keys,
// so a dropped connection never loses work and a retry never creates duplicates.
import { api } from './api'

const KEY = 'bh_outbox_v1'
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const loadBox = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const saveBox = (b) => localStorage.setItem(KEY, JSON.stringify(b))
const listeners = new Set()
export const onBox = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const emit = () => listeners.forEach((fn) => fn(loadBox()))

export function queueClaim({ data, consent, photo, citizen_id }) {
  const box = loadBox()
  const item = { id: uuid(), temp_id: 'tmp-' + uuid().slice(0, 8), data, consent, photo: photo || null, citizen_id: citizen_id || null,
    state: 'queued', created: Date.now(), caseId: null, photoDone: !photo, result: null }
  box.push(item); saveBox(box); emit()
  return item
}

export const pending = () => loadBox().filter((x) => x.state !== 'done').length

let flushing = false
export async function flush() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    for (const item of loadBox()) {
      if (item.state === 'done') continue
      const upd = (patch) => { const b = loadBox().map((x) => (x.id === item.id ? { ...x, ...patch } : x)); saveBox(b); Object.assign(item, patch); emit() }
      try {
        if (!item.caseId) {
          const r = await api('/sync/batch', { method: 'POST', body: { ops: [
            { op_id: item.id + '-c', type: 'case.create', payload: { temp_id: item.temp_id, citizen_id: item.citizen_id, data: item.data } },
          ] } })
          const res = r.results[0]
          const id = res.result?.id || (res.result && res.result.case?.id)
          if (!id) throw new Error(res.error || 'create failed')
          upd({ caseId: id })
        }
        if (!item.photoDone && item.photo) {
          const blob = await (await fetch(item.photo)).blob()
          const fd = new FormData(); fd.append('file', blob, 'id.jpg')
          await api(`/cases/${item.caseId}/documents`, { method: 'POST', formData: fd, timeout: 40000 })
          upd({ photoDone: true, photo: null })
        }
        const s = await api('/sync/batch', { method: 'POST', body: { ops: [
          { op_id: item.id + '-s', type: 'case.submit', payload: { case_id: item.caseId, consent: item.consent } },
        ] } })
        upd({ state: 'done', result: s.results[0].result || s.results[0] })
      } catch (e) {
        if (e.offline) break // still no signal: keep everything, try later
        upd({ state: 'error', error: String(e.message || e).slice(0, 200) })
      }
    }
  } finally { flushing = false; emit() }
}

export function startAutoSync() {
  window.addEventListener('online', () => flush())
  setInterval(() => flush(), 15000)
  flush()
}

// ---- draft progress (saved at every step so a dropped connection or closed tab never loses answers) ----
const DKEY = 'bh_draft_v1'
export const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DKEY) || 'null') } catch { return null } }
export const saveDraft = (d) => localStorage.setItem(DKEY, JSON.stringify(d))
export const clearDraft = () => localStorage.removeItem(DKEY)

// shrink a camera photo to ~100-200KB so it uploads on 2G
export function shrinkImage(file, max = 1000, q = 0.7) {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', q))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
