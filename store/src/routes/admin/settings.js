'use strict';
// تعديل المتجر (الإعدادات)
const v = require('../../lib/validate');
const sec = require('../../lib/security');
const otp = require('../../lib/otp');

module.exports = function settingsRoutes(router, c) {
  const { db, S, has, obj, need, sortedCats, homePage } = c;

  function sanitizeSettings(b, cur) {
    const links = (list, field, max) => v.arr(list, { max, field }).map((l, i) => ({
      label: v.str(obj(l).label, { min: 1, max: 40, field: `${field} — العنوان رقم ${i + 1}` }),
      url: v.safeUrl(obj(l).url, { field: `${field} — الرابط رقم ${i + 1}` }) || '/',
    }));
    const hero = obj(b.hero);
    const ann = obj(b.announcement);
    const footer = obj(b.footer);
    const social = obj(b.social);
    const pay = obj(b.payment);
    return {
      storeName: v.str(b.storeName, { min: 1, max: 60, field: 'اسم المتجر' }),
      description: v.str(b.description, { max: 300, field: 'وصف المتجر' }),
      logo: v.imageRef(b.logo, { field: 'الشعار' }),
      logoMode: ['text', 'image', 'both'].includes(b.logoMode) ? b.logoMode : 'image',
      logoText: v.str(b.logoText, { max: 40, field: 'نص الشعار' }),
      logoTextColor: v.color(b.logoTextColor, cur.logoTextColor || '#0f4c52'),
      primaryColor: v.color(b.primaryColor, cur.primaryColor),
      accentColor: v.color(b.accentColor, cur.accentColor || '#a8844a'),
      currency: v.str(b.currency, { min: 1, max: 10, field: 'رمز العملة' }),
      announcement: {
        enabled: v.bool(ann.enabled),
        text: v.str(ann.text, { max: 200, field: 'نص الإعلان' }),
        link: v.safeUrl(ann.link, { field: 'رابط الإعلان' }),
      },
      topLinks: links(b.topLinks, 'روابط الشريط العلوي', 12),
      menu: links(b.menu, 'القائمة الرئيسية', 20),
      hero: {
        enabled: v.bool(hero.enabled),
        title: v.str(hero.title, { max: 100, field: 'العنوان الصغير' }),
        highlight: v.str(hero.highlight, { max: 100, field: 'العنوان الكبير' }),
        text: v.str(hero.text, { max: 600, field: 'النص', multiline: true }),
        buttonText: v.str(hero.buttonText, { max: 50, field: 'نص الزر' }),
        buttonLink: v.safeUrl(hero.buttonLink, { field: 'رابط الزر' }),
        image: v.imageRef(hero.image, { field: 'صورة الواجهة' }),
      },
      whatsappVerify: v.bool(b.whatsappVerify),
      banners: v.arr(b.banners, { max: 10, field: 'البنرات' }).map((x, i) => ({
        image: v.imageRef(obj(x).image, { field: `صورة البنر ${i + 1}` }),
        link: v.safeUrl(obj(x).link, { field: `رابط البنر ${i + 1}` }),
        alt: v.str(obj(x).alt, { max: 100, field: `وصف البنر ${i + 1}` }),
      })).filter((x) => x.image),
      footer: {
        about: v.str(footer.about, { max: 500, field: 'نبذة المتجر', multiline: true }),
        copyright: v.str(footer.copyright, { max: 120, field: 'نص الحقوق' }),
        showBrand: has(footer, 'showBrand') ? v.bool(footer.showBrand) : true,
        columns: v.arr(footer.columns, { max: 8, field: 'أعمدة الفوتر' }).map((raw, i) => {
          const col = obj(raw);
          return {
            id: typeof col.id === 'string' && /^[a-z0-9]{4,20}$/i.test(col.id) ? col.id : sec.newId(6),
            title: v.str(col.title, { max: 40, field: `عنوان عمود الفوتر رقم ${i + 1}` }),
            links: links(col.links, `عمود الفوتر رقم ${i + 1}`, 25),
          };
        }),
      },
      social: Object.fromEntries(['discord', 'x', 'instagram', 'tiktok', 'snapchat', 'youtube']
        .map((k) => [k, v.safeUrl(social[k], { field: `رابط ${k}` })])),
      payment: {
        bankEnabled: v.bool(pay.bankEnabled),
        bankName: v.str(pay.bankName, { max: 60, field: 'اسم البنك' }),
        accountName: v.str(pay.accountName, { max: 80, field: 'اسم صاحب الحساب' }),
        iban: v.str(pay.iban, { max: 40, field: 'رقم الآيبان' }).toUpperCase(),
        instructions: v.str(pay.instructions, { max: 600, field: 'تعليمات الدفع', multiline: true }),
      },
    };
  }

  router.get('/api/admin/settings', need('design'), () => ({
    settings: S(),
    categories: sortedCats().map((c) => ({ id: c.id, name: c.name })),
    whatsappConfigured: otp.isConfigured(),
    pages: db.data.pages.filter((x) => !x.isHome).map((x) => ({ title: x.title, slug: x.slug, visible: x.visible })),
    homePageId: (homePage() || {}).id || '',
  }));

  router.put('/api/admin/settings', need('design'), (ctx) => {
    db.data.settings = sanitizeSettings(ctx.body, S());
    db.save();
    return { settings: db.data.settings };
  });
};
