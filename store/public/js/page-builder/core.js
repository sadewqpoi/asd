'use strict';
// محرر الصفحات — الأيقونات وأنواع الأقسام وأدوات صغيرة

// =====================================================================
//  محرر الصفحات — تكتب وتنسّق مباشرة على الصفحة مثل الوورد،
//  وترتب الأقسام (بانر، نص، صور، أزرار) بالسحب مثل شرائح البوربوينت
// =====================================================================

Object.assign(ICONS, {
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>',
  alignRight: '<path d="M21 6H3M21 12H9M21 18H7"/>',
  alignCenter: '<path d="M21 6H3M17 12H7M19 18H5"/>',
  alignLeft: '<path d="M21 6H3M15 12H3M17 18H3"/>',
  alignJustify: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  listUl: '<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"/>',
  listOl: '<path d="M10 6h11M10 12h11M10 18h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  eraser: '<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21M22 21H7M5 11l9 9"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  unlink: '<path d="m18.8 12.3 1.7-1.8a5 5 0 0 0-7-7l-1.8 1.7M5.2 11.8l-1.7 1.7a5 5 0 0 0 7 7l1.8-1.7M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
  textColor: '<path d="M4 20h16M6 16l6-12 6 12M8.5 11h7"/>',
  highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  banner: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 10h8M6 14h5"/>',
  columns: '<rect x="3" y="4" width="8" height="16" rx="1"/><path d="M14 6h7M14 10h7M14 14h7M14 18h5"/>',
});

const PB_TYPES = [
  ['slider', 'بنرات متحركة', 'layout', 'صور عريضة تتبدل تلقائياً أعلى الصفحة'],
  ['hero', 'واجهة ترحيبية', 'home', 'عنوان كبير ونص وزر مع صورة جانبية'],
  ['products', 'منتجات', 'box', 'منتجات من قائمة تختارها — صف يتمرر أو شبكة'],
  ['banner', 'بانر', 'banner', 'خلفية بصورة وعنوان كبير — مثل شريحة بوربوينت'],
  ['text', 'نص', 'edit', 'عناوين وفقرات وقوائم بتنسيق مثل الوورد'],
  ['image', 'صورة', 'image', 'صورة تتحكم بحجمها ومكانها'],
  ['imageText', 'صورة مع نص', 'columns', 'صورة على جنب ونص على الجنب الثاني'],
  ['gallery', 'معرض صور', 'grid', 'مجموعة صور مرتبة في شبكة'],
  ['button', 'زر', 'link', 'زر يودّي لأي صفحة'],
  ['divider', 'فاصل', 'minus', 'زخرفة أو خط أو مسافة بين الأقسام'],
];
const PB_LABEL = Object.fromEntries(PB_TYPES.map(([k, l]) => [k, l]));
const PB_ICON = Object.fromEntries(PB_TYPES.map(([k, , ic]) => [k, ic]));
const TPL_ICONS = { blank: 'file', about: 'users', terms: 'shield', returns: 'refresh', faq: 'info' };

// بيانات يحتاجها المحرر لعرض أقسام المنتجات مثل المتجر
const PB_CTX = { categories: [], products: [], currency: 'ر.س' };

function pbProducts(b) {
  const cat = b.categoryId ? PB_CTX.categories.find((c) => c.id === b.categoryId) : null;
  if (b.categoryId && (!cat || !cat.visible)) return null;
  const price = (x) => (x.salePrice !== null && x.salePrice !== undefined ? x.salePrice : x.price);
  const cmp = {
    best: (x, y) => (y.sold || 0) - (x.sold || 0),
    price_asc: (x, y) => price(x) - price(y),
    price_desc: (x, y) => price(y) - price(x),
  }[b.sort] || ((x, y) => y.createdAt - x.createdAt);
  const list = PB_CTX.products.filter((x) => !cat || x.categoryIds.includes(cat.id)).sort(cmp)
    .sort((x, y) => Number(y.inStock) - Number(x.inStock));
  return { title: b.title || (cat ? cat.name : 'منتجاتنا'), link: cat ? `/category/${cat.id}` : '/search?q=', items: list.slice(0, b.limit || 12) };
}

// بطاقة منتج للمعاينة داخل المحرر (نفس شكل بطاقة المتجر)
function pbCard(p) {
  const money = (n) => `<span class="money"><span class="num">${fmtNum(n)}</span><span class="cur">${esc(PB_CTX.currency)}</span></span>`;
  const sale = p.salePrice !== null && p.salePrice !== undefined;
  const off = sale ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  return `<article class="pcard">
    <a class="pcard-img">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : `<div class="noimg">${icon('image')}</div>`}</a>
    <span class="wish">${icon('heart')}</span>
    ${off > 0 && p.inStock ? `<span class="sale-tag">خصم <span class="num">${off}%</span></span>` : ''}
    <div class="pcard-body"><a class="pcard-name">${esc(p.name)}</a>
      <div class="pcard-meta">${sale ? `<span class="price"><span class="sale">${money(p.salePrice)}</span><del>${money(p.price)}</del></span>` : `<span class="price">${money(p.price)}</span>`}
        ${p.rating ? `<span class="rating">${icon('star')}<span class="num">${p.rating}</span></span>` : ''}</div>
      <span class="btn-cart">${p.inStock ? `${icon('bag')}أضف إلى السلة` : 'نفدت الكمية'}</span></div>
  </article>`;
}

const pbId = () => (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 10);
const slugifyClient = (s) => toLatinDigits(String(s || '')).toLowerCase().trim()
  .replace(/&/g, '-and-').replace(/[\s_]+/g, '-').replace(/[^a-z0-9ء-ي-]/g, '')
  .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function newPageBlock(type) {
  const base = { id: pbId(), type, bg: '', pad: 'md', width: 'normal' };
  const doc = (h, p) => [{ type: 'h3', children: [{ text: h }] }, { type: 'p', children: [{ text: p }] }];
  switch (type) {
    case 'slider':
      return { ...base, width: 'wide', pad: 'sm', ratio: 'wide', slides: [] };
    case 'hero':
      return { ...base, width: 'wide', title: 'اهلاً بكم', highlight: 'عنوان مميز لمتجرك', text: 'نص تعريفي قصير عن متجرك ومنتجاتك.', buttonText: 'تسوق الآن', buttonLink: '#products', image: '' };
    case 'products':
      return { ...base, width: 'wide', categoryId: (PB_CTX.categories[0] || {}).id || '', title: '', layout: 'row', sort: 'new', limit: 12, seeAll: true };
    case 'banner':
      return { ...base, width: 'wide', title: 'عنوان البانر', text: 'نص قصير تحت العنوان', image: '', color: '#ffffff', overlay: 35, align: 'center', minHeight: 320, buttonText: '', buttonLink: '' };
    case 'text':
      return { ...base, doc: doc('عنوان', 'اكتب النص هنا…') };
    case 'image':
      return { ...base, src: '', alt: '', size: 100, align: 'center', radius: true, shadow: false, link: '', caption: '' };
    case 'imageText':
      return { ...base, src: '', alt: '', imagePos: 'right', imageSize: 40, valign: 'center', radius: true, doc: doc('عنوان', 'اكتب النص هنا…') };
    case 'gallery':
      return { ...base, images: [], cols: 3, radius: true };
    case 'button':
      return { ...base, text: 'تسوق الآن', link: '/', style: 'primary', size: 'md', align: 'center' };
    default:
      return { ...base, style: 'ornament', space: 40 };
  }
}
