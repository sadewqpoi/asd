'use strict';
// أدوات مشتركة بين المتجر ولوحة التحكم

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// كل نص ديناميكي يمر من هنا قبل ما ينحط في الصفحة
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeUrl(u) {
  u = String(u || '').trim();
  if (/^\/(?![/\\])/.test(u) || u.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(u)) return u;
  return '#';
}

const isExternal = (u) => /^https?:/i.test(u) && !u.startsWith(location.origin);
const linkAttrs = (u) => `href="${esc(safeUrl(u))}"${isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}`;

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

function fmtDate(ts, withTime = true) {
  if (!ts) return '—';
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
  return new Date(ts).toLocaleString('ar-u-ca-gregory-nu-latn', opts);
}

function toLatinDigits(s) {
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660));
}

async function api(method, url, body) {
  const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body || {});
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new Error('تعذر الاتصال بالسيرفر — تأكد من الإنترنت');
  }
  let data = null;
  try { data = await res.json(); } catch { /* رد فاضي */ }
  if (!res.ok) {
    const e = new Error((data && data.error) || `خطأ غير متوقع (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const store = {
  get(k, d) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* التخزين مقفل */ }
  },
};

// ---------- الأيقونات (SVG ثابتة) ----------
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.7V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.7"/>',
  bag: '<path d="M5.5 8h13l1 12a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7h2c3 0 5.6-2.5 5.6-5.5C22 6 17.5 2 12 2z"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M16 8H8M16 12H8M13 16H8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  store: '<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M3 9.5h18v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-4h4v4"/>',
  bank: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
};

function icon(name, cls = '') {
  const filled = name === 'star';
  return `<svg class="i${filled ? ' fill' : ''}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ---------- تنبيهات سريعة ----------
function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast${type === 'err' ? ' err' : ''}`;
  el.innerHTML = `${icon(type === 'err' ? 'alert' : 'checkCircle')}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 4500 : 2600);
}

// ---------- نافذة منبثقة ----------
function openModal({ title, body = '', foot = '', size = '', onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-icon" data-close aria-label="إغلاق">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  const prevFocus = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.remove();
    document.removeEventListener('keydown', onKey);
    if (!$('.modal-backdrop')) document.body.classList.remove('modal-open');
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && back === $$('.modal-backdrop').pop()) close();
  };
  back.addEventListener('mousedown', (e) => {
    if (e.target === back) close();
  });
  back.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  document.body.classList.add('modal-open');
  const first = back.querySelector('.modal-body input:not([type=hidden]):not([readonly]), .modal-body select, .modal-body textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return { el: back, body: back.querySelector('.modal-body'), close };
}

function confirmDialog(message, { title = 'تأكيد', ok = 'تأكيد', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal({
      title,
      size: 'sm',
      body: `<p>${esc(message)}</p>`,
      foot: `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button><button class="btn btn-outline" data-close>إلغاء</button>`,
      onClose: () => resolve(result),
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      result = true;
      m.close();
    });
    setTimeout(() => m.el.querySelector('[data-ok]').focus(), 30);
  });
}

// يشغّل دالة غير متزامنة مع حالة تحميل على الزر ويطلع رسالة الخطأ
async function withBusy(btn, fn) {
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try {
    return await fn();
  } catch (e) {
    toast(e.message || 'صار خطأ', 'err');
    return undefined;
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('تم النسخ');
}

// لون النص المناسب فوق اللون الأساسي (أبيض أو أسود)
function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.179 ? '#111' : '#fff';
}

function applyPrimary(hex) {
  document.documentElement.style.setProperty('--primary', hex);
  document.documentElement.style.setProperty('--on-primary', inkFor(hex));
}

function applyAccent(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--on-accent', inkFor(hex));
}
