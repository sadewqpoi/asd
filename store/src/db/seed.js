'use strict';
// بيانات أول تشغيل: أقسام ومنتجات تجريبية وصفحات جاهزة (تقدر تحذفها من لوحة التحكم)
const { newId } = require('../lib/security');
const { defaultPages, makeHomePage } = require('../lib/pages');

// منتجات تجريبية عشان المتجر ما يطلع فاضي أول مرة — تقدر تحذفها من لوحة التحكم
function seed(data) {
  const now = Date.now();
  const cat = (name, i) => ({
    id: newId(), name, description: '', image: '', visible: true, showOnHome: true, order: i, createdAt: now,
  });
  const citizens = cat('حزم المواطنين', 0);
  const military = cat('حزم العسكرية', 1);
  const special = cat('المميز', 2);
  const cars = cat('SPECIAL CAR', 3);
  data.categories = [citizens, military, special, cars];
  data.settings.menu = data.categories.map((c) => ({ label: c.name, url: `/category/${c.id}` }));
  data.pages = [makeHomePage(data.settings, data.categories), ...defaultPages(data.settings.storeName)];
  data.settings.footer.columns = buildFooterColumns(data);

  let t = now;
  const prod = (name, price, salePrice, quantity, cats, image, shortDesc) => ({
    id: newId(),
    name,
    shortDesc,
    description: `${shortDesc}\n\n• التفعيل داخل السيرفر بعد تأكيد الطلب\n• للاستفسار تواصل معنا عبر الدسكورد`,
    price,
    salePrice,
    quantity,
    categoryIds: cats.map((c) => c.id),
    images: [`/img/seed/${image}.svg`],
    visible: true,
    sold: 0,
    ratingSum: 0,
    ratingCount: 0,
    createdAt: t--,
    updatedAt: now,
  });

  data.products = [
    prod('الخزنة الذكية', 99, 89, null, [citizens], 'safe', 'خزنة ذكية آمنة لحفظ أغراضك داخل المدينة.'),
    prod('كبار الداعمين | MV9', 2700, null, 0, [citizens, special], 'crown', 'رتبة كبار الداعمين مع كل المزايا الحصرية.'),
    prod('حزمة التهريب', 199, 179, null, [citizens], 'car-red', 'حزمة كاملة لعشاق المغامرة والمطاردات.'),
    prod('حزمة بريميوم', 299, 269, null, [citizens, special], 'car-blue', 'حزمة بريميوم بمزايا متقدمة وسيارة مميزة.'),
    prod('حزمة الدوريات', 149, null, null, [military], 'shield', 'معدات وتجهيزات الدوريات الأمنية.'),
    prod('حزمة القوات الخاصة', 279, 249, null, [military, special], 'shield', 'تجهيزات القوات الخاصة الكاملة.'),
    prod('حزمة المرور', 129, null, null, [military], 'car-blue', 'سيارات وتجهيزات أمن الطرق.'),
    prod('سيارة مخصصة VIP', 349, null, 5, [cars, special], 'car-red', 'سيارة مخصصة بتصميم حصري باسمك.'),
    prod('سيارة رياضية معدلة', 249, 219, null, [cars], 'car-blue', 'سيارة رياضية بتعديلات أداء كاملة.'),
  ];
}

// أعمدة الفوتر: تنبني من الروابط والأقسام وبيانات التواصل القديمة — بعدها تتعدل كاملة من لوحة التحكم
function buildFooterColumns(data) {
  const s = data.settings || {};
  const f = s.footer || {};
  const important = (s.topLinks || []).filter((l) => l.url && !l.url.startsWith('#')).map((l) => ({ label: l.label, url: l.url }));
  for (const p of data.pages || []) if (p.visible && p.showInFooter && !p.isHome) important.push({ label: p.title, url: `/page/${p.slug}` });
  important.push({ label: 'حسابي', url: '/account' }, { label: 'سلة المشتريات', url: '/cart' });
  const cats = [...(data.categories || [])].filter((c) => c.visible).sort((a, b) => a.order - b.order).slice(0, 8)
    .map((c) => ({ label: c.name, url: `/category/${c.id}` }));
  const contact = [];
  if (f.email) contact.push({ label: f.email, url: `mailto:${f.email}` });
  if (f.phone) contact.push({ label: f.phone, url: `tel:${String(f.phone).replace(/[^\d+]/g, '')}` });
  if (f.whatsapp) contact.push({ label: 'واتساب', url: `https://wa.me/${String(f.whatsapp).replace(/\D/g, '')}` });
  return [
    { id: newId(6), title: 'روابط مهمة', links: important.slice(0, 20) },
    { id: newId(6), title: 'الأقسام', links: cats },
    { id: newId(6), title: 'تواصل معنا', links: contact },
  ];
}

module.exports = { seed, buildFooterColumns };
