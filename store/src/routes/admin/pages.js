'use strict';
// الصفحات (من نحن، الشروط والأحكام...)
const { HttpError } = require('../../http/router');
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const shop = require('../../lib/shop');
const pages = require('../../lib/pages');

module.exports = function pagesRoutes(router, c) {
  const { app, db, S, now, has, need, sortedCats } = c;

  const findPage = (id) => {
    const p = db.data.pages.find((x) => x.id === id);
    if (!p) throw new HttpError(404, 'الصفحة غير موجودة');
    return p;
  };

  const uniqueSlug = (base, exceptId) => {
    let slug = base;
    for (let n = 2; db.data.pages.some((x) => x.id !== exceptId && x.slug === slug); n++) slug = `${base}-${n}`;
    return slug;
  };

  // لما يتغير رابط الصفحة نحدّث روابط القوائم اللي تشير لها
  const relinkMenus = (from, to) => {
    for (const list of [S().menu, S().topLinks, ...(S().footer.columns || []).map((c) => c.links)]) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].url !== `/page/${from}`) continue;
        if (to) list[i].url = `/page/${to}`;
        else list.splice(i, 1);
      }
    }
  };

  // «في الفوتر» = رابط الصفحة موجود بأحد أعمدة الفوتر
  const footerHasPage = (slug) => (S().footer.columns || []).some((c) => c.links.some((l) => l.url === `/page/${slug}`));
  const setFooterPage = (p, on) => {
    const cols = S().footer.columns || (S().footer.columns = []);
    if (on && !footerHasPage(p.slug)) {
      let col = cols[0];
      if (!col) { col = { id: sec.newId(6), title: 'روابط مهمة', links: [] }; cols.push(col); }
      if (col.links.length < 25) col.links.push({ label: p.title, url: `/page/${p.slug}` });
    }
    if (!on) for (const c of cols) c.links = c.links.filter((l) => l.url !== `/page/${p.slug}`);
  };

  const pageView = (p) => ({ ...p, showInFooter: !p.isHome && footerHasPage(p.slug) });
  const pageSummary = (p) => ({
    id: p.id, title: p.title, slug: p.slug, visible: p.visible, isHome: Boolean(p.isHome), showInFooter: !p.isHome && footerHasPage(p.slug),
    blocksCount: p.blocks.length, updatedAt: p.updatedAt,
  });

  router.get('/api/admin/pages', need('design'), () => ({
    pages: [...db.data.pages].sort((a, b) => Number(Boolean(b.isHome)) - Number(Boolean(a.isHome))).map(pageSummary),
    templates: pages.templateList(),
  }));

  // المحرر يحتاج المنتجات والأقسام عشان يعرض أقسام المنتجات مثل ما تطلع بالمتجر
  router.get('/api/admin/pages/:id', need('design'), (ctx) => ({
    page: pageView(findPage(ctx.params.id)),
    theme: { primaryColor: S().primaryColor, accentColor: S().accentColor, storeName: S().storeName, currency: S().currency },
    categories: sortedCats().map((c) => ({ id: c.id, name: c.name, visible: c.visible })),
    products: db.data.products.filter((x) => x.visible).map((x) => ({ ...shop.publicProduct(x), sold: x.sold || 0 })),
  }));

  // معاينة صفحة مخفية من المتجر (للمشرفين بس)
  router.get('/api/admin/page-preview/:slug', need('design'), (ctx) => {
    const p = db.data.pages.find((x) => x.slug === ctx.params.slug && !x.isHome);
    if (!p) throw new HttpError(404, 'الصفحة غير موجودة');
    return { page: pages.publicPage(p), hidden: !p.visible, products: app.resolveProducts(p) };
  });

  router.post('/api/admin/pages', need('design'), (ctx) => {
    if (db.data.pages.length >= 60) throw new HttpError(400, 'وصلت للحد الأقصى من الصفحات');
    const b = ctx.body;
    const key = pages.TEMPLATES[b.template] ? b.template : 'blank';
    const p = pages.makePage(key, S().storeName);
    const title = v.str(b.title, { max: 80, field: 'عنوان الصفحة' });
    if (title) p.title = title;
    const base = b.slug ? pages.validSlug(b.slug) : (p.slug || pages.slugify(p.title) || `page-${sec.newId(4)}`);
    p.slug = uniqueSlug(base);
    p.blocks = pages.sanitizeBlocks(p.blocks);
    db.data.pages.push(p);
    db.save();
    return { page: pageView(p) };
  });

  router.put('/api/admin/pages/:id', need('design'), (ctx) => {
    const p = findPage(ctx.params.id);
    const b = ctx.body;
    if (p.isHome) {
      // الرئيسية: نعدّل الأقسام بس (رابطها / دائماً، وما تنخفي)
      if (has(b, 'blocks')) p.blocks = pages.sanitizeBlocks(b.blocks);
      p.updatedAt = now();
      db.save();
      return { page: pageView(p) };
    }
    if (has(b, 'title')) p.title = v.str(b.title, { min: 1, max: 80, field: 'عنوان الصفحة' });
    if (has(b, 'slug')) {
      const slug = pages.validSlug(b.slug);
      if (slug === 'home' || db.data.pages.some((x) => x !== p && x.slug === slug)) throw new HttpError(409, 'الرابط هذا مستخدم لصفحة ثانية — اختر رابط ثاني');
      if (slug !== p.slug) relinkMenus(p.slug, slug);
      p.slug = slug;
    }
    if (has(b, 'visible')) p.visible = v.bool(b.visible);
    if (has(b, 'showInFooter')) setFooterPage(p, v.bool(b.showInFooter));
    if (has(b, 'showTitle')) p.showTitle = v.bool(b.showTitle);
    if (has(b, 'description')) p.description = v.str(b.description, { max: 200, field: 'وصف الصفحة' });
    if (has(b, 'blocks')) p.blocks = pages.sanitizeBlocks(b.blocks);
    p.updatedAt = now();
    db.save();
    return { page: pageView(p) };
  });

  router.delete('/api/admin/pages/:id', need('design'), (ctx) => {
    const p = findPage(ctx.params.id);
    if (p.isHome) throw new HttpError(400, 'ما تقدر تحذف الصفحة الرئيسية');
    db.data.pages = db.data.pages.filter((x) => x !== p);
    relinkMenus(p.slug, null);
    db.save();
    return { ok: true };
  });
};
