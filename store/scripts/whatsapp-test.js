'use strict';
// تجربة ربط الواتساب قبل تشغيل المتجر
//   node scripts/whatsapp-test.js 05xxxxxxxx        ← يرسل رسالة hello_world التجريبية من Meta
//   node scripts/whatsapp-test.js 05xxxxxxxx otp    ← يرسل قالب رمز التحقق برمز تجريبي 123456
//   node scripts/whatsapp-test.js register 123456   ← يسجّل رقم الإرسال في Cloud API (الرقم = رمز PIN تختاره أنت)
//   node scripts/whatsapp-test.js templates         ← يعرض قوالب الرسائل وحالتها (معتمد / قيد المراجعة / مرفوض)
//   node scripts/whatsapp-test.js create-template   ← ينشئ قالب رمز التحقق (madhanah_otp) بالعربي ويحدّث ملف .env
const fs = require('fs');
const path = require('path');
const v = require('../src/lib/validate');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}

// أشهر أخطاء Meta وش معناها
const HINTS = {
  190: 'التوكن غير صالح أو انتهت صلاحيته — سوّ توكن جديد وحطه في WHATSAPP_TOKEN',
  10: 'التوكن ما عنده صلاحية — تأكد إنك اخترت whatsapp_business_messaging وأعطيت مستخدم النظام صلاحية على حساب الواتساب',
  200: 'التوكن ما عنده صلاحية — تأكد إنك اخترت whatsapp_business_messaging وأعطيت مستخدم النظام صلاحية على حساب الواتساب',
  100: 'معرّف الرقم (WHATSAPP_PHONE_NUMBER_ID) غلط، أو التوكن مو مربوط بنفس حساب الواتساب',
  131030: 'الرقم مو مضاف في قائمة المستلمين — رقم الاختبار يرسل بس للأرقام اللي أضفتها في خانة "إلى" بصفحة "الخطوة 1. جرّب"',
  132001: 'القالب غير موجود أو ما توافق عليه للحين، أو اللغة غلط — تأكد من WHATSAPP_TEMPLATE و WHATSAPP_TEMPLATE_LANG',
  132000: 'عدد المتغيرات في القالب ما يطابق — إذا قالبك ما فيه زر "نسخ الرمز" حط WHATSAPP_OTP_BUTTON=0',
  133010: 'رقم الإرسال مو مسجّل في Cloud API — سجّله بأمر:  node scripts/whatsapp-test.js register 123456  (بدّل 123456 برمز من اختيارك واحفظه)',
  133005: 'رمز PIN غلط — الرقم عليه تحقق بخطوتين برمز ثاني. استخدم نفس الرمز القديم أو غيّره من WhatsApp Manager',
};

function printError(res, data) {
  const err = data.error || {};
  console.log(`✖ Meta رفضت الطلب (${res.status}) — كود ${err.code ?? '?'}${err.error_subcode ? `/${err.error_subcode}` : ''}`);
  console.log(`  الرسالة: ${err.message || JSON.stringify(data).slice(0, 300)}`);
  if (err.error_data && err.error_data.details) console.log(`  التفاصيل: ${err.error_data.details}`);
  if (HINTS[err.code]) console.log(`  وش أسوي: ${HINTS[err.code]}`);
}

// تسجيل رقم الإرسال في Cloud API (مرة وحدة) — الـ PIN يصير رمز التحقق بخطوتين للرقم
async function registerNumber(pin) {
  const e = process.env;
  if (!/^\d{6}$/.test(pin || '')) {
    console.log('✖ اكتب رمز PIN من 6 أرقام تختاره أنت، مثال:\n  node scripts/whatsapp-test.js register 482915');
    process.exit(1);
  }
  const missing = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'].filter((k) => !e[k]);
  if (missing.length) {
    console.log(`✖ ناقص في ملف .env: ${missing.join('، ')}`);
    process.exit(1);
  }
  console.log(`… نسجّل الرقم (${e.WHATSAPP_PHONE_NUMBER_ID}) في Cloud API`);
  const res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_API_VERSION || 'v25.0'}/${encodeURIComponent(e.WHATSAPP_PHONE_NUMBER_ID)}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success !== false) {
    console.log('✔ تم تسجيل الرقم! احفظ رمز الـ PIN عندك (هو رمز التحقق بخطوتين لرقم الواتساب).');
    console.log('  الحين جرّب الإرسال:  node scripts/whatsapp-test.js رقمك');
    return;
  }
  printError(res, data);
  process.exit(1);
}

const STATUS_AR = { APPROVED: '✔ معتمد', PENDING: '… قيد المراجعة', REJECTED: '✖ مرفوض', PAUSED: '⏸ موقوف مؤقتاً', DISABLED: '✖ معطّل' };

