'use strict';
// واجهة المتجر — صفحات المحتوى والمفضلة

// صفحات المحتوى (من نحن، الشروط والأحكام...) — ?preview=1 يعرض الصفحات المخفية للمشرفين
async function viewPage(app, ctx) {
  const slug = ctx.params[0];
  let page;
  let products = {};
  let hidden = false;
  try {
    ({ page, products } = await api('GET', `/api/pages/${encodeURIComponent(slug)}`));
  } catch (e) {
    if (e.status !== 404 || !new URLSearchParams(location.search).has('preview')) throw e;
    ({ page, hidden, products } = await api('GET', `/api/admin/page-preview/${encodeURIComponent(slug)}`).catch(() => { throw e; }));
  }
  if (ctx.stale()) return;
  setTitle(page.title);
  app.innerHTML = `${hidden ? `<div class="alert warn gap-b">${icon('eye', 'i-sm')}<div>معاينة — هذي الصفحة <b>مخفية</b> عن العملاء. أظهرها من لوحة التحكم ← الصفحات.</div></div>` : ''}
    ${crumbs([[page.title]])}
    <article class="pg-page">
      ${page.showTitle ? `<h1 class="pg-title">${esc(page.title)}</h1>${page.description ? `<p class="pg-desc">${esc(page.description)}</p>` : ''}` : ''}
      ${page.blocks.map((b) => pageBlockHtml(b, { products: products || {}, card: productCard })).join('')}
    </article>`;
  applyDataStyles(app);
  initPageSliders(app);
  initRows(app);
}

async function viewWishlist(app, ctx) {
  if (S.me) return viewAccount(app, ctx);
  setTitle('المفضلة');
  const data = S.wish.length ? await api('GET', `/api/products?ids=${encodeURIComponent(S.wish.join(','))}`) : { products: [] };
  if (ctx.stale()) return;
  app.innerHTML = `${crumbs([['المفضلة']])}<h1 class="page-title">المفضلة</h1>${gridHtml(data.products, 'قائمة المفضلة فاضية', 'اضغط على القلب في أي منتج عشان تحفظه هنا')}`;
}
