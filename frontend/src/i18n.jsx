import { createContext, useContext, useEffect, useState } from 'react'

// Comprehensive dictionary for Urdu (script), Roman Urdu (Latin characters), and English.
const S = {
  // Brand & Identity
  app: { ur: 'بھروسہ', roman: 'Bharosa', en: 'Bharosa' },
  proto: { ur: 'تجرباتی نمونہ - سرکاری سروس نہیں', roman: 'Tajarbati namoona - sarkari service nahi', en: 'PROTOTYPE - not an official service' },
  welcome_msg: { ur: 'آپ کا خیر مقدم ہے', roman: 'Aap ka khush aamdeed', en: 'Welcome' },
  hello: { ur: 'خوش آمدید', roman: 'Khush aamdeed', en: 'Welcome' },

  // Navigation & Primary Actions
  claim: { ur: 'امداد کے لیے درخواست', roman: 'Imdad ke liye darkhast', en: 'Apply for relief' },
  scam: { ur: 'مشکوک پیغام کی جانچ', roman: 'Mashkook paigham ki jaanch', en: 'Check suspicious message' },
  ask: { ur: 'مدد اور سوالات', roman: 'Madad aur sawalaat', en: 'Get help & ask questions' },
  mydata: { ur: 'میرا ڈیٹا', roman: 'Mera data', en: 'My data' },
  mycases: { ur: 'میری درخواستیں', roman: 'Meri darkhastein', en: 'My requests' },
  next: { ur: 'آگے', roman: 'Aage', en: 'Next' },
  back: { ur: 'پیچھے', roman: 'Peeche', en: 'Back' },
  yes: { ur: 'ہاں', roman: 'Haan', en: 'Yes' },
  no: { ur: 'نہیں', roman: 'Nahi', en: 'No' },
  speak: { ur: 'بولیں', roman: 'Bolein', en: 'Speak' },
  listening: { ur: 'سن رہا ہوں…', roman: 'Sun raha hoon…', en: 'Listening…' },
  review: { ur: 'درخواست کا جائزہ', roman: 'Darkhast ka jaiza', en: 'Review application' },

  // Intake Form Fields
  name: { ur: 'آپ کا نام', roman: 'Aap ka naam', en: 'Full Name' },
  father: { ur: 'والد یا شوہر کا نام', roman: 'Walid ya shohar ka naam', en: "Father's or husband's name" },
  cnic: { ur: 'شناختی کارڈ نمبر', roman: 'Shanakhti card number', en: 'ID card number (CNIC)' },
  dob: { ur: 'تاریخ پیدائش', roman: 'Tareekh-e-paidaish', en: 'Date of birth' },
  status: { ur: 'آپ کی حیثیت', roman: 'Aap ki haisiyat', en: 'Marital status' },
  widow: { ur: 'بیوہ', roman: 'Widowed', en: 'Widowed' },
  married: { ur: 'شادی شدہ', roman: 'Married', en: 'Married' },
  single: { ur: 'غیر شادی شدہ', roman: 'Single', en: 'Single' },
  other: { ur: 'دیگر', roman: 'Other', en: 'Other' },
  income: { ur: 'ماہانہ آمدنی', roman: 'Mahana aamdani', en: 'Monthly income' },
  household: { ur: 'گھر کے افراد کی تعداد', roman: 'Ghar ke afraad ki tadaad', en: 'Household size' },
  district: { ur: 'ضلع / علاقہ', roman: 'Zila / Ilaqa', en: 'District' },
  photo: { ur: 'شناختی کارڈ کی تصویر', roman: 'Shanakhti card ki tasveer', en: 'Photo of ID card' },
  takephoto: { ur: 'تصویر لیں', roman: 'Tasveer lein', en: 'Take photo' },
  skip: { ur: 'چھوڑ دیں', roman: 'Chhor dein', en: 'Skip' },

  // Consent & Submission
  consent_title: { ur: 'آپ کی اجازت', roman: 'Aap ki ijazat', en: 'Your permission' },
  c_identity: { ur: 'شناخت کی تصدیق کی اجازت', roman: 'Shanakht ki tasdeeq ki ijazat', en: 'Check my identity' },
  c_documents: { ur: 'میرے کاغذات افسر دیکھ سکے', roman: 'Mere kaghazaat officer dekh sake', en: 'Officer can see my documents' },
  c_payment: { ur: 'رقم مجھے بھیجی جائے', roman: 'Raqam mujhe bheji jaye', en: 'Send payment to me' },
  send: { ur: 'درخواست بھیجیں', roman: 'Darkhast bhejein', en: 'Submit application' },

  // Connection & Offline
  saved_offline: {
    ur: 'انٹرنیٹ نہیں۔ کام محفوظ ہے، نیٹ آنے پر خود جائے گا۔',
    roman: 'Internet nahi. Kaam mehfooz hai, net aane par khud bhej diya jayega.',
    en: 'No internet. Your work is saved and will send itself later.'
  },
  online: { ur: 'آن لائن', roman: 'Online', en: 'Online' },
  offline: { ur: 'آف لائن', roman: 'Offline', en: 'Offline' },

  // Actions & Navigation Helpers
  why: { ur: 'ایسا کیوں ہوا؟', roman: 'Aisa kyun hua?', en: 'Why?' },
  appeal: { ur: 'دوبارہ جانچ کی درخواست کریں', roman: 'Dobara jaanch ki darkhast karein', en: 'Request human appeal' },
  withdraw: { ur: 'اجازت واپس لیں', roman: 'Ijazat wapis lein', en: 'Take back permission' },
  logout: { ur: 'لاگ آؤٹ', roman: 'Log out', en: 'Log out' },
  paste: { ur: 'پیغام یہاں ڈالیں', roman: 'Paigham yahan daalein', en: 'Paste message here' },
  sender: { ur: 'بھیجنے والا (نمبر/نام)', roman: 'Bhejne wala (number/naam)', en: 'Sender (number/name)' },
  check: { ur: 'چیک کریں', roman: 'Check karein', en: 'Check' },

  // Case Statuses & Workflow
  approved: { ur: 'منظور شدہ', roman: 'Manzoor shuda', en: 'Approved' },
  under_review: { ur: 'زیرِ جائزہ', roman: 'Zair-e-jaiza', en: 'Under Review' },
  needs_proof: { ur: 'دستاویز درکار', roman: 'Dastaweez darkaar', en: 'Proof Required' },
  declined: { ur: 'مسترد', roman: 'Mustared', en: 'Declined' },
  app_received: { ur: 'درخواست موصول', roman: 'Darkhast mosool', en: 'Application Received' },
  verification: { ur: 'شناخت کی تصدیق', roman: 'Shanakht ki tasdeeq', en: 'Verification' },
  payment_released: { ur: 'رقم جاری', roman: 'Raqam jaari', en: 'Payment Released' },
  final_decision: { ur: 'حتمی فیصلہ', roman: 'Hatmi faisla', en: 'Final Decision' },
  enter_details: { ur: 'اپنی معلومات درج کریں', roman: 'Apni maloomat darj karein', en: 'Enter your details' },
  processing_claim: { ur: 'آپ کی درخواست پر عمل ہو رہا ہے', roman: 'Aap ki darkhwast par amal ho raha hai', en: 'Your application is being processed' },
  awaiting_human: { ur: 'انسانی جائزہ کے لیے منتظر', roman: 'Insani jaiza ke liye muntazir', en: 'Awaiting Officer Review' },
  needs_consent: { ur: 'اجازت درکار ہے', roman: 'Ijazat darkaar hai', en: 'Consent Required' },
  paid: { ur: 'رقم ادا شدہ', roman: 'Raqam ada shuda', en: 'Payment Released' },
  submitted: { ur: 'جمع شدہ', roman: 'Jama shuda', en: 'Submitted' },

  // Navigation Tabs & Roles
  tab_families: { ur: 'خاندان', roman: 'Khandan', en: 'Families' },
  tab_queue: { ur: 'جائزہ قطار', roman: 'Review queue', en: 'Review queue' },
  tab_scam_map: { ur: 'اسکیم نقشہ', roman: 'Scam map', en: 'Scam map' },
  tab_risk: { ur: 'رسک ڈائل', roman: 'Risk dial', en: 'Risk dial' },
  tab_rules: { ur: 'قواعد و ڈیجیٹل ماڈل', roman: 'Rules aur Digital Twin', en: 'Rules & Twin' },
  tab_analytics: { ur: 'تجزیات', roman: 'Analytics', en: 'Analytics' },
  tab_audit: { ur: 'آڈٹ لاگ', roman: 'Audit log', en: 'Audit' },
  tab_admin: { ur: 'ایڈمن', roman: 'Admin', en: 'Admin' },
  tab_redteam: { ur: 'ریڈ ٹیم', roman: 'Red-Team', en: 'Red-Team' },
  tab_about: { ur: 'معلومات', roman: 'About', en: 'About' },
  tab_evaluation: { ur: 'تشخیص و جانچ', roman: 'Evaluation', en: 'Evaluation' },

  // Common UI Actions
  edit: { ur: 'تبدیل کریں', roman: 'Tabdeel karein', en: 'Edit' },
  cancel: { ur: 'منسوخ کریں', roman: 'Mansookh karein', en: 'Cancel' },
  close: { ur: 'بند کریں', roman: 'Band karein', en: 'Close' },
  save: { ur: 'محفوظ کریں', roman: 'Mehfooz karein', en: 'Save' },
  remove: { ur: 'ہٹائیں', roman: 'Hatayein', en: 'Remove' },
  details: { ur: 'تفصیلات', roman: 'Tafseelaat', en: 'Details' },
  required: { ur: 'لازمی', roman: 'Lazmi', en: 'Required' },
  optional: { ur: 'اختیاری', roman: 'Ikhtiyari', en: 'Optional' },
  loading: { ur: 'لوڈ ہو رہا ہے…', roman: 'Load ho raha hai…', en: 'Loading…' },
  pending: { ur: 'زیرِ التواء', roman: 'Zair-e-iltiwa', en: 'Pending' },
  sign_in: { ur: 'سائن ان کریں', roman: 'Sign In karein', en: 'Sign In' },
  password: { ur: 'پاس ورڈ', roman: 'Password', en: 'Password' },
  email_or_username: { ur: 'یوزر نیم یا ای میل', roman: 'Username ya email', en: 'Username or Email' },
  sync_center: { ur: 'سنک سینٹر', roman: 'Sync Center', en: 'Sync Center' },
  user: { ur: 'صارف', roman: 'User', en: 'User' },
  selected: { ur: 'منتخب شدہ', roman: 'Muntakhib shuda', en: 'Selected' }
}

