'use strict';
// مكتبة الصور: رفع وحذف مع فحص نوع الملف من محتواه
const fs = require('fs');
const path = require('path');
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const pages = require('../../lib/pages');

const MAX_UPLOAD = 8 * 1024 * 1024;

function sniffImage(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.toString('ascii', 0, 4) === 'GIF8') return { ext: 'gif', mime: 'image/gif' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

module.exports = function mediaRoutes(router, c) {
  const { db, uploadsDir, S, now, need } = c;

  function mediaUsage(url) {
    const used = [];
    const s = S();
    if (s.logo === url) used.push('شعار المتجر');
    if (s.hero.image === url) used.push('الواجهة الرئيسية');
    if (s.banners.some((b) => b.image === url)) used.push('البنرات');
    for (const p of db.data.products) if (p.images.includes(url)) used.push(`منتج: ${p.name}`);
    for (const c of db.data.categories) if (c.image === url) used.push(`قسم: ${c.name}`);
    for (const pg of db.data.pages) if (pages.pageImages(pg).includes(url)) used.push(`صفحة: ${pg.title}`);
    return used;
  }

  router.get('/api/admin/media', need('media', 'products', 'design', 'categories'), () => ({
    media: db.data.media.map((m) => ({ ...m, usedIn: mediaUsage(m.url) })),
  }));

  router.post('/api/admin/media', need('media', 'products', 'design', 'categories'), (ctx) => {
    const name = v.str(ctx.body.name, { max: 200, field: 'اسم الملف' }).slice(0, 120) || 'صورة';
    const data = ctx.body.data;
    if (typeof data !== 'string' || !data) throw new HttpError(400, 'ما وصلت الصورة');
    const comma = data.startsWith('data:') ? data.indexOf(',') : -1;
    const buf = Buffer.from(comma >= 0 ? data.slice(comma + 1) : data, 'base64');
    if (buf.length > MAX_UPLOAD) throw new HttpError(413, 'حجم الصورة أكبر من 8 ميجا');
    const type = sniffImage(buf);
    if (!type) throw new HttpError(400, 'نوع الملف غير مدعوم — الصيغ المسموحة: JPG, PNG, WEBP, GIF');
    const file = `${Date.now().toString(36)}-${sec.newId(8)}.${type.ext}`;
    fs.writeFileSync(path.join(uploadsDir, file), buf);
    const item = { id: sec.newId(), url: `/uploads/${file}`, name, size: buf.length, type: type.mime, createdAt: now(), by: ctx.admin.name };
    db.data.media.unshift(item);
    db.save();
    return { media: { ...item, usedIn: [] } };
  });

  router.delete('/api/admin/media/:id', need('media'), (ctx) => {
    const m = db.data.media.find((x) => x.id === ctx.params.id);
    if (!m) throw new HttpError(404, 'الصورة غير موجودة');
    const file = path.basename(m.url);
    const full = path.join(uploadsDir, file);
    if (m.url === `/uploads/${file}` && full.startsWith(uploadsDir)) {
      try { fs.unlinkSync(full); } catch { /* الملف محذوف من قبل */ }
    }
    // نشيل أي استخدام للصورة عشان ما تطلع صورة مكسورة بالمتجر
    const s = S();
    if (s.logo === m.url) s.logo = '';
    if (s.hero.image === m.url) s.hero.image = '';
    s.banners = s.banners.filter((b) => b.image !== m.url);
    for (const p of db.data.products) p.images = p.images.filter((u) => u !== m.url);
    for (const c of db.data.categories) if (c.image === m.url) c.image = '';
    for (const pg of db.data.pages) pages.removeImage(pg, m.url);
    db.data.media = db.data.media.filter((x) => x !== m);
    db.save();
    return { ok: true };
  });
};
