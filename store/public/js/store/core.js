'use strict';
// واجهة المتجر — الحالة العامة وبطاقات المنتجات

// =====================================================================
//  واجهة المتجر — صفحة واحدة (SPA) تتنقل بدون إعادة تحميل
// =====================================================================

const S = {
  settings: null,
  categories: [],
  me: null,
  cart: store.get('cart', []).filter((x) => x && typeof x.id === 'string'),
  wish: store.get('wish', []).filter((x) => typeof x === 'string'),
  quote: { lines: [], count: 0, subtotal: 0 },
  quoteSeq: 0,
  routeId: 0,
};

const STATUS_CLASS = { pending_payment: 'warn', under_review: 'info', processing: 'primary', completed: 'ok', cancelled: 'danger' };

const money = (n) => `<span class="money"><span class="num">${fmtNum(n)}</span><span class="cur">${esc(S.settings.currency)}</span></span>`;

function setTitle(t) {
  document.title = t ? `${t} | ${S.settings.storeName}` : S.settings.storeName;
}

function emptyHtml(ic, title, text = '') {
  return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

function crumbs(items) {
  return `<nav class="crumbs" aria-label="المسار"><a href="/">الرئيسية</a>${items
    .map(([label, href]) => `${icon('chevL')}${href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}`)
    .join('')}</nav>`;
}

// =====================================================================
//  بطاقات المنتجات
// =====================================================================
function priceHtml(p) {
  return p.salePrice !== null && p.salePrice !== undefined
    ? `<span class="price"><span class="sale">${money(p.salePrice)}</span><del>${money(p.price)}</del></span>`
    : `<span class="price">${money(p.price)}</span>`;
}

function productCard(p) {
  const id = esc(p.id);
  const off = p.salePrice !== null ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  return `<article class="pcard">
    <a class="pcard-img" href="/product/${id}" tabindex="-1" aria-hidden="true">${p.images[0]
      ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">`
      : `<div class="noimg">${icon('image')}</div>`}</a>
    <button class="wish${S.wish.includes(p.id) ? ' on' : ''}" data-wish="${id}" aria-label="أضف للمفضلة">${icon('heart')}</button>
    ${off > 0 && p.inStock ? `<span class="sale-tag">خصم <span class="num">${off}%</span></span>` : ''}
    <div class="pcard-body">
      <a class="pcard-name" href="/product/${id}">${esc(p.name)}</a>
      <div class="pcard-meta">
        ${priceHtml(p)}
        ${p.rating ? `<span class="rating">${icon('star')}<span class="num">${p.rating}</span></span>` : ''}
      </div>
      ${p.left ? `<span class="left-tag">باقي ${p.left} فقط</span>` : ''}
      ${p.inStock
        ? `<button class="btn-cart" data-add="${id}">${icon('bag')}أضف إلى السلة</button>`
        : '<button class="btn-cart" disabled>نفدت الكمية</button>'}
    </div>
  </article>`;
}

function sectionHtml(sec, { seeAll = true } = {}) {
  return `<section class="psec">
    <div class="psec-head">
      <h2>${esc(sec.title)}</h2>
      <div class="psec-tools">
        ${seeAll ? `<a class="see-all" href="/category/${esc(sec.id)}">عرض الكل</a>` : ''}
        <button class="arrow" data-dir="-1" aria-label="السابق">${icon('chevR')}</button>
        <button class="arrow" data-dir="1" aria-label="التالي">${icon('chevL')}</button>
      </div>
    </div>
    <div class="prow">${sec.products.map(productCard).join('')}</div>
  </section>`;
}

function gridHtml(products, emptyTitle = 'لا توجد منتجات', emptyText = '') {
  return products.length ? `<div class="pgrid">${products.map(productCard).join('')}</div>` : `<div class="card">${emptyHtml('box', emptyTitle, emptyText)}</div>`;
}

// أسهم التمرير لأقسام المنتجات (تدعم اتجاه اليمين لليسار)
function initRows(root) {
  for (const sec of $$('.psec', root)) {
    const row = $('.prow', sec);
    const [prev, next] = $$('.arrow', sec);
    // عرض الشبكة (أو قسم بدون منتجات) ما فيه أسهم تمرير
    if (!row || !prev || !next) continue;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      const pos = Math.abs(row.scrollLeft);
      prev.disabled = pos < 4;
      next.disabled = pos > max - 4;
    };
    for (const b of [prev, next]) {
      b.addEventListener('click', () => {
        const dir = Number(b.dataset.dir);
        const rtl = getComputedStyle(row).direction === 'rtl';
        row.scrollBy({ left: dir * row.clientWidth * 0.9 * (rtl ? -1 : 1), behavior: 'smooth' });
      });
    }
    row.addEventListener('scroll', update, { passive: true });
    update();
    requestAnimationFrame(update);
  }
}
