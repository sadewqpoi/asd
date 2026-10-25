'use strict';
// المنتجات
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const shop = require('../../lib/shop');

module.exports = function productsRoutes(router, c) {
  const { db, now, has, need } = c;

  const adminProduct = (p) => ({ ...p, rating: shop.rating(p) });

  function sanitizeProduct(b, existing) {
    const out = existing
      ? { ...existing }
      : {
        id: sec.newId(), shortDesc: '', description: '', salePrice: null, quantity: null, categoryIds: [], images: [],
        visible: true, sold: 0, ratingSum: 0, ratingCount: 0, createdAt: now(),
      };
    if (!existing || has(b, 'name')) out.name = v.str(b.name, { min: 1, max: 120, field: 'اسم المنتج' });
    if (!existing || has(b, 'price')) out.price = v.num(b.price, { min: 0, max: 10_000_000, field: 'السعر' });
    if (has(b, 'salePrice')) out.salePrice = v.num(b.salePrice, { min: 0, max: 10_000_000, field: 'السعر بعد الخصم', optional: true });
    if (out.salePrice !== null && out.salePrice >= out.price) throw new HttpError(400, 'السعر بعد الخصم لازم يكون أقل من السعر الأصلي');
    if (has(b, 'quantity')) out.quantity = v.num(b.quantity, { min: 0, max: 1_000_000, integer: true, field: 'الكمية', optional: true });
    if (has(b, 'shortDesc')) out.shortDesc = v.str(b.shortDesc, { max: 200, field: 'الوصف المختصر' });
    if (has(b, 'description')) out.description = v.str(b.description, { max: 5000, field: 'وصف المنتج', multiline: true });
    if (has(b, 'categoryIds')) {
      out.categoryIds = [...new Set(v.arr(b.categoryIds, { max: 30, field: 'الأقسام' }))]
        .filter((id) => typeof id === 'string' && db.data.categories.some((c) => c.id === id));
    }
    if (has(b, 'images')) out.images = [...new Set(v.arr(b.images, { max: 10, field: 'الصور' }).map((x) => v.imageRef(x)).filter(Boolean))];
    if (has(b, 'visible')) out.visible = v.bool(b.visible);
    out.updatedAt = now();
    return out;
  }

  const findProduct = (id) => {
    const p = db.data.products.find((x) => x.id === id);
    if (!p) throw new HttpError(404, 'المنتج غير موجود');
    return p;
  };

  router.get('/api/admin/products', need('products'), () => ({
    products: [...db.data.products].sort((a, b) => b.createdAt - a.createdAt).map(adminProduct),
  }));

  router.post('/api/admin/products', need('products'), (ctx) => {
    const p = sanitizeProduct(ctx.body, null);
    db.data.products.push(p);
    db.save();
    return { product: adminProduct(p) };
  });

  router.put('/api/admin/products/:id', need('products'), (ctx) => {
    const cur = findProduct(ctx.params.id);
    const p = sanitizeProduct(ctx.body, cur);
    Object.assign(cur, p);
    db.save();
    return { product: adminProduct(cur) };
  });

  router.delete('/api/admin/products/:id', need('products'), (ctx) => {
    const p = findProduct(ctx.params.id);
    db.data.products = db.data.products.filter((x) => x !== p);
    db.data.ratings = db.data.ratings.filter((r) => r.productId !== p.id);
    db.save();
    return { ok: true };
  });
};
