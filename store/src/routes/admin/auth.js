'use strict';
// الدخول والإعداد الأول وحساب المشرف نفسه
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const shop = require('../../lib/shop');

module.exports = function authRoutes(router, c) {
  const { app, db, S, now, ALL_PERMS, ADMIN_COOKIE, ADMIN_COOKIE_PATH, adminView, tryAuth, auth, need, startSession, assertUnique } = c;
    const loginLimiter = sec.rateLimiter({ windowMs: 15 * 60e3, max: 6 });
    const ipLimiter = sec.rateLimiter({ windowMs: 15 * 60e3, max: 30 });
    const setupLimiter = sec.rateLimiter({ windowMs: 15 * 60e3, max: 10 });
    const findAdmin = (id) => db.data.admins.find((a) => (id.type === 'email' ? a.email === id.value : a.phone === id.value));

  router.get('/api/admin/status', (ctx) => {
    const setupRequired = db.data.admins.length === 0;
    const a = setupRequired ? null : tryAuth(ctx);
    return {
      setupRequired,
      me: a ? adminView(a) : null,
      store: { name: S().storeName, logo: S().logo, currency: S().currency },
      permissions: shop.PERMISSIONS,
      statuses: shop.ORDER_STATUSES,
    };
  });

  router.post('/api/admin/setup', async (ctx) => {
    if (db.data.admins.length) throw new HttpError(400, 'تم إعداد المتجر من قبل — سجّل دخولك');
    if (!setupLimiter.hit(ctx.ip)) throw new HttpError(429, 'محاولات كثيرة، حاول بعد شوي');
    const code = v.str(ctx.body.code, { max: 40, field: 'رمز الإعداد' }).toUpperCase().replace(/\s|-/g, '');
    if (!app.setupCode || !sec.safeEqual(code, app.setupCode)) {
      throw new HttpError(403, 'رمز الإعداد غير صحيح — تلقاه مكتوب في نافذة تشغيل السيرفر');
    }
    const name = v.str(ctx.body.name, { min: 2, max: 60, field: 'الاسم' });
    const id = v.identifier(ctx.body.identifier);
    const passwordHash = await sec.hashPassword(v.password(ctx.body.password));
    if (db.data.admins.length) throw new HttpError(400, 'تم إعداد المتجر من قبل');
    const a = {
      id: sec.newId(),
      name,
      email: id.type === 'email' ? id.value : '',
      phone: id.type === 'phone' ? id.value : '',
      role: 'owner',
      permissions: [...ALL_PERMS],
      passwordHash,
      mustChangePassword: false,
      active: true,
      createdAt: now(),
      lastLoginAt: now(),
      createdBy: null,
    };
    db.data.admins.push(a);
    app.setupCode = null;
    startSession(ctx, a);
    console.log(`✔ تم إنشاء حساب مالك المتجر: ${a.email || a.phone}`);
    return { me: adminView(a) };
  });

  router.post('/api/admin/login', async (ctx) => {
    const id = v.identifier(ctx.body.identifier);
    const key = `${ctx.ip}|${id.value}`;
    if (!ipLimiter.hit(ctx.ip) || !loginLimiter.hit(key)) {
      throw new HttpError(429, `محاولات كثيرة، حاول بعد ${loginLimiter.minutesLeft(key) || 15} دقيقة`);
    }
    const a = findAdmin(id);
    const ok = await sec.verifyPassword(String(ctx.body.password || ''), a ? a.passwordHash : null);
    if (!a || !ok) throw new HttpError(401, 'بيانات الدخول غير صحيحة');
    if (!a.active) throw new HttpError(403, 'حسابك موقوف — تواصل مع مالك المتجر');
    loginLimiter.clear(key);
    a.lastLoginAt = now();
    startSession(ctx, a);
    return { me: adminView(a) };
  });

  router.post('/api/admin/logout', (ctx) => {
    sec.destroySession(db, ctx.cookies[ADMIN_COOKIE]);
    ctx.setCookie(ADMIN_COOKIE, '', { maxAge: 0, path: ADMIN_COOKIE_PATH });
    return { ok: true };
  });

  router.put('/api/admin/me', need(), (ctx) => {
    const a = ctx.admin;
    const b = ctx.body;
    const name = v.str(b.name, { min: 2, max: 60, field: 'الاسم' });
    if (a.role === 'owner') {
      const email = b.email ? v.email(b.email) : '';
      const phone = b.phone ? v.phone(b.phone) : '';
      if (!email && !phone) throw new HttpError(400, 'لازم إيميل أو رقم جوال على الأقل');
      assertUnique(email, phone, a.id);
      a.email = email;
      a.phone = phone;
    }
    a.name = name;
    db.save();
    return { me: adminView(a) };
  });

  router.post('/api/admin/me/password', auth, async (ctx) => {
    const a = ctx.admin;
    if (!a.mustChangePassword) {
      const ok = await sec.verifyPassword(String(ctx.body.current || ''), a.passwordHash);
      if (!ok) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
    }
    const pw = v.password(ctx.body.password, 'كلمة المرور الجديدة');
    if (await sec.verifyPassword(pw, a.passwordHash)) throw new HttpError(400, 'اختر كلمة مرور مختلفة عن الحالية');
    a.passwordHash = await sec.hashPassword(pw);
    a.mustChangePassword = false;
    sec.destroyUserSessions(db, 'admin', a.id, ctx.adminToken);
    db.save();
    return { me: adminView(a) };
  });
};
