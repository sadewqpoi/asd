'use strict';
// صفحات المحتوى (من نحن، الشروط والأحكام...) — التحقق من محتواها وقوالبها الجاهزة
// المحتوى يتخزن كبيانات منظمة (مو HTML) عشان ما يقدر أحد يدخل كود ضار في الصفحات
const { HttpError } = require('../http/router');
const v = require('./validate');
const sec = require('./security');

const BLOCK_TYPES = ['slider', 'hero', 'products', 'banner', 'text', 'image', 'imageText', 'gallery', 'button', 'divider'];
const RT_TYPES = ['p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol'];
const ALIGNS = ['right', 'center', 'left', 'justify'];

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const pick = (val, list, def) => (list.includes(val) ? val : def);
const int = (val, min, max, def) => {
  const n = Math.round(Number(val));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// نص داخل الفقرات: نحافظ على المسافات (ما نقص الأطراف) لأن النص مقسّم على أجزاء بتنسيقات مختلفة
function runText(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 5000);
}

function sanitizeInlines(list, field) {
  return v.arr(list, { max: 800, field }).map((raw) => {
    const n = obj(raw);
    const o = { text: runText(n.text) };
    if (!o.text) return null;
    for (const k of ['b', 'i', 'u', 's']) if (n[k] === true) o[k] = true;
    const color = v.color(n.color, '');
    if (color) o.color = color;
    const bg = v.color(n.bg, '');
    if (bg) o.bg = bg;
    if (['sm', 'lg', 'xl'].includes(n.size)) o.size = n.size;
    if (n.href) {
      const href = v.safeUrl(n.href, { field: `${field} — رابط داخل النص` });
      if (href) o.href = href;
    }
    return o;
  }).filter(Boolean);
}

function sanitizeRich(doc, field = 'النص') {
  return v.arr(doc, { max: 500, field }).map((raw) => {
    const b = obj(raw);
    const type = pick(b.type, RT_TYPES, 'p');
    const out = { type };
    const align = pick(b.align, ALIGNS, '');
    if (align && align !== 'right') out.align = align;
    if (type === 'ul' || type === 'ol') out.items = v.arr(b.items, { max: 300, field }).map((li) => sanitizeInlines(li, field));
    else out.children = sanitizeInlines(b.children, field);
    return out;
  });
}

