'use strict';
// قوائم المنتجات (الأقسام)
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const pages = require('../../lib/pages');

module.exports = function categoriesRoutes(router, c) {
  const { db, S, now, has, need, sortedCats, homePage } = c;

  // «تظهر في الرئيسية» = فيه قسم منتجات لهذي القائمة داخل الصفحة الرئيسية

  const homeHasCat = (id) => Boolean(homePage() && homePage().blocks.some((b) => b.type === 'products' && b.categoryId === id));
  const setHomeCat = (c, on) => {
    const h = homePage();
    if (!h) return;
    if (on && !homeHasCat(c.id)) h.blocks.push(pages.productsBlock(c));
    if (!on) h.blocks = h.blocks.filter((b) => !(b.type === 'products' && b.categoryId === c.id));
    h.updatedAt = now();
  };
  const catView = (c) => ({ ...c, showOnHome: homeHasCat(c.id), count: db.data.products.filter((p) => p.categoryIds.includes(c.id)).length });
  const findCat = (id) => {
    const c = db.data.categories.find((x) => x.id === id);
    if (!c) throw new HttpError(404, 'القسم غير موجود');
    return c;
  };

  router.get('/api/admin/categories', need('categories', 'products'), () => ({ categories: sortedCats().map(catView) }));

  router.post('/api/admin/categories', need('categories'), (ctx) => {
    const b = ctx.body;
    if (db.data.categories.length >= 100) throw new HttpError(400, 'وصلت للحد الأقصى من الأقسام');
    const c = {
      id: sec.newId(),
      name: v.str(b.name, { min: 1, max: 60, field: 'اسم القسم' }),
      description: v.str(b.description, { max: 300, field: 'وصف القسم' }),
      image: v.imageRef(b.image, { field: 'صورة القسم' }),
      visible: has(b, 'visible') ? v.bool(b.visible) : true,
      showOnHome: has(b, 'showOnHome') ? v.bool(b.showOnHome) : true,
      order: db.data.categories.reduce((m, x) => Math.max(m, x.order), -1) + 1,
      createdAt: now(),
    };
    db.data.categories.push(c);
    if (c.showOnHome) setHomeCat(c, true);
    if (v.bool(b.addToMenu) && S().menu.length < 20) S().menu.push({ label: c.name, url: `/category/${c.id}` });
    db.save();
    return { category: catView(c) };
  });

  router.put('/api/admin/categories/:id', need('categories'), (ctx) => {
    const c = findCat(ctx.params.id);
    const b = ctx.body;
    if (has(b, 'name')) {
      const name = v.str(b.name, { min: 1, max: 60, field: 'اسم القسم' });
      // نحدّث اسم القسم بالقائمة الرئيسية لو كان نفس الاسم القديم
      for (const m of S().menu) if (m.url === `/category/${c.id}` && m.label === c.name) m.label = name;
      c.name = name;
    }
    if (has(b, 'description')) c.description = v.str(b.description, { max: 300, field: 'وصف القسم' });
    if (has(b, 'image')) c.image = v.imageRef(b.image, { field: 'صورة القسم' });
    if (has(b, 'visible')) c.visible = v.bool(b.visible);
    if (has(b, 'showOnHome')) {
      c.showOnHome = v.bool(b.showOnHome);
      setHomeCat(c, c.showOnHome);
    }
    db.save();
    return { category: catView(c) };
  });

  router.delete('/api/admin/categories/:id', need('categories'), (ctx) => {
    const c = findCat(ctx.params.id);
    db.data.categories = db.data.categories.filter((x) => x !== c);
    for (const p of db.data.products) p.categoryIds = p.categoryIds.filter((id) => id !== c.id);
    S().menu = S().menu.filter((m) => m.url !== `/category/${c.id}`);
    for (const col of S().footer.columns || []) col.links = col.links.filter((l) => l.url !== `/category/${c.id}`);
    for (const pg of db.data.pages) pg.blocks = pg.blocks.filter((bl) => !(bl.type === 'products' && bl.categoryId === c.id));
    db.save();
    return { ok: true };
  });

  router.post('/api/admin/categories/reorder', need('categories'), (ctx) => {
    const ids = v.arr(ctx.body.ids, { max: 100, field: 'الترتيب' });
    ids.forEach((id, i) => {
      const c = db.data.categories.find((x) => x.id === id);
      if (c) c.order = i;
    });
    db.save();
    return { categories: sortedCats().map(catView) };
  });
};
