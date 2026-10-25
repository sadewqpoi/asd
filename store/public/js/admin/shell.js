'use strict';
// لوحة التحكم — الهيكل (القائمة الجانبية) والتنقل بين الصفحات

// =====================================================================
//  الهيكل والتنقل
// =====================================================================
function renderShell() {
  const nav = NAV.filter((n) => !n.perm || can(n.perm));
  document.body.innerHTML = `<div class="layout">
    <aside class="side" id="side">
      <div class="side-brand">${A.store.logo ? `<img src="${esc(A.store.logo)}" alt="">` : `<span class="avatar lg">${esc(initial(A.store.name))}</span>`}
        <div><strong data-store-name>${esc(A.store.name)}</strong><span>لوحة التحكم</span></div></div>
      <nav class="side-nav">${nav.map((n) => `<a href="${n.key === 'dashboard' ? '/admin' : `/admin/${n.key}`}" data-key="${n.key}">${icon(n.icon)}<span>${esc(n.label)}</span>${n.key === 'orders' ? '<span class="count" id="ordersCount" hidden></span>' : ''}</a>`).join('')}</nav>
      <div class="side-foot"><a href="/" target="_blank" rel="noopener">${icon('store')}<span class="grow">عرض المتجر</span>${icon('external', 'i-sm')}</a></div>
    </aside>
    <div class="side-backdrop" id="sideBackdrop" hidden></div>
    <div class="main">
      <header class="top">
        <button class="btn btn-outline btn-icon menu-toggle" id="menuToggle" aria-label="القائمة">${icon('menu')}</button>
        <h1 id="pageTitle"></h1>
        <a class="btn btn-outline btn-sm hide-sm" href="/" target="_blank" rel="noopener">${icon('external', 'i-sm')}عرض المتجر</a>
        <div class="me-wrap">
          <button class="me-btn" id="meBtn" aria-label="حسابي"><span class="avatar">${esc(initial(A.me.name))}</span><span class="name">${esc(A.me.name)}</span>${icon('chevD', 'i-sm')}</button>
          <div class="me-menu" id="meMenu" hidden>
            <div class="who"><strong>${esc(A.me.name)}</strong><div class="small muted">${A.me.role === 'owner' ? 'مالك المتجر' : 'مشرف'}</div></div>
            <a href="/admin/account">${icon('user')}حسابي</a>
            <button type="button" data-logout>${icon('logout')}تسجيل خروج</button>
          </div>
        </div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
}

function startApp() {
  renderShell();
  route();
  refreshOrdersBadge();
}

async function refreshOrdersBadge() {
  if (!can('orders')) return;
  try {
    const s = await api('GET', '/api/admin/stats');
    const el = $('#ordersCount');
    if (!el) return;
    el.textContent = s.needsAction;
    el.hidden = !s.needsAction;
  } catch { /* تجاهل */ }
}

function navKey() {
  return location.pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard';
}

function go(url, { replace = false } = {}) {
  if (A.dirtyGuard && A.dirtyGuard() && !window.confirm('فيه تغييرات ما انحفظت. تبي تطلع بدون حفظ؟')) return;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  route();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function route() {
  if (!A.me) return;
  const view = $('#view');
  if (!view) return;
  A.dirtyGuard = null;
  view.className = 'content';
  const layoutEl = $('.layout');
  if (layoutEl) layoutEl.classList.remove('builder');
  $('#side').classList.remove('open');
  $('#sideBackdrop').hidden = true;
  $('#meMenu').hidden = true;
  const key = navKey();
  const item = NAV.find((n) => n.key === key);
  if (!item) { history.replaceState(null, '', '/admin'); route(); return; }
  $$('.side-nav a').forEach((a) => a.classList.toggle('on', a.dataset.key === key));
  $('#pageTitle').textContent = item.label;
  document.title = `${item.label} | ${A.store.name}`;
  if (item.perm && !can(item.perm)) {
    view.innerHTML = `<div class="card">${emptyHtml('lock', 'ما عندك صلاحية لهذا القسم', 'تواصل مع مالك المتجر إذا تحتاجها')}</div>`;
    return;
  }
  const id = ++A.routeId;
  const ctx = { stale: () => id !== A.routeId };
  view.innerHTML = LOADING;
  try {
    await VIEWS[key](view, ctx);
  } catch (e) {
    if (ctx.stale() || !A.me) return;
    view.innerHTML = `<div class="card">${emptyHtml('alert', 'صار خطأ', e.message)}</div>`;
  }
}
