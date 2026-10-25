'use strict';
// العملاء
const { HttpError } = require('../../http/router');
const sec = require('../../lib/security');
const shop = require('../../lib/shop');

module.exports = function customersRoutes(router, c) {
  const { db, need } = c;

  router.get('/api/admin/customers', need('customers'), () => ({
    customers: [...db.data.customers].sort((a, b) => b.createdAt - a.createdAt).map((c) => {
      const orders = db.data.orders.filter((o) => o.customerId === c.id);
      const live = orders.filter((o) => o.status !== 'cancelled');
      return {
        id: c.id, name: c.name, email: c.email, phone: c.phone, phoneVerified: Boolean(c.phoneVerified), createdAt: c.createdAt,
        ordersCount: orders.length, spent: shop.round2(live.reduce((s, o) => s + o.total, 0)),
        lastOrderAt: orders.reduce((m, o) => Math.max(m, o.createdAt), 0) || null,
      };
    }),
  }));

  router.post('/api/admin/customers/:id/reset-password', need('customers'), async (ctx) => {
    const c = db.data.customers.find((x) => x.id === ctx.params.id);
    if (!c) throw new HttpError(404, 'العميل غير موجود');
    const temp = sec.tempPassword();
    c.passwordHash = await sec.hashPassword(temp);
    sec.destroyUserSessions(db, 'customer', c.id);
    db.save();
    return { tempPassword: temp };
  });

  router.delete('/api/admin/customers/:id', need('customers'), (ctx) => {
    const c = db.data.customers.find((x) => x.id === ctx.params.id);
    if (!c) throw new HttpError(404, 'العميل غير موجود');
    db.data.customers = db.data.customers.filter((x) => x !== c);
    sec.destroyUserSessions(db, 'customer', c.id);
    db.save();
    return { ok: true };
  });
};
