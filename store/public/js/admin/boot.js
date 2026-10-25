'use strict';
// لوحة التحكم — جدول الصفحات ونقطة التشغيل (لازم يكون آخر ملف)

const VIEWS = {
  dashboard: viewDashboard,
  orders: viewOrders,
  products: viewProducts,
  categories: viewCategories,
  customers: viewCustomers,
  media: viewMedia,
  design: viewDesign,
  admins: viewAdmins,
  pages: viewPages,
  account: viewAccount,
};

// =====================================================================
//  التشغيل
// =====================================================================
async function boot() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-logout]')) { e.preventDefault(); logout(); return; }
    if (e.target.closest('#meBtn')) { $('#meMenu').hidden = !$('#meMenu').hidden; return; }
    const meMenu = $('#meMenu');
    if (meMenu && !e.target.closest('.me-wrap')) meMenu.hidden = true;
    if (e.target.closest('#menuToggle')) { $('#side').classList.add('open'); $('#sideBackdrop').hidden = false; return; }
    if (e.target.closest('#sideBackdrop')) { $('#side').classList.remove('open'); $('#sideBackdrop').hidden = true; return; }
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
    const href = a.getAttribute('href');
    if (!/^\/admin(\/|\?|$)/.test(href) || !A.me) return;
    e.preventDefault();
    const modal = a.closest('.modal-backdrop');
    if (modal) modal.querySelector('[data-close]').click();
    go(href);
  });
  window.addEventListener('popstate', () => route());
  window.addEventListener('beforeunload', (e) => {
    if (A.dirtyGuard && A.dirtyGuard()) { e.preventDefault(); e.returnValue = ''; }
  });

  let st;
  try {
    st = await api('GET', '/api/admin/status');
  } catch (e) {
    document.body.innerHTML = `<div class="auth-page"><div class="auth-card">${emptyHtml('alert', 'تعذر الاتصال بالسيرفر', e.message)}</div></div>`;
    return;
  }
  A.store = st.store;
  A.perms = st.permissions;
  A.statuses = st.statuses;
  if (st.setupRequired) { renderSetup(); return; }
  if (!st.me) { renderLogin(); return; }
  A.me = st.me;
  if (A.me.mustChangePassword) { renderForcePassword(); return; }
  startApp();
}

boot();
