'use strict';
// حساب العميل: تسجيل، دخول، استرجاع كلمة المرور (مع التحقق برمز واتساب)
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const { OtpStore } = require('../../lib/otp');
const { CUSTOMER_COOKIE } = require('./context');

module.exports = function authRoutes(router, c) {
  const { db, currentCustomer, requireCustomer, customerView, findCustomer, startSession } = c;
  const loginLimiter = sec.rateLimiter({ windowMs: 15 * 60e3, max: 8 });
  const ipLimiter = sec.rateLimiter({ windowMs: 15 * 60e3, max: 40 });
  const otps = new OtpStore();

  // ---------- حساب العميل ----------
  router.get('/api/auth/me', (ctx) => {
    const c = currentCustomer(ctx);
    return { customer: c ? customerView(c) : null };
  });

  // ---------- التسجيل والدخول مع التحقق بالواتساب ----------
  const otpOn = () => db.data.settings.whatsappVerify !== false;

  function assertFree(email, phone, exceptId) {
    if (email && db.data.customers.some((c) => c.id !== exceptId && c.email === email)) {
      throw new HttpError(409, 'الإيميل مسجل من قبل — سجّل دخولك');
    }
    if (phone && db.data.customers.some((c) => c.id !== exceptId && c.phone === phone)) {
      throw new HttpError(409, 'رقم الجوال مسجل بحساب ثاني — سجّل دخولك');
    }
  }

  function createCustomer(d) {
    assertFree(d.email, d.phone);
    const c = {
      id: sec.newId(),
      name: d.name,
      email: d.email,
      phone: d.phone,
      phoneVerified: Boolean(d.phoneVerified),
      passwordHash: d.passwordHash,
      createdAt: Date.now(),
    };
    db.data.customers.push(c);
    db.save();
    return c;
  }

  // يرسل الرمز، ولو فشل الإرسال نلغي العملية عشان ما تبقى معلّقة
  async function sendFirst(p) {
    try {
      return { otp: await otps.send(p) };
    } catch (e) {
      otps.remove(p);
      throw e;
    }
  }

  router.post('/api/auth/register', async (ctx) => {
    if (!ipLimiter.hit(`reg:${ctx.ip}`)) throw new HttpError(429, 'محاولات كثيرة، حاول بعد شوي');
    const b = ctx.body;
    const name = v.str(b.name, { min: 2, max: 60, field: 'الاسم' });
    if (!String(b.email || '').trim()) throw new HttpError(400, 'اكتب الإيميل');
    const email = v.email(b.email);
    if (!String(b.phone || '').trim()) throw new HttpError(400, 'اكتب رقم الجوال');
    const phone = v.phone(b.phone);
    const password = v.password(b.password);
    assertFree(email, phone);
    const data = { name, email, phone, passwordHash: await sec.hashPassword(password) };
    if (!otpOn()) {
      const c = createCustomer(data);
      startSession(ctx, c);
      return { customer: customerView(c) };
    }
    return sendFirst(otps.create('register', data, ctx.ip));
  });

  router.post('/api/auth/login', async (ctx) => {
    const id = v.identifier(ctx.body.identifier);
    const key = `${ctx.ip}|${id.value}`;
    if (!ipLimiter.hit(`login:${ctx.ip}`) || !loginLimiter.hit(key)) {
      throw new HttpError(429, `محاولات كثيرة، حاول بعد ${loginLimiter.minutesLeft(key) || 15} دقيقة`);
    }
    const c = findCustomer(id);
    const ok = await sec.verifyPassword(String(ctx.body.password || ''), c ? c.passwordHash : null);
    if (!c || !ok) throw new HttpError(401, 'بيانات الدخول غير صحيحة');
    loginLimiter.clear(key);
    if (!otpOn()) {
      startSession(ctx, c);
      return { customer: customerView(c) };
    }
    // حساب قديم ما فيه رقم جوال → نطلب منه يضيف رقمه ونتحقق منه
    if (!c.phone) {
      const p = otps.create('login', { customerId: c.id, addPhone: true }, ctx.ip);
      return { needPhone: true, otp: otps.view(p) };
    }
    return sendFirst(otps.create('login', { customerId: c.id, phone: c.phone }, ctx.ip));
  });

  router.post('/api/auth/forgot', async (ctx) => {
    if (!ipLimiter.hit(`forgot:${ctx.ip}`)) throw new HttpError(429, 'محاولات كثيرة، حاول بعد شوي');
    if (!String(ctx.body.phone || '').trim()) throw new HttpError(400, 'اكتب رقم الجوال المسجل في حسابك');
    const phone = v.phone(ctx.body.phone);
    const c = db.data.customers.find((x) => x.phone === phone);
    if (!c) throw new HttpError(404, 'ما فيه حساب مسجل بهذا الرقم');
    return sendFirst(otps.create('reset', { customerId: c.id, phone }, ctx.ip));
  });

  // إضافة رقم جوال لحساب قديم أثناء الدخول
  router.post('/api/auth/otp/phone', async (ctx) => {
    const p = otps.get(ctx.body.id);
    if (!p.data.addPhone) throw new HttpError(400, 'طلب غير صالح');
    if (!String(ctx.body.phone || '').trim()) throw new HttpError(400, 'اكتب رقم الجوال');
    const phone = v.phone(ctx.body.phone);
    assertFree('', phone, p.data.customerId);
    p.phone = phone;
    return { otp: await otps.send(p) };
  });

  router.post('/api/auth/otp/resend', async (ctx) => ({ otp: await otps.send(otps.get(ctx.body.id)) }));

  router.post('/api/auth/otp/verify', async (ctx) => {
    const p = otps.get(ctx.body.id);
    const newPassword = p.purpose === 'reset' ? v.password(ctx.body.password, 'كلمة المرور الجديدة') : null;
    otps.check(p, ctx.body.code);
    let c;
    if (p.purpose === 'register') {
      c = createCustomer({ ...p.data, phoneVerified: true });
    } else {
      c = db.data.customers.find((x) => x.id === p.data.customerId);
      if (!c) {
        otps.remove(p);
        throw new HttpError(404, 'الحساب غير موجود');
      }
      if (p.data.addPhone) {
        assertFree('', p.phone, c.id);
        c.phone = p.phone;
      }
      c.phoneVerified = true;
      if (newPassword) {
        c.passwordHash = await sec.hashPassword(newPassword);
        sec.destroyUserSessions(db, 'customer', c.id);
      }
      db.save();
    }
    otps.remove(p);
    startSession(ctx, c);
    return { customer: customerView(c), purpose: p.purpose };
  });

  router.post('/api/auth/logout', (ctx) => {
    sec.destroySession(db, ctx.cookies[CUSTOMER_COOKIE]);
    ctx.setCookie(CUSTOMER_COOKIE, '', { maxAge: 0, path: '/' });
    return { ok: true };
  });

  router.put('/api/auth/me', requireCustomer, (ctx) => {
    ctx.customer.name = v.str(ctx.body.name, { min: 2, max: 60, field: 'الاسم' });
    db.save();
    return { customer: customerView(ctx.customer) };
  });

  router.post('/api/auth/password', requireCustomer, async (ctx) => {
    const ok = await sec.verifyPassword(String(ctx.body.current || ''), ctx.customer.passwordHash);
    if (!ok) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
    ctx.customer.passwordHash = await sec.hashPassword(v.password(ctx.body.password, 'كلمة المرور الجديدة'));
    sec.destroyUserSessions(db, 'customer', ctx.customer.id, ctx.cookies[CUSTOMER_COOKIE]);
    db.save();
    return { ok: true };
  });
};
