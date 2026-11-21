import { createContext, useContext, useEffect, useState } from 'react'

// Urdu (script), Roman Urdu, English. Citizen screens are icon-first; text is a helper, voice is the main channel.
const S = {
  app: { ur: 'بھروسہ', roman: 'Bharosa', en: 'Bharosa' },
  proto: { ur: 'تجرباتی نمونہ - سرکاری سروس نہیں', roman: 'Tajarbati namoona - sarkari service nahi', en: 'PROTOTYPE - not an official service' },
  hello: { ur: 'خوش آمدید', roman: 'Khush aamdeed', en: 'Welcome' },
  claim: { ur: 'امداد کے لیے درخواست', roman: 'Imdad ke liye darkhast', en: 'Apply for relief' },
  scam: { ur: 'یہ پیغام اصلی ہے؟', roman: 'Yeh paigham asli hai?', en: 'Is this message real?' },
  ask: { ur: 'سوال پوچھیں', roman: 'Sawal poochein', en: 'Ask a question' },
  mydata: { ur: 'میرا ڈیٹا', roman: 'Mera data', en: 'My data' },
  mycases: { ur: 'میری درخواستیں', roman: 'Meri darkhastein', en: 'My requests' },
  next: { ur: 'آگے', roman: 'Aage', en: 'Next' },
  back: { ur: 'پیچھے', roman: 'Peeche', en: 'Back' },
  yes: { ur: 'ہاں', roman: 'Haan', en: 'Yes' },
  no: { ur: 'نہیں', roman: 'Nahi', en: 'No' },
  speak: { ur: 'بولیں', roman: 'Bolein', en: 'Speak' },
  listening: { ur: 'سن رہا ہوں…', roman: 'Sun raha hoon…', en: 'Listening…' },
  name: { ur: 'آپ کا نام', roman: 'Aap ka naam', en: 'Your name' },
  father: { ur: 'والد کا نام', roman: 'Walid ka naam', en: "Father's name" },
  cnic: { ur: 'شناختی کارڈ نمبر', roman: 'Shanakhti card number', en: 'ID card number' },
  dob: { ur: 'تاریخ پیدائش', roman: 'Tareekh-e-paidaish', en: 'Date of birth' },
  status: { ur: 'آپ کی حیثیت', roman: 'Aap ki haisiyat', en: 'Your situation' },
  widow: { ur: 'بیوہ', roman: 'Bewa', en: 'Widowed' },
  married: { ur: 'شادی شدہ', roman: 'Shadi shuda', en: 'Married' },
  other: { ur: 'دوسرا', roman: 'Doosra', en: 'Other' },
  income: { ur: 'مہینے کی کمائی', roman: 'Mahine ki kamai', en: 'Monthly income' },
  household: { ur: 'گھر میں کتنے لوگ', roman: 'Ghar mein kitne log', en: 'People in your home' },
  district: { ur: 'علاقہ', roman: 'Ilaqa', en: 'Area' },
  photo: { ur: 'شناختی کارڈ کی تصویر', roman: 'Shanakhti card ki tasveer', en: 'Photo of your ID card' },
  takephoto: { ur: 'تصویر لیں', roman: 'Tasveer lein', en: 'Take photo' },
  skip: { ur: 'چھوڑ دیں', roman: 'Chhor dein', en: 'Skip' },
  consent_title: { ur: 'آپ کی اجازت', roman: 'Aap ki ijazat', en: 'Your permission' },
  c_identity: { ur: 'شناخت کی جانچ', roman: 'Shanakht ki jaanch', en: 'Check my identity' },
  c_documents: { ur: 'میرے کاغذات افسر دیکھ سکے', roman: 'Mere kaghazaat officer dekh sake', en: 'Officer can see my documents' },
  c_payment: { ur: 'رقم مجھے بھیجی جائے', roman: 'Raqam mujhe bheji jaye', en: 'Send payment to me' },
  send: { ur: 'بھیجیں', roman: 'Bhejein', en: 'Send' },
  saved_offline: { ur: 'انٹرنیٹ نہیں۔ کام محفوظ ہے، نیٹ آنے پر خود جائے گا۔', roman: 'Internet nahi. Kaam mehfooz hai, net aane par khud jayega.', en: 'No internet. Your work is saved and will send itself later.' },
  online: { ur: 'انٹرنیٹ ہے', roman: 'Internet hai', en: 'Online' },
  offline: { ur: 'انٹرنیٹ نہیں', roman: 'Internet nahi', en: 'Offline' },
  why: { ur: 'ایسا کیوں ہوا؟', roman: 'Aisa kyun hua?', en: 'Why?' },
  appeal: { ur: 'انسان سے دوبارہ دیکھوائیں', roman: 'Insaan se dobara dekhwayein', en: 'Ask a person to check' },
  withdraw: { ur: 'اجازت واپس', roman: 'Ijazat wapis', en: 'Take back' },
  logout: { ur: 'باہر', roman: 'Bahar', en: 'Log out' },
  paste: { ur: 'پیغام یہاں ڈالیں', roman: 'Paigham yahan daalein', en: 'Paste the message here' },
  sender: { ur: 'بھیجنے والا (نمبر/نام)', roman: 'Bhejne wala (number/naam)', en: 'Sender (number/name)' },
  check: { ur: 'چیک کریں', roman: 'Check karein', en: 'Check' },
}

const Ctx = createContext(null)
export function LangProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('bh_lang') || 'ur')
  useEffect(() => { localStorage.setItem('bh_lang', lang); document.documentElement.lang = lang === 'ur' ? 'ur' : 'en' }, [lang])
  const t = (k) => S[k]?.[lang] ?? S[k]?.en ?? k
  return <Ctx.Provider value={{ lang, setLang, t, rtl: lang === 'ur' }}>{children}</Ctx.Provider>
}
export const useLang = () => useContext(Ctx)
export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-switch-group" role="group" aria-label="Language">
      {[['ur', 'اردو'], ['roman', 'Roman'], ['en', 'EN']].map(([k, l]) => (
        <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>{l}</button>
      ))}
    </div>
  )
}
