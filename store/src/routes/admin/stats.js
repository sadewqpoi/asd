'use strict';
// الرئيسية: الإحصائيات
const shop = require('../../lib/shop');
const otp = require('../../lib/otp');

module.exports = function statsRoutes(router, c) {
  const { db, S, can, need } = c;

  router.get('/api/admin/stats', need(), (ctx) => {
    const a = ctx.admin;
    const out = {
      productsCount: db.data.products.length,
      categoriesCount: db.data.categories.length,
    };
    if (can(a, 'orders')) {
      const orders = db.data.orders;
      const live = orders.filter((o) => o.status !== 'cancelled');
      out.revenue = shop.round2(live.reduce((s, o) => s + o.total, 0));
      out.ordersCount = orders.length;
      out.openOrders = orders.filter((o) => ['pending_payment', 'under_review', 'processing'].includes(o.status)).length;
      out.needsAction = orders.filter((o) => o.status === 'under_review').length;
      const day = 24 * 3600 * 1000;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      out.series = [];
      for (let i = 13; i >= 0; i--) {
        const from = start.getTime() - i * day;
        const d = new Date(from);
        const inDay = live.filter((o) => o.createdAt >= from && o.createdAt < from + day);
        out.series.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total: shop.round2(inDay.reduce((s, o) => s + o.total, 0)), count: inDay.length });
      }
      out.recentOrders = [...orders].sort((x, y) => y.createdAt - x.createdAt).slice(0, 6).map((o) => ({
        id: o.id, customer: o.customer.name, total: o.total, status: o.status, createdAt: o.createdAt,
      }));
    }
    if (can(a, 'customers')) out.customersCount = db.data.customers.length;
    // تنبيه للمالك لو التحقق مفعّل بس الواتساب ما انضبط (الرموز تطلع بنافذة السيرفر بس)
    out.whatsappWarning = S().whatsappVerify !== false && !otp.isConfigured();
    if (can(a, 'products')) {
      out.lowStock = db.data.products
        .filter((p) => p.quantity !== null && p.quantity !== undefined && p.quantity <= 3)
        .map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, image: p.images[0] || '' }));
      out.topProducts = [...db.data.products].filter((p) => p.sold > 0).sort((x, y) => y.sold - x.sold).slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, sold: p.sold, image: p.images[0] || '' }));
    }
    return out;
  });
};
