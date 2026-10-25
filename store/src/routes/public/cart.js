'use strict';
// السلة: حساب الأسعار من السيرفر
const shop = require('../../lib/shop');

module.exports = function cartRoutes(router, c) {
  const { db, normalizeItems } = c;

  // ---------- السلة ----------
  router.post('/api/cart/quote', (ctx) => {
    const items = normalizeItems(ctx.body.items);
    const lines = [];
    for (const { id, qty } of items) {
      const p = db.data.products.find((x) => x.id === id && x.visible);
      if (!p) continue;
      const max = p.quantity === null || p.quantity === undefined ? 99 : Math.min(99, p.quantity);
      const unit = shop.unitPrice(p);
      const q = max > 0 ? Math.min(qty, max) : qty;
      lines.push({
        id, name: p.name, image: p.images[0] || '', price: p.price, unitPrice: unit, qty: q, max,
        inStock: max > 0, lineTotal: shop.round2(unit * q),
      });
    }
    const valid = lines.filter((l) => l.inStock);
    return {
      lines,
      count: valid.reduce((s, l) => s + l.qty, 0),
      subtotal: shop.round2(valid.reduce((s, l) => s + l.lineTotal, 0)),
    };
  });
};
