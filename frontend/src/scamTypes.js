// One place for what each kind of scam is called. The keys are exactly what the backend's classifier returns
// (backend/app/scam.py scam_type), so every incident gets a proper name instead of "Other".
export const SCAM_TYPES = {
  relief_impersonation: { label: 'Relief Impersonation', color: '#EA580C', desc: 'Pretends to be the relief programme (BISP / Ehsaas) from an unofficial number' },
  advance_fee: { label: 'Advance-Fee Scam', color: '#DC2626', desc: 'Asks for a processing fee or deposit before releasing relief money' },
  relief_phishing_link: { label: 'Fake Relief Website', color: '#7C3AED', desc: 'Relief message with a link to a fake registration or payment page' },
  otp_pin_theft: { label: 'PIN / OTP Theft', color: '#BE123C', desc: 'Asks you to share your PIN, OTP or ID number' },
  fake_prize: { label: 'Fake Prize / Lucky Draw', color: '#CA8A04', desc: 'Promises a prize and asks for delivery or registration charges' },
  job_bait: { label: 'Fake Job Offer', color: '#0F766E', desc: 'Easy-money work-from-home offers used to collect fees or details' },
  phishing_link: { label: 'Phishing Link', color: '#2563EB', desc: 'Link that is not an official .gov.pk address' },
  other: { label: 'Other Suspicious', color: '#4B5563', desc: 'Looks risky but fits no known pattern; left for an analyst' }
}

const prettify = (k) => String(k || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// Never collapses an unknown type into "Other": a new backend type still shows its own readable name.
export const scamTypeMeta = (key) =>
  SCAM_TYPES[key] || { label: key ? prettify(key) : 'Unclassified', color: SCAM_TYPES.other.color, desc: SCAM_TYPES.other.desc }

export const scamTypeLabel = (key) => scamTypeMeta(key).label
