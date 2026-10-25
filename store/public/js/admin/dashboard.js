'use strict';
// لوحة التحكم — الرئيسية والإحصائيات

// =====================================================================
//  الرئيسية
// =====================================================================
function niceMax(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const fmtShort = (n) => (n >= 1000 ? `${fmtNum(Math.round(n / 100) / 10)}k` : fmtNum(n));

function chartHtml(series) {
  const top = niceMax(Math.max(...series.map((d) => d.total)));
  return `<div class="chart" data-chart>
    <div class="chart-plot">
      <div class="chart-grid">${[1, 0.5, 0].map((f) => `<div data-y="${1 - f}"><span class="num">${fmtShort(top * f)}</span></div>`).join('')}</div>
      <div class="bars">${series.map((d, i) => `<div class="bar-col" tabindex="0" data-i="${i}" aria-label="${esc(d.label)}: ${fmtNum(d.total)} ${esc(A.store.currency)}"><div class="bar${d.total ? '' : ' zero'}" data-h="${d.total / top}"></div></div>`).join('')}</div>
      <div class="tip" hidden></div>
    </div>
    <div class="chart-x">${series.map((d) => `<span class="num">${esc(d.label)}</span>`).join('')}</div>
  </div>`;
}

function initChart(root, series) {
  const c = $('[data-chart]', root);
  if (!c) return;
  $$('.chart-grid > div', c).forEach((g) => { g.style.top = `${Number(g.dataset.y) * 100}%`; });
  $$('.bar', c).forEach((b) => { b.style.height = `${Number(b.dataset.h) * 100}%`; });
  const tip = $('.tip', c);
  const plot = $('.chart-plot', c);
  const show = (col) => {
    const d = series[Number(col.dataset.i)];
    tip.innerHTML = `<strong>${money(d.total)}</strong>${esc(d.label)} · ${d.count} طلب`;
    tip.hidden = false;
    const pr = plot.getBoundingClientRect();
    const cr = col.getBoundingClientRect();
    const br = col.firstElementChild.getBoundingClientRect();
    tip.style.left = `${cr.left - pr.left + cr.width / 2}px`;
    tip.style.top = `${Math.min(br.top, cr.bottom) - pr.top - 8}px`;
  };
  const hide = () => { tip.hidden = true; };
  $$('.bar-col', c).forEach((col) => {
    col.addEventListener('mouseenter', () => show(col));
    col.addEventListener('focus', () => show(col));
    col.addEventListener('mouseleave', hide);
    col.addEventListener('blur', hide);
  });
}

async function viewDashboard(el, ctx) {
  const s = await aapi('GET', '/api/admin/stats');
  if (ctx.stale()) return;
  const cards = [];
  if (s.revenue !== undefined) {
    cards.push(['cash', 'إجمالي المبيعات', money(s.revenue)], ['receipt', 'كل الطلبات', fmtNum(s.ordersCount)], ['clock', 'بانتظار المراجعة', fmtNum(s.needsAction)]);
  }
  if (s.customersCount !== undefined) cards.push(['users', 'العملاء', fmtNum(s.customersCount)]);
  cards.push(['box', 'المنتجات', fmtNum(s.productsCount)]);

  const quick = [
    can('products') && ['/admin/products?new=1', 'box', 'إضافة منتج'],
    can('categories') && ['/admin/categories?new=1', 'list', 'إضافة قائمة منتجات'],
    can('media') && ['/admin/media', 'upload', 'رفع صور'],
    can('design') && ['/admin/design', 'palette', 'تعديل المتجر'],
    can('admins') && ['/admin/admins?new=1', 'shieldCheck', 'إضافة مشرف'],
  ].filter(Boolean);

  el.innerHTML = `
    ${s.whatsappWarning && can('design') ? `<div class="alert warn mb">${icon('alert', 'i-sm')}<div><b>التحقق بالواتساب مفعّل بس الواتساب ما انربط.</b> رموز التحقق تطلع حالياً في نافذة السيرفر بس، يعني العملاء ما يقدرون يسجلون. <a href="/admin/design?tab=verify"><b>اربطه أو قفّله من هنا</b></a></div></div>` : ''}
    <div class="welcome"><div><h2>أهلاً ${esc(A.me.name)}</h2><p class="muted">نظرة سريعة على متجرك</p></div>
      ${can('products') ? `<a class="btn btn-primary" href="/admin/products?new=1">${icon('plus')}إضافة منتج</a>` : ''}</div>
    <div class="stats">${cards.map(([ic, l, v]) => `<div class="card stat"><div class="stat-ic">${icon(ic)}</div><div><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div></div>`).join('')}</div>
    <div class="dash-grid">
      <div class="stack">
        ${s.series ? `<div class="card"><div class="card-head"><h2>المبيعات — آخر 14 يوم</h2><span class="small muted">بدون الطلبات الملغية</span></div>${chartHtml(s.series)}</div>` : ''}
        ${s.recentOrders ? `<div class="card"><div class="card-head"><h2>آخر الطلبات</h2><a class="btn btn-ghost btn-sm" href="/admin/orders">عرض الكل</a></div>
          ${s.recentOrders.length ? `<div class="mini-list">${s.recentOrders.map((o) => `<a href="/admin/orders?open=${o.id}"><strong class="num">#${o.id}</strong><span class="grow">${esc(o.customer)}<span class="small muted"> · ${fmtDate(o.createdAt)}</span></span><span class="badge ${STATUS_CLASS[o.status]}">${esc(A.statuses[o.status])}</span><strong>${money(o.total)}</strong></a>`).join('')}</div>` : emptyHtml('receipt', 'ما فيه طلبات للحين')}</div>` : ''}
      </div>
      <div class="stack">
        ${quick.length ? `<div class="card"><div class="card-head"><h2>اختصارات</h2></div><div class="mini-list">${quick.map(([href, ic, l]) => `<a href="${href}">${icon(ic)}<span class="grow">${l}</span>${icon('chevL', 'i-sm')}</a>`).join('')}</div></div>` : ''}
        ${s.lowStock && s.lowStock.length ? `<div class="card"><div class="card-head"><h2>كميات قاربت تخلص</h2></div><div class="mini-list">${s.lowStock.map((p) => `<a href="/admin/products?edit=${esc(p.id)}">${thumb(p.image)}<span class="grow">${esc(p.name)}</span><span class="badge ${p.quantity ? 'warn' : 'danger'}">${p.quantity ? `باقي ${p.quantity}` : 'نفدت'}</span></a>`).join('')}</div></div>` : ''}
        ${s.topProducts && s.topProducts.length ? `<div class="card"><div class="card-head"><h2>الأكثر مبيعاً</h2></div><div class="mini-list">${s.topProducts.map((p) => `<div>${thumb(p.image)}<span class="grow">${esc(p.name)}</span><span class="small muted">${p.sold} مبيعات</span></div>`).join('')}</div></div>` : ''}
      </div>
    </div>`;
  if (s.series) initChart(el, s.series);
  const badge = $('#ordersCount');
  if (badge && s.needsAction !== undefined) { badge.textContent = s.needsAction; badge.hidden = !s.needsAction; }
}