function sanitizeBlock(raw, i) {
  const b = obj(raw);
  const f = `القسم رقم ${i + 1}`;
  const type = pick(b.type, BLOCK_TYPES, null);
  if (!type) throw new HttpError(400, `${f}: نوع غير معروف`);
  const base = {
    id: typeof b.id === 'string' && /^[a-z0-9]{4,20}$/i.test(b.id) ? b.id : sec.newId(8),
    type,
    bg: v.color(b.bg, ''),
    pad: pick(b.pad, ['none', 'sm', 'md', 'lg'], 'md'),
    width: pick(b.width, ['narrow', 'normal', 'wide', 'full'], 'normal'),
  };
  const img = (x, name) => v.imageRef(x, { field: `${f} — ${name}` });
  const str = (x, max, name, multiline = false) => v.str(x, { max, field: `${f} — ${name}`, multiline });
  const url = (x, name) => v.safeUrl(x, { field: `${f} — ${name}` });
  const align3 = (x) => pick(x, ['right', 'center', 'left'], 'center');

  switch (type) {
    case 'text':
      return { ...base, doc: sanitizeRich(b.doc, f) };
    case 'image':
      return {
        ...base, src: img(b.src, 'الصورة'), alt: str(b.alt, 150, 'وصف الصورة'), size: int(b.size, 10, 100, 100),
        align: align3(b.align), radius: v.bool(b.radius), shadow: v.bool(b.shadow), link: url(b.link, 'الرابط'), caption: str(b.caption, 200, 'التعليق'),
      };
    case 'imageText':
      return {
        ...base, src: img(b.src, 'الصورة'), alt: str(b.alt, 150, 'وصف الصورة'), imagePos: pick(b.imagePos, ['right', 'left'], 'right'),
        imageSize: pick(Number(b.imageSize), [33, 40, 50, 60], 40), valign: pick(b.valign, ['top', 'center'], 'center'),
        radius: v.bool(b.radius), doc: sanitizeRich(b.doc, f),
      };
    case 'gallery':
      return {
        ...base, images: v.arr(b.images, { max: 40, field: f }).map((x) => img(x, 'صورة')).filter(Boolean),
        cols: pick(Number(b.cols), [2, 3, 4], 3), radius: v.bool(b.radius),
      };
    case 'button':
      return {
        ...base, text: str(b.text, 40, 'نص الزر') || 'اضغط هنا', link: url(b.link, 'رابط الزر'),
        style: pick(b.style, ['primary', 'accent', 'outline'], 'primary'), size: pick(b.size, ['md', 'lg'], 'md'), align: align3(b.align),
      };
    case 'divider':
      return { ...base, style: pick(b.style, ['line', 'ornament', 'space'], 'line'), space: int(b.space, 8, 200, 40) };
    case 'slider':
      return {
        ...base, ratio: pick(b.ratio, ['wide', 'medium', 'tall'], 'wide'),
        slides: v.arr(b.slides, { max: 12, field: f }).map((raw2, j) => {
          const sl = obj(raw2);
          return { image: img(sl.image, `صورة الشريحة ${j + 1}`), link: url(sl.link, `رابط الشريحة ${j + 1}`), alt: str(sl.alt, 100, `وصف الشريحة ${j + 1}`) };
        }).filter((sl) => sl.image),
      };
    case 'hero':
      return {
        ...base, title: str(b.title, 100, 'العنوان الصغير'), highlight: str(b.highlight, 120, 'العنوان الكبير'), text: str(b.text, 600, 'النص', true),
        buttonText: str(b.buttonText, 50, 'نص الزر'), buttonLink: url(b.buttonLink, 'رابط الزر'), image: img(b.image, 'الصورة'),
      };
    case 'products':
      return {
        ...base, categoryId: typeof b.categoryId === 'string' && /^[a-z0-9]{4,20}$/i.test(b.categoryId) ? b.categoryId : '',
        title: str(b.title, 80, 'عنوان القسم'), layout: pick(b.layout, ['row', 'grid'], 'row'),
        sort: pick(b.sort, ['new', 'best', 'price_asc', 'price_desc'], 'new'), limit: int(b.limit, 2, 40, 12), seeAll: v.bool(b.seeAll),
      };
    default: // banner
      return {
        ...base, title: str(b.title, 120, 'العنوان'), text: str(b.text, 500, 'النص', true), image: img(b.image, 'صورة الخلفية'),
        color: v.color(b.color, '#ffffff'), overlay: int(b.overlay, 0, 85, 35), align: align3(b.align),
        minHeight: int(b.minHeight, 140, 720, 320), buttonText: str(b.buttonText, 40, 'نص الزر'), buttonLink: url(b.buttonLink, 'رابط الزر'),
      };
  }
}

function sanitizeBlocks(list) {
  return v.arr(list, { max: 80, field: 'أقسام الصفحة' }).map(sanitizeBlock);
}