const Ctx = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bh_lang') || 'ur')

  useEffect(() => {
    localStorage.setItem('bh_lang', lang)
    document.documentElement.lang = lang === 'ur' ? 'ur' : lang === 'roman' ? 'ur-Latn' : 'en'
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
  }, [lang])

  // RTL is strictly true ONLY when Urdu script is active
  const rtl = lang === 'ur'

  // Translation helper: looks up key in current lang, falls back to en, then raw key
  const t = (k, fb) => {
    const entry = S[k]
    if (entry) {
      if (lang === 'roman') return entry.roman || entry.en || k
      if (lang === 'ur') return entry.ur || entry.en || k
      return entry.en || entry.roman || k
    }
    return fb ?? k
  }

  // Multi-language string selector that guarantees Roman Urdu never displays Arabic script or falls back blindly
  const localize = (urduText, romanText, englishText) => {
    if (lang === 'roman') return romanText || englishText || urduText
    if (lang === 'ur') return urduText || englishText || romanText
    return englishText || romanText || urduText
  }

  return (
    <Ctx.Provider value={{ lang, setLang, t, localize, rtl }}>
      {children}
    </Ctx.Provider>
  )
}

export const useLang = () => useContext(Ctx)

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-switch-group" role="group" aria-label="Language">
      {[
        ['ur', 'اردو'],
        ['roman', 'Roman'],
        ['en', 'EN']
      ].map(([k, l]) => (
        <button
          key={k}
          type="button"
          className={lang === k ? 'on' : ''}
          onClick={() => setLang(k)}
          aria-pressed={lang === k}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
