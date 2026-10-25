'use strict';
// واجهة المتجر — الرئيسية، الأقسام، البحث، صفحة المنتج

// =====================================================================
//  الصفحات
// =====================================================================
async function viewHome(app, ctx) {
  const { page, products } = await api('GET', '/api/home');
  if (ctx.stale()) return;
  setTitle();
  const html = page.blocks.map((b) => pageBlockHtml(b, { products, card: productCard })).join('');
  app.innerHTML = html
    ? `<div class="pg-page pg-home">${html}</div>`
    : `<div class="card">${emptyHtml('box', 'الصفحة الرئيسية فاضية', 'قريباً بنضيف منتجات جديدة')}</div>`;
  applyDataStyles(app);
  // زر الواجهة الافتراضي يودّي لأول قسم منتجات
  const first = $('.pgb-products', app);
  if (first && !document.getElementById('products')) first.id = 'products';
  initPageSliders(app);
  initRows(app);
}

const SORTS = [['', 'الأحدث'], ['best', 'الأكثر مبيعاً'], ['price_asc', 'السعر: من الأقل'], ['price_desc', 'السعر: من الأعلى']];
const sortSelect = (cur) => `<select class="select" data-sort aria-label="ترتيب المنتجات">${SORTS.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

function bindSort(app) {
  const sel = $('[data-sort]', app);
  if (!sel) return;
  sel.addEventListener('change', () => {
    const u = new URL(location.href);
    if (sel.value) u.searchParams.set('sort', sel.value);
    else u.searchParams.delete('sort');
    go(u.pathname + u.search, { replace: true, keepScroll: true });
  });
}

async function viewCategory(app, ctx) {
  const sort = new URLSearchParams(location.search).get('sort') || '';
  const data = await api('GET', `/api/products?category=${encodeURIComponent(ctx.params[0])}&sort=${encodeURIComponent(sort)}`);
  if (ctx.stale()) return;
  const c = data.category;
  setTitle(c.name);
  app.innerHTML = `${crumbs([[c.name]])}
    <div class="cat-head"><div><h1>${esc(c.name)}</h1>${c.description ? `<p class="muted">${esc(c.description)}</p>` : ''}
      <p class="small muted">${data.products.length} منتج</p></div>${sortSelect(sort)}</div>
    ${gridHtml(data.products, 'لا توجد منتجات في هذا القسم')}`;
  bindSort(app);
}

async function viewSearch(app, ctx) {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').trim();
  const sort = params.get('sort') || '';
  $('#searchForm input').value = q;
  const data = await api('GET', `/api/products?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}`);
  if (ctx.stale()) return;
  setTitle(`بحث: ${q}`);
  app.innerHTML = `${crumbs([['نتائج البحث']])}
    <div class="cat-head"><div><h1>${q ? `نتائج البحث عن "${esc(q)}"` : 'كل المنتجات'}</h1><p class="small muted">${data.products.length} منتج</p></div>${sortSelect(sort)}</div>
    ${gridHtml(data.products, 'ما لقينا منتجات مطابقة', 'جرّب كلمة ثانية')}`;
  bindSort(app);
}

async function viewProduct(app, ctx) {
  const data = await api('GET', `/api/products/${encodeURIComponent(ctx.params[0])}`);
  if (ctx.stale()) return;
  const p = data.product;
  const cat = data.categories[0];
  setTitle(p.name);
  const imgs = p.images;
  const stars = (val) => [1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${val >= n ? 'on' : ''}" aria-label="${n} من 5">${icon('star')}</button>`).join('');
  app.innerHTML = `${crumbs(cat ? [[cat.name, `/category/${cat.id}`], [p.name]] : [[p.name]])}
    <div class="product card">
      <div class="gallery">
        <div class="gallery-main">${imgs[0] ? `<img data-main src="${esc(imgs[0])}" alt="${esc(p.name)}">` : `<div class="noimg">${icon('image')}</div>`}</div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<button type="button" class="${i ? '' : 'on'}" data-img="${esc(u)}" aria-label="صورة ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="pinfo">
        ${data.categories.length ? `<div class="chips">${data.categories.map((c) => `<a class="badge primary" href="/category/${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div>` : ''}
        <h1>${esc(p.name)}</h1>
        ${p.rating ? `<span class="rating start">${icon('star')}<span class="num">${p.rating}</span> <span>(${p.ratingCount} تقييم)</span></span>` : ''}
        ${p.shortDesc ? `<p class="lead">${esc(p.shortDesc)}</p>` : ''}
        <div class="row wrap">${priceHtml(p)}${p.salePrice !== null ? `<span class="badge danger">وفّر ${money(p.price - p.salePrice)}</span>` : ''}</div>
        ${p.inStock
          ? `<span class="stock ok">${icon('checkCircle', 'i-sm')}متوفر${p.left ? ` — باقي ${p.left} فقط` : ''}</span>
             <div class="buy-row">
               <div class="qty"><button type="button" data-q="1" aria-label="زيادة">${icon('plus')}</button><input data-qty value="1" inputmode="numeric" aria-label="الكمية"><button type="button" data-q="-1" aria-label="نقص">${icon('minus')}</button></div>
               <button class="btn btn-dark" data-buy="cart">${icon('bag')}أضف إلى السلة</button>
               <button class="btn btn-primary" data-buy="now">اشتر الآن</button>
             </div>`
          : `<span class="stock no">${icon('alert', 'i-sm')}نفدت الكمية</span>`}
        <div><button type="button" class="btn btn-ghost btn-sm" data-wish="${esc(p.id)}">${icon('heart', 'i-sm')}${S.wish.includes(p.id) ? 'في المفضلة' : 'أضف للمفضلة'}</button></div>
        ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
        ${data.canRate ? `<div class="rate-box"><strong>${data.myRating ? 'تقييمك للمنتج' : 'قيّم المنتج'}</strong><div class="stars" data-stars>${stars(data.myRating || 0)}</div></div>` : ''}
      </div>
    </div>
    ${data.related.length ? sectionHtml({ title: 'منتجات مشابهة', products: data.related }, { seeAll: false }) : ''}`;

  const main = $('[data-main]', app);
  $$('[data-img]', app).forEach((b) => b.addEventListener('click', () => {
    main.src = b.dataset.img;
    $$('[data-img]', app).forEach((x) => x.classList.toggle('on', x === b));
  }));
  const qty = $('[data-qty]', app);
  const getQty = () => Math.min(99, Math.max(1, parseInt(toLatinDigits(qty.value), 10) || 1));
  $$('[data-q]', app).forEach((b) => b.addEventListener('click', () => { qty.value = Math.min(99, Math.max(1, getQty() + Number(b.dataset.q))); }));
  if (qty) qty.addEventListener('change', () => { qty.value = getQty(); });
  $$('[data-buy]', app).forEach((b) => b.addEventListener('click', async () => {
    await addToCart(p.id, getQty());
    if (b.dataset.buy === 'now') go('/checkout');
  }));
  const starsBox = $('[data-stars]', app);
  if (starsBox) {
    starsBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-star]');
      if (!b) return;
      withBusy(null, async () => {
        const r = await api('POST', `/api/products/${encodeURIComponent(p.id)}/rate`, { stars: Number(b.dataset.star) });
        $$('[data-star]', starsBox).forEach((x) => x.classList.toggle('on', Number(x.dataset.star) <= r.myRating));
        toast('شكراً على تقييمك');
      });
    });
  }
  initRows(app);
}
