'use strict';
// لوحة التحكم — الحالة العامة والقائمة وأدوات صغيرة مشتركة

// =====================================================================
//  لوحة التحكم — كل الصلاحيات تتحقق منها السيرفر، هنا بس نخفي اللي ما يخصك
// =====================================================================

const A = { me: null, store: null, perms: {}, statuses: {}, routeId: 0, dirtyGuard: null };

const NAV = [
  { key: 'dashboard', label: 'الرئيسية', icon: 'home' },
  { key: 'orders', label: 'الطلبات', icon: 'receipt', perm: 'orders' },
  { key: 'products', label: 'المنتجات', icon: 'box', perm: 'products' },
  { key: 'categories', label: 'قوائم المنتجات', icon: 'list', perm: 'categories' },
  { key: 'customers', label: 'العملاء', icon: 'users', perm: 'customers' },
  { key: 'media', label: 'مكتبة الصور', icon: 'image', perm: 'media' },
  { key: 'design', label: 'تعديل المتجر', icon: 'palette', perm: 'design' },
  { key: 'pages', label: 'الصفحات', icon: 'file', perm: 'design' },
  { key: 'admins', label: 'المشرفين', icon: 'shieldCheck', perm: 'admins' },
  { key: 'account', label: 'حسابي', icon: 'user' },
];

const STATUS_CLASS = { pending_payment: 'warn', under_review: 'info', processing: 'primary', completed: 'ok', cancelled: 'danger' };
const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024;

const can = (p) => Boolean(A.me) && (A.me.role === 'owner' || A.me.permissions.includes(p));
const money = (n) => `<span class="money"><span class="num">${fmtNum(n)}</span> <span class="cur">${esc(A.store.currency)}</span></span>`;
const initial = (name) => String(name || '؟').trim().charAt(0) || '؟';
const thumb = (url) => (url ? `<img class="thumb" src="${esc(url)}" alt="" loading="lazy">` : `<span class="thumb-empty">${icon('image', 'i-sm')}</span>`);
const emptyHtml = (ic, title, text = '') => `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
const LOADING = '<div class="loading-box"><div class="spinner"></div></div>';
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const sw = (name, checked, label, attrs = '') => `<label class="switch"><input type="checkbox" name="${name}"${checked ? ' checked' : ''} ${attrs}><span class="track"></span>${label ? `<span>${label}</span>` : ''}</label>`;

// أي طلب يرجع 401 معناه الجلسة انتهت → نرجع لصفحة الدخول
async function aapi(method, url, body) {
  try {
    return await api(method, url, body);
  } catch (e) {
    if (e.status === 401 && A.me) {
      A.me = null;
      toast('انتهت الجلسة — سجّل دخولك مرة ثانية', 'err');
      renderLogin();
    }
    throw e;
  }
}

function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function onSubmit(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const err = form.querySelector('[data-err]');
    if (err) err.hidden = true;
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    try {
      await fn(formData(form));
    } catch (ex) {
      if (err && err.isConnected) { err.textContent = ex.message; err.hidden = false; } else toast(ex.message, 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    }
  });
}

function pwField(name, label, ac = 'new-password', hint = '') {
  return `<label class="field"><span>${label}</span>
    <div class="input-group"><input class="input" type="password" name="${name}" required minlength="8" maxlength="128" autocomplete="${ac}">
    <button type="button" class="btn btn-ghost btn-icon btn-sm addon" data-eye aria-label="إظهار كلمة المرور">${icon('eye')}</button></div>
    ${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function bindEyes(root) {
  $$('[data-eye]', root).forEach((b) => b.addEventListener('click', () => {
    const input = b.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.innerHTML = icon(show ? 'eyeOff' : 'eye');
  }));
}
