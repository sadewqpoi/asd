'use strict';
// رموز التحقق (OTP) وإرسالها بالواتساب عبر WhatsApp Cloud API الرسمي من Meta
// إذا ما انضبطت بيانات الواتساب في .env يشتغل "وضع التجربة": الرمز يطلع في نافذة السيرفر بس
const crypto = require('crypto');
const { HttpError } = require('../http/router');
const sec = require('./security');

const CODE_TTL = 5 * 60e3; // صلاحية الرمز
const PENDING_TTL = 20 * 60e3; // صلاحية عملية التحقق كاملة
const RESEND_AFTER = 60e3; // لازم ينتظر دقيقة قبل إعادة الإرسال
const MAX_ATTEMPTS = 5; // محاولات إدخال الرمز
const MAX_SENDS = 5; // عدد مرات الإرسال لنفس العملية

function whatsappConfig() {
  const e = process.env;
  return {
    token: e.WHATSAPP_TOKEN || '',
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID || '',
    template: e.WHATSAPP_TEMPLATE || '',
    lang: e.WHATSAPP_TEMPLATE_LANG || 'ar',
    version: e.WHATSAPP_API_VERSION || 'v25.0',
    // قوالب "المصادقة" عند Meta فيها زر نسخ الرمز ولازم نرسل الرمز له بعد
    button: e.WHATSAPP_OTP_BUTTON !== '0',
  };
}

const isConfigured = () => {
  const c = whatsappConfig();
  return Boolean(c.token && c.phoneNumberId && c.template);
};

const maskPhone = (p) => (p && p.length > 7 ? `${p.slice(0, 4)} ••• ${p.slice(-4)}` : p);

async function sendWhatsApp(phone, code) {
  if (!isConfigured()) {
    console.log(`\n  [واتساب - وضع التجربة] رمز التحقق للرقم ${phone}:  ${code}\n  (الرمز ما انرسل فعلياً — اضبط بيانات WhatsApp في ملف .env)\n`);
    return;
  }
  const c = whatsappConfig();
  const components = [{ type: 'body', parameters: [{ type: 'text', text: code }] }];
  if (c.button) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] });
  let res;
  try {
    res = await fetch(`https://graph.facebook.com/${c.version}/${encodeURIComponent(c.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/\D/g, ''),
        type: 'template',
        template: { name: c.template, language: { code: c.lang }, components },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    console.error('✖ تعذر الاتصال بـ WhatsApp API:', e.message);
    throw new HttpError(502, 'تعذر إرسال رمز التحقق بالواتساب، حاول بعد شوي');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`✖ WhatsApp API رجّع خطأ (${res.status}):`, body.slice(0, 600));
    throw new HttpError(502, 'تعذر إرسال رمز التحقق بالواتساب — تأكد إن الرقم عليه واتساب');
  }
}

// العمليات المعلّقة محفوظة بالذاكرة بس (لو انطفى السيرفر يطلب العميل رمز جديد)
class OtpStore {
  constructor() {
    this.items = new Map();
    this.phoneLimiter = sec.rateLimiter({ windowMs: 60 * 60e3, max: 6 });
    this.ipLimiter = sec.rateLimiter({ windowMs: 60 * 60e3, max: 20 });
    setInterval(() => {
      const now = Date.now();
      for (const [id, p] of this.items) if (p.expiresAt < now) this.items.delete(id);
    }, 60e3).unref();
  }

  create(purpose, data, ip) {
    const id = crypto.randomBytes(18).toString('base64url');
    const p = {
      id, purpose, data, ip, phone: data.phone || '', codeHash: null, codeExp: 0,
      attempts: 0, sends: 0, lastSentAt: 0, expiresAt: Date.now() + PENDING_TTL,
    };
    this.items.set(id, p);
    return p;
  }

  get(id) {
    const p = typeof id === 'string' ? this.items.get(id) : null;
    if (!p || p.expiresAt < Date.now()) {
      if (p) this.items.delete(id);
      throw new HttpError(410, 'انتهت مهلة التحقق — ابدأ من جديد');
    }
    return p;
  }

  remove(p) { this.items.delete(p.id); }

  // يولّد رمز جديد ويرسله، مع حماية من الإرسال الكثير (كل رسالة واتساب عليها تكلفة)
  async send(p) {
    const now = Date.now();
    if (!p.phone) throw new HttpError(400, 'أضف رقم الجوال أولاً');
    const wait = p.lastSentAt + RESEND_AFTER - now;
    if (wait > 0) throw new HttpError(429, `انتظر ${Math.ceil(wait / 1000)} ثانية قبل إعادة الإرسال`);
    if (p.sends >= MAX_SENDS) throw new HttpError(429, 'وصلت للحد الأقصى من الرسائل — ابدأ من جديد بعد شوي');
    if (!this.phoneLimiter.hit(p.phone) || !this.ipLimiter.hit(p.ip)) {
      throw new HttpError(429, 'طلبت رموز كثيرة — حاول بعد ساعة');
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const prevSentAt = p.lastSentAt;
    p.lastSentAt = now; // يمنع طلبين بنفس اللحظة يرسلون رسالتين
    try {
      await sendWhatsApp(p.phone, code);
    } catch (e) {
      p.lastSentAt = prevSentAt;
      throw e;
    }
    p.codeHash = sec.sha256(`${p.id}:${code}`);
    p.codeExp = now + CODE_TTL;
    p.attempts = 0;
    p.sends += 1;
    return this.view(p);
  }

  check(p, code) {
    const clean = String(code || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '');
    if (!p.codeHash) throw new HttpError(400, 'اطلب رمز التحقق أولاً');
    if (Date.now() > p.codeExp) throw new HttpError(400, 'انتهت صلاحية الرمز — اضغط "إعادة الإرسال"');
    if (p.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'محاولات كثيرة — اضغط "إعادة الإرسال" لرمز جديد');
    p.attempts += 1;
    if (clean.length !== 6 || !sec.safeEqual(sec.sha256(`${p.id}:${clean}`), p.codeHash)) {
      const left = MAX_ATTEMPTS - p.attempts;
      throw new HttpError(400, left > 0 ? `الرمز غير صحيح — باقي لك ${left} محاولات` : 'الرمز غير صحيح — اضغط "إعادة الإرسال" لرمز جديد');
    }
  }

  view(p) {
    return {
      id: p.id,
      purpose: p.purpose,
      phone: maskPhone(p.phone),
      resendIn: Math.max(0, Math.ceil((p.lastSentAt + RESEND_AFTER - Date.now()) / 1000)),
    };
  }
}

module.exports = { OtpStore, isConfigured, maskPhone };