// يعرض قوالب حساب الواتساب المرتبط برقم الإرسال
async function listTemplates() {
  const e = process.env;
  if (!e.WHATSAPP_TOKEN || !e.WHATSAPP_PHONE_NUMBER_ID) {
    console.log('✖ ناقص في ملف .env: WHATSAPP_TOKEN أو WHATSAPP_PHONE_NUMBER_ID');
    process.exit(1);
  }
  const ver = e.WHATSAPP_API_VERSION || 'v25.0';
  const headers = { Authorization: `Bearer ${e.WHATSAPP_TOKEN}` };
  // معرّف حساب واتساب للأعمال: من .env، أو من صلاحيات التوكن نفسه
  let waba = e.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!waba) {
    const r = await fetch(`https://graph.facebook.com/${ver}/debug_token?input_token=${encodeURIComponent(e.WHATSAPP_TOKEN)}`, { headers });
    const d = await r.json().catch(() => ({}));
    const scope = ((d.data && d.data.granular_scopes) || []).find((s) => s.scope === 'whatsapp_business_management');
    waba = scope && scope.target_ids && scope.target_ids[0];
  }
  if (!waba) {
    console.log('✖ ما قدرت أعرف حساب الواتساب — حط في .env:  WHATSAPP_BUSINESS_ACCOUNT_ID=معرّف_حساب_واتساب_للأعمال');
    process.exit(1);
  }
  const res = await fetch(`https://graph.facebook.com/${ver}/${encodeURIComponent(waba)}/message_templates?fields=name,status,category,language,rejected_reason&limit=100`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    printError(res, data);
    process.exit(1);
  }
  const list = data.data || [];
  console.log(`قوالب حساب الواتساب (${list.length}):`);
  for (const t of list) {
    const reason = t.rejected_reason && t.rejected_reason !== 'NONE' ? `  — سبب الرفض: ${t.rejected_reason}` : '';
    console.log(`  • ${t.name}  [${t.language}]  ${t.category}  ${STATUS_AR[t.status] || t.status}${reason}`);
  }
  const auth = list.filter((t) => t.category === 'AUTHENTICATION');
  if (!auth.length) console.log('\n  ما فيه قالب من فئة المصادقة (AUTHENTICATION) للحين — أنشئه من WhatsApp Manager.');
  const ok = auth.find((t) => t.status === 'APPROVED');
  if (ok) {
    console.log(`\n  حط في ملف .env:\n    WHATSAPP_TEMPLATE=${ok.name}\n    WHATSAPP_TEMPLATE_LANG=${ok.language}`);
  }
}

// يكتب قيمة في ملف .env (يستبدل السطر لو موجود)
function setEnv(key, value) {
  let s = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  s = re.test(s) ? s.replace(re, `${key}=${value}`) : `${s.replace(/\s*$/, '\n')}${key}=${value}\n`;
  fs.writeFileSync(envFile, s);
}

// ينشئ قالب مصادقة (رمز تحقق) بالعربي مع زر "نسخ الرمز"
async function createTemplate(name = 'madhanah_otp') {
  const e = process.env;
  if (!e.WHATSAPP_TOKEN || !e.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.log('✖ ناقص في ملف .env: WHATSAPP_TOKEN أو WHATSAPP_BUSINESS_ACCOUNT_ID');
    process.exit(1);
  }
  if (!/^[a-z0-9_]{1,512}$/.test(name)) {
    console.log('✖ اسم القالب لازم يكون حروف إنجليزية صغيرة وأرقام و _ بس');
    process.exit(1);
  }
  console.log(`… ننشئ قالب "${name}" (مصادقة، عربي، زر نسخ الرمز، صلاحية 5 دقائق)`);
  const res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_API_VERSION || 'v25.0'}/${encodeURIComponent(e.WHATSAPP_BUSINESS_ACCOUNT_ID)}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      language: 'ar',
      category: 'AUTHENTICATION',
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 5 },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'نسخ الرمز' }] },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    printError(res, data);
    process.exit(1);
  }
  console.log(`✔ انرسل القالب — الحالة: ${STATUS_AR[data.status] || data.status}`);
  setEnv('WHATSAPP_TEMPLATE', name);
  setEnv('WHATSAPP_TEMPLATE_LANG', 'ar');
  setEnv('WHATSAPP_OTP_BUTTON', '1');
  console.log('  حدّثت ملف .env باسم القالب.');
  if (data.status === 'APPROVED') console.log('  جرّب الحين:');
  else console.log('  انتظر الموافقة (شيّك بـ: node scripts/whatsapp-test.js templates) وبعدها جرّب:');
  console.log('    node scripts/whatsapp-test.js 05xxxxxxxx otp');
}

async function main() {
  const [rawPhone, mode] = process.argv.slice(2);
  if (rawPhone === 'register') return registerNumber(mode);
  if (rawPhone === 'templates') return listTemplates();
  if (rawPhone === 'create-template') return createTemplate(mode);
  if (!rawPhone) {
    console.log('الاستخدام:\n  node scripts/whatsapp-test.js 05xxxxxxxx\n  node scripts/whatsapp-test.js 05xxxxxxxx otp\n  node scripts/whatsapp-test.js register 123456');
    process.exit(1);
  }
  const e = process.env;
  const missing = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'].concat(mode === 'otp' ? ['WHATSAPP_TEMPLATE'] : []).filter((k) => !e[k]);
  if (missing.length) {
    console.log(`✖ ناقص في ملف .env: ${missing.join('، ')}`);
    process.exit(1);
  }
  const to = v.phone(rawPhone).replace(/\D/g, '');
  const version = e.WHATSAPP_API_VERSION || 'v25.0';
  const template = mode === 'otp'
    ? {
      name: e.WHATSAPP_TEMPLATE,
      language: { code: e.WHATSAPP_TEMPLATE_LANG || 'ar' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
        ...(e.WHATSAPP_OTP_BUTTON === '0' ? [] : [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '123456' }] }]),
      ],
    }
    : { name: 'hello_world', language: { code: 'en_US' } };

  console.log(`… نرسل ${mode === 'otp' ? `قالب "${template.name}"` : 'hello_world'} إلى +${to}`);
  const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(e.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log('✔ انرسلت! شيّك على الواتساب في جوالك.');
    if (mode !== 'otp') {
      console.log('  الخطوة الجاية: بعد ما يتوافق قالب التحقق، جرّب الأمر هذا:');
      console.log(`    node scripts/whatsapp-test.js ${rawPhone} otp`);
    }
    return;
  }
  printError(res, data);
  process.exit(1);
}

main().catch((er) => {
  console.error('✖', er.message || er);
  process.exit(1);
});