// رابط الصفحة: حروف عربية أو إنجليزية وأرقام و - فقط (مثال: policy-and-terms)
function slugify(s) {
  return v.toLatinDigits(String(s || '')).toLowerCase().trim()
    .replace(/&/g, '-and-')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9ء-ي-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function validSlug(s) {
  const x = slugify(s);
  if (!x) throw new HttpError(400, 'رابط الصفحة غير صالح — استخدم حروف وأرقام و - فقط (مثال: policy-and-terms)');
  return x;
}

// الصور المستخدمة في صفحة (لمكتبة الصور)
function pageImages(p) {
  const out = [];
  for (const b of p.blocks || []) {
    if (b.src) out.push(b.src);
    if (b.image) out.push(b.image);
    if (Array.isArray(b.images)) out.push(...b.images);
    if (Array.isArray(b.slides)) out.push(...b.slides.map((sl) => sl.image));
  }
  return out;
}

function removeImage(p, url) {
  for (const b of p.blocks || []) {
    if (b.src === url) b.src = '';
    if (b.image === url) b.image = '';
    if (Array.isArray(b.images)) b.images = b.images.filter((u) => u !== url);
    if (Array.isArray(b.slides)) b.slides = b.slides.filter((sl) => sl.image !== url);
  }
}

const publicPage = (p) => ({ title: p.title, slug: p.slug, showTitle: p.showTitle, description: p.description || '', blocks: p.blocks });

// ---------------- قوالب جاهزة ----------------
const T = (text, m = {}) => ({ text, ...m });
const P = (...parts) => ({ type: 'p', children: parts.map((x) => (typeof x === 'string' ? T(x) : x)) });
const H = (n, text, align) => ({ type: `h${n}`, children: [T(text)], ...(align ? { align } : {}) });
const L = (...items) => ({ type: 'ul', items: items.map((x) => [T(x)]) });
const Q = (text) => ({ type: 'blockquote', children: [T(text)] });
const B = (type, props) => ({ id: sec.newId(8), type, bg: '', pad: 'md', width: 'normal', ...props });

const TEMPLATES = {
  blank: {
    label: 'صفحة فارغة',
    make: () => ({ title: 'صفحة جديدة', blocks: [B('text', { doc: [H(2, 'عنوان الصفحة'), P('اكتب محتوى الصفحة هنا…')] })] }),
  },
  about: {
    label: 'من نحن',
    make: (name) => ({
      title: 'من نحن',
      slug: 'about',
      showTitle: false,
      blocks: [
        B('banner', { width: 'wide', title: 'من نحن', text: `تعرّف على ${name} وقصتنا`, image: '', color: '#ffffff', overlay: 0, align: 'center', minHeight: 260, buttonText: '', buttonLink: '' }),
        B('imageText', {
          src: '/img/logo.png', alt: name, imagePos: 'right', imageSize: 40, valign: 'center', radius: true,
          doc: [H(3, 'قصتنا'), P(`${name} متجر يقدّم لك منتجات مختارة بعناية تجمع بين الجودة والأصالة.`), P('نهتم بكل تفصيلة، من اختيار المنتج إلى تغليفه وتوصيله، عشان توصلك تجربة تليق فيك.')],
        }),
        B('divider', { style: 'ornament', space: 40 }),
        B('text', { width: 'narrow', doc: [H(3, 'ليش تختارنا؟', 'center'), L('منتجات مختارة بعناية وجودة عالية', 'تغليف أنيق يناسب الإهداء', 'دفع آمن ومتابعة لطلبك خطوة بخطوة', 'خدمة عملاء تهتم فيك قبل وبعد الشراء')] }),
        B('button', { text: 'تصفح المنتجات', link: '/', style: 'primary', size: 'lg', align: 'center' }),
      ],
    }),
  },
  terms: {
    label: 'الشروط والأحكام',
    make: (name) => ({
      title: 'الشروط والأحكام',
      slug: 'terms',
      blocks: [B('text', {
        width: 'narrow',
        doc: [
          H(3, 'مقدمة'), P(`باستخدامك لموقع ${name} أو إتمامك لأي طلب، فإنك توافق على الشروط والأحكام التالية. نرجو قراءتها بعناية.`),
          H(3, 'الطلبات والأسعار'), L('جميع الأسعار المعروضة بالريال السعودي.', 'يتم تأكيد الطلب بعد استلام الدفع ومراجعته.', 'يحق للمتجر إلغاء الطلب في حال عدم توفر المنتج، مع إعادة المبلغ كاملاً.'),
          H(3, 'الدفع'), P('الدفع عن طريق التحويل البنكي على الحساب الموضح عند إتمام الطلب، مع كتابة رقم الطلب في ملاحظة التحويل.'),
          H(3, 'الشحن والتوصيل'), P('يتم تجهيز الطلب وشحنه بعد تأكيد الدفع، وتختلف مدة التوصيل حسب المدينة.'),
          H(3, 'الاسترجاع والاستبدال'), P(T('تفاصيل الاسترجاع والاستبدال موضحة في صفحة '), T('سياسة الاسترجاع والاستبدال', { href: '/page/returns' }), T('.')),
          H(3, 'الخصوصية'), P('نستخدم بياناتك (الاسم، الإيميل، رقم الجوال) لإتمام طلباتك والتواصل معك فقط، ولا نشاركها مع أي طرف آخر إلا بالقدر اللازم لتنفيذ الطلب.'),
          H(3, 'التواصل'), P('لأي استفسار تواصل معنا عبر وسائل التواصل الموضحة أسفل الموقع.'),
        ],
      })],
    }),
  },
  returns: {
    label: 'سياسة الاسترجاع والاستبدال',
    make: () => ({
      title: 'سياسة الاسترجاع والاستبدال',
      slug: 'returns',
      blocks: [B('text', {
        width: 'narrow',
        doc: [
          P('نحرص على رضاك التام، وإذا ما كان المنتج مناسب لك تقدر تطلب الاسترجاع أو الاستبدال حسب الشروط التالية:'),
          H(3, 'مدة الاسترجاع'), P('خلال 7 أيام من تاريخ استلام الطلب.'),
          H(3, 'شروط الاسترجاع'), L('أن يكون المنتج بحالته الأصلية وغير مستخدم.', 'أن يكون في تغليفه الأصلي مع جميع ملحقاته.', 'ذكر رقم الطلب عند التواصل معنا.'),
          H(3, 'حالات لا يشملها الاسترجاع'), L('المنتجات المصنوعة أو المعدّلة حسب طلب العميل.', 'المنتجات المستخدمة أو التالفة بسبب سوء الاستخدام.'),
          H(3, 'استرداد المبلغ'), P('يُعاد المبلغ بنفس طريقة الدفع بعد استلام المنتج المرتجع وفحصه.'),
          Q('لطلب الاسترجاع أو الاستبدال تواصل معنا عبر وسائل التواصل الموضحة أسفل الموقع.'),
        ],
      })],
    }),
  },
  faq: {
    label: 'الأسئلة الشائعة',
    make: () => ({
      title: 'الأسئلة الشائعة',
      slug: 'faq',
      blocks: [B('text', {
        width: 'narrow',
        doc: [
          H(3, 'كيف أطلب؟'), P('اختر المنتج وأضفه للسلة، وبعدها اضغط "إتمام الطلب" وسجّل دخولك.'),
          H(3, 'وش طرق الدفع المتوفرة؟'), P('التحويل البنكي — بتظهر لك بيانات الحساب بعد تأكيد الطلب.'),
          H(3, 'كم يستغرق التوصيل؟'), P('تختلف المدة حسب مدينتك، ونبلغك بحالة الطلب أول بأول.'),
          H(3, 'كيف أتابع طلبي؟'), P(T('من صفحة '), T('طلباتي', { href: '/account' }), T(' تقدر تشوف حالة كل طلب.')),
          H(3, 'عندي سؤال ثاني؟'), P('تواصل معنا وبنرد عليك بأسرع وقت.'),
        ],
      })],
    }),
  },
};

const templateList = () => Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label }));

