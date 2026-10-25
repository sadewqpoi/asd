'use strict';
// واجهة المتجر — حساب العميل (طلباتي، بياناتي)

const STATUS_LABELS = {
  pending_payment: 'بانتظار الدفع', under_review: 'بانتظار المراجعة', processing: 'قيد التنفيذ', completed: 'تم التنفيذ', cancelled: 'ملغي',
};

// ---------- صفحة الحساب: تبويبات تنتقل بسلاسة (الخط تحت التبويب ينزلق للمكان الجديد) ----------
const ACCOUNT_TABS = [['orders', 'طلباتي', '/account'], ['wishlist', 'المفضلة', '/wishlist'], ['profile', 'بياناتي', '/account?tab=profile']];
const isAccountPath = (path) => path === '/account' || path === '/wishlist';
const accountTabFromUrl = () => {
  if (location.pathname.replace(/\/+$/, '') === '/wishlist') return 'wishlist';
  return new URLSearchParams(location.search).get('tab') === 'profile' ? 'profile' : 'orders';
};

// يحرك الخط تحت التبويب المختار (animate = false للمكان الأول بدون حركة)
function moveInk(tabsEl, animate) {
  const on = $('.on', tabsEl);
  const ink = $('.tabs-ink', tabsEl);
  if (!on || !ink) return;
  if (!animate) ink.style.transition = 'none';
  ink.style.width = `${on.offsetWidth}px`;
  ink.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!animate) {
    void ink.offsetWidth;
    ink.style.transition = '';
  }
}

function accountOrdersHtml(orders) {
  return orders.length
    ? `<div class="card olist">${orders.map((o) => `<a class="orow" href="/account/orders/${o.id}">
        <strong class="num">#${o.id}</strong>
        <span class="small muted">${fmtDate(o.createdAt, false)} · ${o.count} منتج</span>
        <span class="badge ${STATUS_CLASS[o.status] || ''}">${esc(o.statusLabel)}</span>
        <strong>${money(o.total)}</strong></a>`).join('')}</div>`
    : `<div class="card">${emptyHtml('receipt', 'ما عندك طلبات للحين')}<div class="center-row"><a class="btn btn-primary" href="/">تصفح المنتجات</a></div></div>`;
}

function accountProfileHtml() {
  return `<div class="grid-2 align-start">
    <form class="card box stack" data-profile><h3>بياناتي</h3>
      <label class="field"><span>الاسم</span><input class="input" name="name" value="${esc(S.me.name)}" required maxlength="60"></label>
      ${S.me.email ? `<label class="field"><span>الإيميل</span><input class="input ltr" value="${esc(S.me.email)}" readonly></label>` : ''}
      ${S.me.phone ? `<label class="field"><span>رقم الجوال</span><input class="input ltr" value="${esc(S.me.phone)}" readonly></label>` : ''}
      <button class="btn btn-primary" type="submit">حفظ</button></form>
    <form class="card box stack" data-pass><h3>تغيير كلمة المرور</h3>
      <label class="field"><span>كلمة المرور الحالية</span><input class="input" type="password" name="current" required autocomplete="current-password"></label>
      <label class="field"><span>كلمة المرور الجديدة</span><input class="input" type="password" name="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn btn-outline" type="submit">تغيير كلمة المرور</button></form></div>`;
}

function bindAccountProfile(root) {
  const pf = $('[data-profile]', root);
  pf.addEventListener('submit', (e) => {
    e.preventDefault();
    withBusy(pf.querySelector('button'), async () => {
      S.me = (await api('PUT', '/api/auth/me', formData(pf))).customer;
      renderUserMenu();
      toast('تم الحفظ');
    });
  });
  const pw = $('[data-pass]', root);
  pw.addEventListener('submit', (e) => {
    e.preventDefault();
    withBusy(pw.querySelector('button'), async () => {
      await api('POST', '/api/auth/password', formData(pw));
      pw.reset();
      toast('تم تغيير كلمة المرور');
    });
  });
}

async function viewAccount(app, ctx) {
  setTitle('حسابي');
  if (!S.me) return loginRequired(app, 'سجّل دخولك عشان تشوف طلباتك');
  app.innerHTML = `<div class="order-head"><div><h1 class="page-title tight">أهلاً ${esc(S.me.name)}</h1><p class="small muted ltr">${esc(S.me.email || S.me.phone)}</p></div>
      <button class="btn btn-outline" data-logout>${icon('logout')}تسجيل خروج</button></div>
    <nav class="tabs has-ink" data-acc-tabs aria-label="حسابي">
      ${ACCOUNT_TABS.map(([k, label, href]) => `<a href="${href}" data-acc-tab="${k}">${label}</a>`).join('')}
      <span class="tabs-ink" aria-hidden="true"></span>
    </nav>
    <div data-tab-body></div>`;
  const tabsEl = $('[data-acc-tabs]', app);
  const body = $('[data-tab-body]', app);
  const cache = {};
  let current = null;
  let seq = 0;

  const show = async (tab, animate) => {
    if (tab === current) return;
    current = tab;
    const mine = ++seq;
    $$('[data-acc-tab]', tabsEl).forEach((a) => {
      const on = a.dataset.accTab === tab;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    moveInk(tabsEl, animate);
    setTitle(ACCOUNT_TABS.find(([k]) => k === tab)[1]);
    try {
      if (tab === 'orders' && !cache.orders) {
        body.innerHTML = '<div class="loading-box"><div class="spinner"></div></div>';
        cache.orders = (await api('GET', '/api/my/orders')).orders;
      } else if (tab === 'wishlist' && !cache.wishlist) {
        body.innerHTML = '<div class="loading-box"><div class="spinner"></div></div>';
        cache.wishlist = S.wish.length ? (await api('GET', `/api/products?ids=${encodeURIComponent(S.wish.join(','))}`)).products : [];
      }
    } catch (e) {
      if (mine === seq) body.innerHTML = `<div class="card">${emptyHtml('alert', 'صار خطأ', e.message)}</div>`;
      return;
    }
    if (mine !== seq || !body.isConnected) return;
    const html = tab === 'orders' ? accountOrdersHtml(cache.orders)
      : tab === 'wishlist' ? gridHtml(cache.wishlist, 'قائمة المفضلة فاضية', 'اضغط على القلب في أي منتج عشان تحفظه هنا')
        : accountProfileHtml();
    body.innerHTML = `<div class="tab-pane">${html}</div>`;
    if (tab === 'profile') bindAccountProfile(body);
  };

  tabsEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-acc-tab]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (a.dataset.accTab === current) return;
    history.pushState(null, '', a.getAttribute('href'));
    show(a.dataset.accTab, true);
  });

  // التنقل للخلف/للأمام أو من قائمة الحساب وأنت بنفس الصفحة: نحرّك التبويب بدل ما نعيد رسم الصفحة
  S.accountNav = (tab) => show(tab, true);
  const onResize = () => {
    if (!tabsEl.isConnected) { window.removeEventListener('resize', onResize); return; }
    moveInk(tabsEl, false);
  };
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (tabsEl.isConnected) moveInk(tabsEl, false); });

  await show(accountTabFromUrl(), false);
  return undefined;
}
