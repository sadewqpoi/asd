'use strict';
// الطلبات
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const shop = require('../../lib/shop');

module.exports = function ordersRoutes(router, c) {
  const { db, S, now, has, need } = c;

  const findOrder = (id) => {
    const o = db.data.orders.find((x) => String(x.id) === String(id));
    if (!o) throw new HttpError(404, 'الطلب غير موجود');
    return o;
  };

  router.get('/api/admin/orders', need('orders'), (ctx) => {
    const status = ctx.query.get('status') || '';
    const q = (ctx.query.get('q') || '').trim().toLowerCase().slice(0, 60);
    const all = [...db.data.orders].sort((a, b) => b.createdAt - a.createdAt);
    const counts = { all: all.length };
    for (const k of Object.keys(shop.ORDER_STATUSES)) counts[k] = all.filter((o) => o.status === k).length;
    let list = status ? all.filter((o) => o.status === status) : all;
    if (q) {
      list = list.filter((o) => String(o.id).includes(q)
        || `${o.customer.name} ${o.customer.email} ${o.customer.phone}`.toLowerCase().includes(q));
    }
    return {
      counts,
      orders: list.slice(0, 500).map((o) => ({
        id: o.id, customer: o.customer, total: o.total, status: o.status, reference: o.reference || '',
        count: o.items.reduce((s, i) => s + i.qty, 0), createdAt: o.createdAt,
      })),
    };
  });

  router.get('/api/admin/orders/:id', need('orders'), (ctx) => ({ order: shop.orderView(findOrder(ctx.params.id), S(), { forAdmin: true }) }));

  router.put('/api/admin/orders/:id', need('orders'), (ctx) => {
    const o = findOrder(ctx.params.id);
    const b = ctx.body;
    if (has(b, 'status') && b.status !== o.status) {
      if (!has(shop.ORDER_STATUSES, b.status)) throw new HttpError(400, 'حالة غير صحيحة');
      if (o.status === 'cancelled') throw new HttpError(400, 'الطلب ملغي — ما تقدر تغيّر حالته');
      if (b.status === 'cancelled') shop.restoreStock(db.data.products, o);
      o.status = b.status;
      o.history.push({ status: o.status, at: now(), by: ctx.admin.name });
    }
    if (has(b, 'adminNote')) o.adminNote = v.str(b.adminNote, { max: 1000, field: 'ملاحظة الإدارة', multiline: true });
    db.save();
    return { order: shop.orderView(o, S(), { forAdmin: true }) };
  });
};
