'use strict';
// تنظيف وتحقق من كل المدخلات اللي توصل للسيرفر
const { HttpError } = require('../http/router');

function toLatinDigits(s) {
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

function str(v, { max = 200, min = 0, field = 'الحقل', multiline = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, `${field}: قيمة غير صالحة`);
  let s = String(v);
  s = multiline
    ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.trim();
  if (s.length < min) throw new HttpError(400, min === 1 ? `${field} مطلوب` : `${field} قصير جداً`);
  if (s.length > max) throw new HttpError(400, `${field} طويل جداً (الحد ${max} حرف)`);
  return s;
}

function num(v, { min = 0, max = 1e9, field = 'الرقم', integer = false, optional = false } = {}) {
  if (optional && (v === '' || v === null || v === undefined)) return null;
  const n = typeof v === 'number' ? v : Number(toLatinDigits(String(v ?? '')).trim());
  if (v === '' || v === null || v === undefined || !Number.isFinite(n)) throw new HttpError(400, `${field}: أدخل رقم صحيح`);
  if (integer && !Number.isInteger(n)) throw new HttpError(400, `${field}: لازم يكون رقم صحيح بدون كسور`);
  if (n < min || n > max) throw new HttpError(400, `${field}: لازم يكون بين ${min} و ${max}`);
  return integer ? n : Math.round(n * 100) / 100;
}

function bool(v) {
  return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
}

// روابط مسموحة: مسار داخلي (/...)، رابط مرساة (#...)، http(s)، mailto، tel
function safeUrl(v, { field = 'الرابط' } = {}) {
  const s = str(v, { max: 500, field });
  if (!s) return '';
  if (/\s/.test(s)) throw new HttpError(400, `${field} فيه مسافات`);
  if (/^\/(?![/\\])/.test(s) || /^#[\w\-؀-ۿ]*$/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) {
    try { new URL(s); } catch { throw new HttpError(400, `${field} غير صالح`); }
    return s;
  }
  if (/^(mailto|tel):[^<>"']+$/i.test(s)) return s;
  throw new HttpError(400, `${field} غير صالح — لازم يبدأ بـ https:// أو /`);
}

// الصور لازم تكون من صور المتجر نفسه (المرفوعة أو الافتراضية)
function imageRef(v, { field = 'الصورة' } = {}) {
  const s = str(v, { max: 300, field });
  if (!s) return '';
  if (!/^\/(uploads|img)\/[A-Za-z0-9_\-./]+$/.test(s) || s.includes('..')) throw new HttpError(400, `${field} غير صالحة`);
  return s;
}

function color(v, fallback) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

function phone(v) {
  let s = toLatinDigits(String(v ?? '')).replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^05\d{8}$/.test(s)) s = '+966' + s.slice(1);
  else if (/^5\d{8}$/.test(s)) s = '+966' + s;
  else if (/^966\d{9}$/.test(s)) s = '+' + s;
  if (!s.startsWith('+')) s = '+' + s;
  if (!/^\+\d{8,15}$/.test(s)) throw new HttpError(400, 'رقم الجوال غير صحيح — مثال: 05xxxxxxxx');
  return s;
}

function email(v) {
  const s = toLatinDigits(str(v, { max: 120, field: 'الإيميل' })).toLowerCase();
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(s)) throw new HttpError(400, 'الإيميل غير صحيح');
  return s;
}

// معرّف الدخول: إيميل أو رقم جوال
function identifier(v) {
  const raw = str(v, { max: 120, min: 1, field: 'الإيميل أو رقم الجوال' });
  if (raw.includes('@')) return { type: 'email', value: email(raw) };
  if (!/^[\d\s\-().+]+$/.test(toLatinDigits(raw))) {
    throw new HttpError(400, 'اكتب إيميل صحيح (مثل name@gmail.com) أو رقم جوال (مثل 05xxxxxxxx)');
  }
  return { type: 'phone', value: phone(raw) };
}

function password(v, field = 'كلمة المرور') {
  if (typeof v !== 'string' || v.length < 8) throw new HttpError(400, `${field} لازم تكون 8 أحرف على الأقل`);
  if (v.length > 128) throw new HttpError(400, `${field} طويلة جداً`);
  return v;
}

function arr(v, { max = 50, field = 'القائمة' } = {}) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new HttpError(400, `${field}: قيمة غير صالحة`);
  if (v.length > max) throw new HttpError(400, `${field}: الحد الأقصى ${max} عنصر`);
  return v;
}

module.exports = { toLatinDigits, str, num, bool, safeUrl, imageRef, color, phone, email, identifier, password, arr };
