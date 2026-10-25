'use strict';
// المشرفين والصلاحيات
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');

module.exports = function adminsRoutes(router, c) {
  const { db, now, has, ALL_PERMS, can, permsOf, adminView, need, assertUnique } = c;

  function assertCanManage(actor, target) {
    if (target.id === actor.id) throw new HttpError(400, 'لتعديل حسابك روح لصفحة "حسابي"');
    if (target.role === 'owner') throw new HttpError(403, 'ما تقدر تعدّل حساب مالك المتجر');
    if (actor.role !== 'owner' && permsOf(target).some((p) => !can(actor, p))) {
      throw new HttpError(403, 'هذا المشرف عنده صلاحيات ما عندك — بس المالك يقدر يعدّله');
    }
  }

  function sanitizePerms(actor, list) {
    const perms = [...new Set(v.arr(list, { max: 20, field: 'الصلاحيات' }))].filter((p) => ALL_PERMS.includes(p));
    if (perms.some((p) => !can(actor, p))) throw new HttpError(403, 'ما تقدر تعطي صلاحية ما عندك');
    if (!perms.length) throw new HttpError(400, 'اختر صلاحية وحدة على الأقل');
    return perms;
  }

  const findTarget = (id) => {
    const t = db.data.admins.find((a) => a.id === id);
    if (!t) throw new HttpError(404, 'المشرف غير موجود');
    return t;
  };

  router.get('/api/admin/admins', need('admins'), () => ({
    admins: db.data.admins.map((a) => ({ ...adminView(a), createdBy: db.data.admins.find((x) => x.id === a.createdBy)?.name || '' })),
  }));

  router.post('/api/admin/admins', need('admins'), async (ctx) => {
    const b = ctx.body;
    if (db.data.admins.length >= 50) throw new HttpError(400, 'وصلت للحد الأقصى من المشرفين');
    const name = v.str(b.name, { min: 2, max: 60, field: 'اسم المشرف' });
    const id = v.identifier(b.identifier);
    const email = id.type === 'email' ? id.value : '';
    const phone = id.type === 'phone' ? id.value : '';
    assertUnique(email, phone);
    const permissions = sanitizePerms(ctx.admin, b.permissions);
    const temp = typeof b.password === 'string' && b.password ? v.password(b.password) : sec.tempPassword();
    const passwordHash = await sec.hashPassword(temp);
    assertUnique(email, phone);
    const a = {
      id: sec.newId(), name, email, phone, role: 'admin', permissions, passwordHash,
      mustChangePassword: true, active: true, createdAt: now(), lastLoginAt: null, createdBy: ctx.admin.id,
    };
    db.data.admins.push(a);
    db.save();
    return { admin: adminView(a), tempPassword: temp };
  });

  router.put('/api/admin/admins/:id', need('admins'), (ctx) => {
    const t = findTarget(ctx.params.id);
    assertCanManage(ctx.admin, t);
    const b = ctx.body;
    if (has(b, 'name')) t.name = v.str(b.name, { min: 2, max: 60, field: 'اسم المشرف' });
    if (has(b, 'email') || has(b, 'phone')) {
      const email = has(b, 'email') ? (b.email ? v.email(b.email) : '') : t.email;
      const phone = has(b, 'phone') ? (b.phone ? v.phone(b.phone) : '') : t.phone;
      if (!email && !phone) throw new HttpError(400, 'لازم إيميل أو رقم جوال على الأقل');
      assertUnique(email, phone, t.id);
      t.email = email;
      t.phone = phone;
    }
    if (has(b, 'permissions')) t.permissions = sanitizePerms(ctx.admin, b.permissions);
    if (has(b, 'active')) {
      t.active = v.bool(b.active);
      if (!t.active) sec.destroyUserSessions(db, 'admin', t.id);
    }
    db.save();
    return { admin: adminView(t) };
  });

  router.post('/api/admin/admins/:id/reset-password', need('admins'), async (ctx) => {
    const t = findTarget(ctx.params.id);
    assertCanManage(ctx.admin, t);
    const temp = sec.tempPassword();
    t.passwordHash = await sec.hashPassword(temp);
    t.mustChangePassword = true;
    sec.destroyUserSessions(db, 'admin', t.id);
    db.save();
    return { admin: adminView(t), tempPassword: temp };
  });

  router.delete('/api/admin/admins/:id', need('admins'), (ctx) => {
    const t = findTarget(ctx.params.id);
    assertCanManage(ctx.admin, t);
    db.data.admins = db.data.admins.filter((a) => a !== t);
    sec.destroyUserSessions(db, 'admin', t.id);
    db.save();
    return { ok: true };
  });
};
