'use strict';
// أدوات مشتركة بين مسارات المتجر: الأقسام والمنتجات الظاهرة، وجلسة العميل
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');

const CUSTOMER_COOKIE = 'mv_cust';
const CUSTOMER_TTL = 30 * 24 * 3600 * 1000;

function createContext(app) {
  const { db } = app;

  const visibleCats = () => db.data.categories.filter((c) => c.visible).sort((a, b) => a.order - b.order);
  const visibleProducts = () => db.data.products.filter((p) => p.visible);

  function currentCustomer(ctx) {
    const s = sec.getSession(db, 'customer', ctx.cookies[CUSTOMER_COOKIE]);
    if (!s) return null;
    return db.data.customers.find((c) => c.id === s.userId) || null;
  }

  function requireCustomer(ctx) {
    const c = currentCustomer(ctx);
    if (!c) throw new HttpError(401, 'سجّل دخولك أولاً');
    ctx.customer = c;
  }

  const customerView = (c) => ({ id: c.id, name: c.name, email: c.email || '', phone: c.phone || '' });

  const findCustomer = (id) => db.data.customers.find((c) => (id.type === 'email' ? c.email === id.value : c.phone === id.value));

  function startSession(ctx, c) {
    const token = sec.createSession(db, 'customer', c.id, CUSTOMER_TTL);
    ctx.setCookie(CUSTOMER_COOKIE, token, { maxAge: CUSTOMER_TTL / 1000, path: '/' });
  }

  function normalizeItems(input) {
    const list = v.arr(input, { max: 50, field: 'السلة' });
    const map = new Map();
    for (const it of list) {
      if (!it || typeof it.id !== 'string' || it.id.length > 40) continue;
      const qty = Math.min(99, Math.max(1, Math.floor(Number(it.qty) || 1)));
      map.set(it.id, Math.min(99, (map.get(it.id) || 0) + qty));
    }
    return [...map].map(([id, qty]) => ({ id, qty }));
  }

  return { db, app, visibleCats, visibleProducts, currentCustomer, requireCustomer, customerView, findCustomer, startSession, normalizeItems };
}

module.exports = { createContext, CUSTOMER_COOKIE };
