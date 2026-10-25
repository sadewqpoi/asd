'use strict';
// واجهة المتجر — التنقل بين الصفحات

// =====================================================================
//  التنقل
// =====================================================================
const ROUTES = [
  [/^\/$/, viewHome],
  [/^\/category\/([^/]+)$/, viewCategory],
  [/^\/product\/([^/]+)$/, viewProduct],
  [/^\/search$/, viewSearch],
  [/^\/cart$/, viewCart],
  [/^\/checkout$/, viewCheckout],
  [/^\/account$/, viewAccount],
  [/^\/account\/orders\/(\d+)$/, viewOrder],
  [/^\/wishlist$/, viewWishlist],
  [/^\/page\/([^/]+)$/, viewPage],
];

function go(url, { replace = false, keepScroll = false } = {}) {
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  route();
  if (!keepScroll && !location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeOverlays() {
  $('#drawer').hidden = true;
  $('#userMenu').hidden = true;
}

async function route() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (S.accountNav && S.me && isAccountPath(path) && $('[data-acc-tabs]')) {
    closeOverlays();
    S.accountNav(accountTabFromUrl());
    return;
  }
  S.accountNav = null;
  const id = ++S.routeId;
  closeOverlays();
  $$('#mainnav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === path));
  const app = $('#app');
  for (const [re, view] of ROUTES) {
    const m = re.exec(path);
    if (!m) continue;
    let params;
    try { params = m.slice(1).map(decodeURIComponent); } catch { break; }
    const ctx = { stale: () => id !== S.routeId, params };
    app.innerHTML = '<div class="loading-box"><div class="spinner"></div></div>';
    try {
      await view(app, ctx);
    } catch (e) {
      if (ctx.stale()) return;
      const nf = e.status === 404;
      app.innerHTML = `<div class="card">${emptyHtml(nf ? 'search' : 'alert', nf ? 'الصفحة غير موجودة' : 'صار خطأ', e.message)}<div class="center-row"><a class="btn btn-primary" href="/">الرئيسية</a></div></div>`;
    }
    if (!ctx.stale() && location.hash) {
      const t = document.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }
  setTitle('الصفحة غير موجودة');
  app.innerHTML = `<div class="card">${emptyHtml('search', 'الصفحة غير موجودة', 'الرابط اللي فتحته غير صحيح')}<div class="center-row"><a class="btn btn-primary" href="/">الرئيسية</a></div></div>`;
}

function onDocClick(e) {
  const add = e.target.closest('[data-add]');
  if (add) { e.preventDefault(); addToCart(add.dataset.add); return; }
  const w = e.target.closest('[data-wish]');
  if (w) { e.preventDefault(); toggleWish(w.dataset.wish, w); return; }
  if (e.target.closest('[data-logout]')) { e.preventDefault(); logout(); return; }
  if (!e.target.closest('.user-wrap')) $('#userMenu').hidden = true;

  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('//') || /^\/(admin|uploads|api)(\/|$)/.test(href)) return;
  e.preventDefault();
  go(href);
}
