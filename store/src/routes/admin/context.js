'use strict';
// أدوات لوحة التحكم المشتركة: الصلاحيات، الجلسة، وتحقق المشرف من السيرفر
const { HttpError } = require('../../http/router');
const sec = require('../../lib/security');
const shop = require('../../lib/shop');

const ADMIN_COOKIE = 'mv_admin';
const ADMIN_COOKIE_PATH = '/api/admin';
const ADMIN_TTL = 7 * 24 * 3600 * 1000;
const ALL_PERMS = Object.keys(shop.PERMISSIONS);

function createContext(app) {
  const { db, uploadsDir } = app;

  const S = () => db.data.settings;
  const now = () => Date.now();
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

  const can = (a, perm) => a.role === 'owner' || (a.permissions || []).includes(perm);
  const permsOf = (a) => (a.role === 'owner' ? [...ALL_PERMS] : (a.permissions || []).filter((p) => ALL_PERMS.includes(p)));

  const adminView = (a) => ({
    id: a.id,
    name: a.name,
    email: a.email || '',
    phone: a.phone || '',
    role: a.role,
    permissions: permsOf(a),
    active: a.active,
    mustChangePassword: Boolean(a.mustChangePassword),
    lastLoginAt: a.lastLoginAt || null,
    createdAt: a.createdAt,
  });

  function tryAuth(ctx) {
    const token = ctx.cookies[ADMIN_COOKIE];
    const s = sec.getSession(db, 'admin', token);
    if (!s) return null;
    const a = db.data.admins.find((x) => x.id === s.userId);
    if (!a || !a.active) {
      sec.destroySession(db, token);
      return null;
    }
    ctx.admin = a;
    ctx.adminToken = token;
    return a;
  }

  function auth(ctx) {
    if (!tryAuth(ctx)) throw new HttpError(401, 'انتهت الجلسة — سجّل دخولك مرة ثانية');
  }

  // need() = أي مشرف دخل وغيّر كلمة المرور المؤقتة | need('products', ...) = لازم وحدة من الصلاحيات
  function need(...perms) {
    return (ctx) => {
      auth(ctx);
      if (ctx.admin.mustChangePassword) throw new HttpError(403, 'غيّر كلمة المرور المؤقتة أولاً');
      if (perms.length && !perms.some((p) => can(ctx.admin, p))) throw new HttpError(403, 'ما عندك صلاحية لهذا القسم');
    };
  }

  function startSession(ctx, a) {
    const token = sec.createSession(db, 'admin', a.id, ADMIN_TTL);
    ctx.setCookie(ADMIN_COOKIE, token, { maxAge: ADMIN_TTL / 1000, path: ADMIN_COOKIE_PATH });
  }


  // الإيميل/الجوال ما يتكرر بين المشرفين
  function assertUnique(email, phone, exceptId) {
    if (email && db.data.admins.some((a) => a.id !== exceptId && a.email === email)) throw new HttpError(409, 'الإيميل مستخدم لمشرف ثاني');
    if (phone && db.data.admins.some((a) => a.id !== exceptId && a.phone === phone)) throw new HttpError(409, 'رقم الجوال مستخدم لمشرف ثاني');
  }

  const sortedCats = () => [...db.data.categories].sort((a, b) => a.order - b.order);
  const homePage = () => db.data.pages.find((x) => x.isHome);

  return {
    app, db, uploadsDir, S, now, has, obj, can, permsOf, adminView, tryAuth, auth, need, startSession,
    assertUnique, sortedCats, homePage, ADMIN_COOKIE, ADMIN_COOKIE_PATH, ALL_PERMS,
  };
}

module.exports = { createContext };
