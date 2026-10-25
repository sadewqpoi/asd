'use strict';
// الطلبات: إنشاء الطلب، طلباتي، تأكيد التحويل، الإلغاء
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const shop = require('../../lib/shop');

module.exports = function ordersRoutes(router, c) {
  const { db, requireCustomer, normalizeItems } = c;
  const orderLimiter = sec.rateLimiter({ windowMs: 60 * 60e3, max: 20 });

  // ---------- الطلبات ----------
  router.post('/api/orders', requireCustomer, (ctx) => {
    if (!orderLimiter.hit(ctx.customer.id)) throw new HttpError(429, 'طلبات كثيرة، حاول بعد شوي');
    const items = normalizeItems(ctx.body.items);
    if (!items.length) throw new HttpError(400, 'السلة فاضية');
    const note = v.str(ctx.body.note, { max: 500, field: 'الملاحظة', multiline: true });

    const lines = [];
    for (const { id, qty } of items) {
      const p = db.data.products.find((x) => x.id === id && x.visible);
      if (!p) throw new HttpError(400, 'أحد المنتجات بالسلة لم يعد متوفراً، حدّث الصفحة');
      if (p.quantity !== null && p.quantity !== undefined && p.quantity < qty) {
        throw new HttpError(400, p.quantity === 0 ? `"${p.name}" نفدت كميته` : `المتوفر من "${p.name}" ${p.quantity} فقط`);
      }
      lines.push({ p, qty, unit: shop.unitPrice(p) });
    }
    for (const l of lines) {
      if (l.p.quantity !== null && l.p.quantity !== undefined) l.p.quantity -= l.qty;
      l.p.sold = (l.p.sold || 0) + l.qty;
    }

    const s = db.data.settings;
    const c = ctx.customer;
    const subtotal = shop.round2(lines.reduce((sum, l) => sum + l.unit * l.qty, 0));
    const status = s.payment.bankEnabled ? 'pending_payment' : 'under_review';
    const now = Date.now();
    const order = {
      id: ++db.data.counters.order,
      customerId: c.id,
      customer: { name: c.name, email: c.email || '', phone: c.phone || '' },
      items: lines.map((l) => ({
        productId: l.p.id, name: l.p.name, image: l.p.images[0] || '', unitPrice: l.unit, qty: l.qty, total: shop.round2(l.unit * l.qty),
      })),
      subtotal,
      total: subtotal,
      status,
      note,
      reference: '',
      adminNote: '',
      history: [{ status, at: now, by: 'العميل' }],
      createdAt: now,
    };
    db.data.orders.push(order);
    db.save();
    return { order: shop.orderView(order, s) };
  });

  const findMyOrder = (ctx) => {
    const o = db.data.orders.find((x) => String(x.id) === ctx.params.id && x.customerId === ctx.customer.id);
    if (!o) throw new HttpError(404, 'الطلب غير موجود');
    return o;
  };

  router.get('/api/my/orders', requireCustomer, (ctx) => ({
    orders: db.data.orders
      .filter((o) => o.customerId === ctx.customer.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => ({
        id: o.id, status: o.status, statusLabel: shop.ORDER_STATUSES[o.status], total: o.total,
        count: o.items.reduce((s, i) => s + i.qty, 0), createdAt: o.createdAt,
      })),
  }));

  router.get('/api/my/orders/:id', requireCustomer, (ctx) => ({ order: shop.orderView(findMyOrder(ctx), db.data.settings) }));

  router.post('/api/my/orders/:id/paid', requireCustomer, (ctx) => {
    const o = findMyOrder(ctx);
    if (o.status !== 'pending_payment') throw new HttpError(400, 'حالة الطلب ما تسمح بهذا الإجراء');
    o.reference = v.str(ctx.body.reference, { min: 1, max: 120, field: 'اسم المحوّل أو رقم العملية' });
    o.status = 'under_review';
    o.history.push({ status: o.status, at: Date.now(), by: 'العميل' });
    db.save();
    return { order: shop.orderView(o, db.data.settings) };
  });

  router.post('/api/my/orders/:id/cancel', requireCustomer, (ctx) => {
    const o = findMyOrder(ctx);
    if (o.status !== 'pending_payment') throw new HttpError(400, 'ما تقدر تلغي الطلب بعد تأكيد الدفع — تواصل معنا');
    shop.restoreStock(db.data.products, o);
    o.status = 'cancelled';
    o.history.push({ status: o.status, at: Date.now(), by: 'العميل' });
    db.save();
    return { order: shop.orderView(o, db.data.settings) };
  });
};
