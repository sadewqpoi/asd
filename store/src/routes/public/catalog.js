'use strict';
// المتجر: بيانات المتجر، الصفحات، المنتجات والتقييم
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const shop = require('../../lib/shop');
const pages = require('../../lib/pages');

module.exports = function catalogRoutes(router, c) {
  const { db, app, visibleCats, visibleProducts, currentCustomer, requireCustomer } = c;

  // ---------- بيانات المتجر ----------
  router.get('/api/store', () => {
    const products = visibleProducts();
    return {
      settings: shop.publicSettings(db.data.settings),
      categories: visibleCats().map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        count: products.filter((p) => p.categoryIds.includes(c.id)).length,
      })),
      pages: db.data.pages.filter((p) => p.visible).map((p) => ({ title: p.title, slug: p.slug, showInFooter: p.showInFooter })),
    };
  });

  // أقسام المنتجات داخل الصفحات: نجهّز منتجات كل قسم من السيرفر
  function resolveProducts(page) {
    const out = {};
    const products = visibleProducts();
    for (const b of page.blocks) {
      if (b.type !== 'products') continue;
      const cat = b.categoryId ? visibleCats().find((c) => c.id === b.categoryId) : null;
      if (b.categoryId && !cat) continue; // القائمة محذوفة أو مخفية
      const list = cat ? products.filter((p) => p.categoryIds.includes(cat.id)) : products;
      out[b.id] = {
        title: b.title || (cat ? cat.name : 'منتجاتنا'),
        link: cat ? `/category/${cat.id}` : '/search?q=',
        items: shop.sortProducts(list, b.sort || 'new').slice(0, b.limit || 12).map(shop.publicProduct),
      };
    }
    return out;
  }
  app.resolveProducts = resolveProducts;

  router.get('/api/pages/:slug', (ctx) => {
    const p = db.data.pages.find((x) => x.slug === ctx.params.slug && x.visible && !x.isHome);
    if (!p) throw new HttpError(404, 'الصفحة غير موجودة');
    return { page: pages.publicPage(p), products: resolveProducts(p) };
  });

  // الصفحة الرئيسية تنبني من محرر الصفحات
  router.get('/api/home', () => {
    const home = db.data.pages.find((x) => x.isHome);
    if (!home) return { page: { blocks: [] }, products: {} };
    return { page: pages.publicPage(home), products: resolveProducts(home) };
  });

  router.get('/api/products', (ctx) => {
    const q = ctx.query;
    let list = visibleProducts();
    let category = null;
    const cat = q.get('category');
    if (cat) {
      const c = visibleCats().find((x) => x.id === cat);
      if (!c) throw new HttpError(404, 'القسم غير موجود');
      category = { id: c.id, name: c.name, description: c.description || '', image: c.image || '' };
      list = list.filter((p) => p.categoryIds.includes(cat));
    }
    const ids = q.get('ids');
    if (ids !== null) {
      const set = new Set(ids.split(',').slice(0, 100));
      list = list.filter((p) => set.has(p.id));
    }
    const term = (q.get('q') || '').trim().toLowerCase().slice(0, 100);
    if (term) list = list.filter((p) => `${p.name} ${p.shortDesc || ''}`.toLowerCase().includes(term));
    list = shop.sortProducts(list, q.get('sort'));
    return { category, products: list.slice(0, 200).map(shop.publicProduct) };
  });

  router.get('/api/products/:id', (ctx) => {
    const p = db.data.products.find((x) => x.id === ctx.params.id && x.visible);
    if (!p) throw new HttpError(404, 'المنتج غير موجود');
    const related = shop
      .sortProducts(visibleProducts().filter((x) => x.id !== p.id && x.categoryIds.some((c) => p.categoryIds.includes(c))), 'best')
      .slice(0, 8)
      .map(shop.publicProduct);
    const customer = currentCustomer(ctx);
    let canRate = false;
    let myRating = null;
    if (customer) {
      canRate = db.data.orders.some((o) => o.customerId === customer.id && o.status === 'completed' && o.items.some((i) => i.productId === p.id));
      const r = db.data.ratings.find((x) => x.productId === p.id && x.customerId === customer.id);
      myRating = r ? r.stars : null;
    }
    return {
      product: { ...shop.publicProduct(p), description: p.description || '' },
      categories: visibleCats().filter((c) => p.categoryIds.includes(c.id)).map((c) => ({ id: c.id, name: c.name })),
      related,
      canRate,
      myRating,
    };
  });

  router.post('/api/products/:id/rate', requireCustomer, (ctx) => {
    const p = db.data.products.find((x) => x.id === ctx.params.id);
    if (!p) throw new HttpError(404, 'المنتج غير موجود');
    const stars = v.num(ctx.body.stars, { min: 1, max: 5, integer: true, field: 'التقييم' });
    const eligible = db.data.orders.some((o) => o.customerId === ctx.customer.id && o.status === 'completed' && o.items.some((i) => i.productId === p.id));
    if (!eligible) throw new HttpError(403, 'تقدر تقيّم المنتج بعد ما يكتمل طلبك');
    const r = db.data.ratings.find((x) => x.productId === p.id && x.customerId === ctx.customer.id);
    if (r) {
      p.ratingSum += stars - r.stars;
      r.stars = stars;
      r.at = Date.now();
    } else {
      db.data.ratings.push({ productId: p.id, customerId: ctx.customer.id, stars, at: Date.now() });
      p.ratingSum = (p.ratingSum || 0) + stars;
      p.ratingCount = (p.ratingCount || 0) + 1;
    }
    db.save();
    return { rating: shop.rating(p), ratingCount: p.ratingCount, myRating: stars };
  });
};