function makePage(key, storeName, extra = {}) {
  const tpl = (TEMPLATES[key] || TEMPLATES.blank).make(storeName || 'متجرنا');
  const now = Date.now();
  return {
    id: sec.newId(),
    title: tpl.title,
    slug: tpl.slug || '',
    visible: false,
    showInFooter: true,
    showTitle: tpl.showTitle !== false,
    description: '',
    blocks: tpl.blocks,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

// قسم منتجات لقائمة معيّنة (يستخدم بالرئيسية)
const productsBlock = (c) => B('products', { width: 'wide', categoryId: c.id, title: '', layout: 'row', sort: 'new', limit: 12, seeAll: true });

// الصفحة الرئيسية: تنبني من الإعدادات القديمة (البنرات + الواجهة الترحيبية + أقسام المنتجات)
function makeHomePage(settings, categories) {
  const s = settings || {};
  const blocks = [];
  if (Array.isArray(s.banners) && s.banners.length) {
    blocks.push(B('slider', { width: 'wide', pad: 'none', ratio: 'wide', slides: s.banners.map((x) => ({ image: x.image, link: x.link || '', alt: x.alt || '' })) }));
  }
  if (!s.hero || s.hero.enabled !== false) {
    const h = s.hero || {};
    blocks.push(B('hero', {
      width: 'wide', pad: 'sm', title: h.title || '', highlight: h.highlight || '', text: h.text || '',
      buttonText: h.buttonText || '', buttonLink: h.buttonLink || '#products', image: h.image || '',
    }));
  }
  for (const c of [...(categories || [])].sort((a, b) => a.order - b.order)) {
    if (c.visible !== false && c.showOnHome !== false) blocks.push(productsBlock(c));
  }
  // ما فيه قوائم بالرئيسية؟ نعرض كل المنتجات عشان الرئيسية ما تطلع فاضية
  if (!blocks.some((b) => b.type === 'products')) {
    blocks.push(B('products', { width: 'wide', categoryId: '', title: 'منتجاتنا', layout: 'grid', sort: 'new', limit: 12, seeAll: false }));
  }
  const now = Date.now();
  return {
    id: sec.newId(), title: 'الصفحة الرئيسية', slug: 'home', isHome: true, visible: true, showInFooter: false,
    showTitle: false, description: '', blocks, createdAt: now, updatedAt: now,
  };
}

// صفحات أول تشغيل (مخفية لين تراجعها وتنشرها)
const defaultPages = (storeName) => ['about', 'terms', 'returns'].map((k) => makePage(k, storeName));

module.exports = {
  sanitizeBlocks, sanitizeRich, slugify, validSlug, pageImages, removeImage, publicPage,
  TEMPLATES, templateList, makePage, defaultPages, makeHomePage, productsBlock,
};
