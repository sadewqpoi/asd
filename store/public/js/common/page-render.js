'use strict';
/* global esc, linkAttrs, icon */
// عرض صفحات المحتوى — مشترك بين المتجر ومحرر الصفحات بلوحة التحكم
// كل نص يمر من esc، والألوان/المقاسات تنحط بعد العرض عبر applyDataStyles (متوافق مع سياسة الأمان CSP)

const PG_HEX = /^#[0-9a-f]{6}$/i;
const PG_IMG = /^\/(uploads|img)\/[A-Za-z0-9_\-./]+$/;

function rtInlineHtml(n) {
  let h = esc(n.text).replace(/\n/g, '<br>');
  if (n.b) h = `<strong>${h}</strong>`;
  if (n.i) h = `<em>${h}</em>`;
  if (n.u) h = `<u>${h}</u>`;
  if (n.s) h = `<s>${h}</s>`;
  if (n.color || n.bg || n.size) {
    h = `<span${n.size ? ` class="sz-${esc(n.size)}"` : ''}${n.color ? ` data-c="${esc(n.color)}"` : ''}${n.bg ? ` data-bg="${esc(n.bg)}"` : ''}>${h}</span>`;
  }
  if (n.href) h = `<a ${linkAttrs(n.href)}>${h}</a>`;
  return h;
}

function richToHtml(doc) {
  return (doc || []).map((b) => {
    const tag = ['p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol'].includes(b.type) ? b.type : 'p';
    const cls = b.align && b.align !== 'right' ? ` class="ta-${esc(b.align)}"` : '';
    if (tag === 'ul' || tag === 'ol') {
      return `<${tag}${cls}>${(b.items || []).map((li) => `<li>${(li || []).map(rtInlineHtml).join('') || '<br>'}</li>`).join('')}</${tag}>`;
    }
    return `<${tag}${cls}>${(b.children || []).map(rtInlineHtml).join('') || '<br>'}</${tag}>`;
  }).join('');
}

function pgImg(src, alt, editing, pickKey) {
  if (src) return `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy">`;
  if (!editing) return '';
  return `<button type="button" class="pg-ph" data-pick="${pickKey}"><span>+ اختر صورة</span></button>`;
}

const pgBtnHtml = (text, link, cls, editing) => `<a class="pg-btn ${cls}"${editing ? '' : ` ${linkAttrs(link || '/')}`}>${esc(text)}</a>`;

// قسم منتجات: صف يتمرر بالأسهم أو شبكة — card = دالة ترسم بطاقة المنتج (المتجر يمرر بطاقته، والمحرر يمرر معاينة)
function productsBlockHtml(b, data, card, editing) {
  const items = (data && data.items) || [];
  if (!items.length && !editing) return '';
  const title = (data && data.title) || b.title || 'منتجاتنا';
  const tools = `${b.seeAll && data && data.link ? `<a class="see-all"${editing ? '' : ` href="${esc(data.link)}"`}>عرض الكل</a>` : ''}
    ${b.layout === 'row' ? `<button class="arrow" type="button" data-dir="-1" aria-label="السابق">${icon('chevR')}</button><button class="arrow" type="button" data-dir="1" aria-label="التالي">${icon('chevL')}</button>` : ''}`;
  const cards = items.map(card).join('');
  return `<div class="psec">
    <div class="psec-head"><h2>${esc(title)}</h2><div class="psec-tools">${tools}</div></div>
    ${items.length ? `<div class="${b.layout === 'grid' ? 'pgrid' : 'prow'}">${cards}</div>` : `<div class="pg-note">${data ? 'ما فيه منتجات ظاهرة في هذي القائمة' : 'القائمة محذوفة أو مخفية — اختر قائمة ثانية من الإعدادات'}</div>`}
  </div>`;
}

// editing = true يضيف أدوات التعديل المباشر (نص قابل للكتابة، مقبض تكبير الصورة...)
function pageBlockHtml(b, { editing = false, products = {}, card = () => '' } = {}) {
  const rt = (doc) => `<div class="rt"${editing ? ' data-rt contenteditable="true" spellcheck="false"' : ''}>${richToHtml(doc)}</div>`;
  const ce = (field, multi) => (editing ? ` contenteditable="plaintext-only" data-field="${field}" spellcheck="false"${multi ? '' : ' data-single'}` : '');
  let inner = '';
  switch (b.type) {
    case 'slider': {
      const slides = b.slides || [];
      if (!slides.length) {
        if (!editing) return '';
        inner = '<button type="button" class="pg-ph" data-slides-add><span>+ أضف صور البنر المتحرك</span></button>';
        break;
      }
      inner = `<div class="pg-slider r-${esc(b.ratio || 'wide')}"${editing ? '' : ' data-slider'}>
        <div class="pg-slider-track">${slides.map((sl) => `<div class="pg-slide">${sl.link && !editing ? `<a ${linkAttrs(sl.link)}>` : ''}<img src="${esc(sl.image)}" alt="${esc(sl.alt || '')}">${sl.link && !editing ? '</a>' : ''}</div>`).join('')}</div>
        ${slides.length > 1 ? `<div class="pg-dots">${slides.map((_, i) => `<button type="button" data-i="${i}" class="${i ? '' : 'on'}" aria-label="بنر ${i + 1}"></button>`).join('')}</div>` : ''}
        ${editing && slides.length > 1 ? `<span class="pg-badge">${slides.length} صور تتبدل تلقائياً</span>` : ''}
      </div>`;
      break;
    }
    case 'hero':
      inner = `<div class="pg-hero">
        <div class="pg-hero-text">
          ${b.title || editing ? `<p class="pg-hero-title"${ce('title')}>${esc(b.title)}</p>` : ''}
          ${b.highlight || editing ? `<h2 class="pg-hero-hl"${ce('highlight')}>${esc(b.highlight)}</h2>` : ''}
          ${b.text || editing ? `<p class="pg-hero-p"${ce('text', true)}>${esc(b.text)}</p>` : ''}
          ${b.buttonText ? `<a class="pg-hero-btn"${editing ? '' : ` ${linkAttrs(b.buttonLink || '#products')}`}>${esc(b.buttonText)}${icon('chevL', 'i-sm')}</a>` : ''}
        </div>
        ${b.image ? `<div class="pg-hero-img"><img src="${esc(b.image)}" alt=""></div>` : editing ? '<button type="button" class="pg-ph pg-hero-ph" data-pick="image"><span>+ صورة</span></button>' : ''}
      </div>`;
      break;
    case 'products':
      inner = productsBlockHtml(b, products[b.id], card, editing);
      if (!inner) return '';
      break;
    case 'text':
      inner = rt(b.doc);
      break;
    case 'image': {
      const img = pgImg(b.src, b.alt, editing, 'src');
      if (!img) return '';
      inner = `<figure class="pg-fig al-${esc(b.align)}${b.radius ? ' rd' : ''}${b.shadow ? ' sh' : ''}" data-w="${Number(b.size) || 100}">
        ${b.link && !editing && b.src ? `<a ${linkAttrs(b.link)}>${img}</a>` : img}
        ${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}
        ${editing && b.src ? '<span class="rs-handle" data-resize title="اسحب لتكبير أو تصغير الصورة"></span>' : ''}
      </figure>`;
      break;
    }
    case 'imageText':
      inner = `<div class="pg-it pos-${esc(b.imagePos)} is-${Number(b.imageSize) || 40} va-${esc(b.valign)}">
        <div class="pg-it-img${b.radius ? ' rd' : ''}">${pgImg(b.src, b.alt, editing, 'src')}</div>
        ${rt(b.doc)}
      </div>`;
      break;
    case 'gallery': {
      const imgs = (b.images || []).map((u, i) => `<div class="pg-gal-item">${pgImg(u, '', false)}${editing ? `<button type="button" class="pg-gal-rm" data-gal-rm="${i}" aria-label="حذف الصورة">×</button>` : ''}</div>`).join('');
      if (!imgs && !editing) return '';
      inner = `<div class="pg-gal cols-${Number(b.cols) || 3}${b.radius ? ' rd' : ''}">${imgs}${editing ? '<button type="button" class="pg-ph pg-gal-add" data-gal-add><span>+ أضف صور</span></button>' : ''}</div>`;
      break;
    }
    case 'button':
      inner = `<div class="pg-btn-wrap al-${esc(b.align)}">${pgBtnHtml(b.text, b.link, `st-${esc(b.style)} sz-${esc(b.size)}`, editing)}</div>`;
      break;
    case 'divider':
      inner = `<div class="pg-div pg-div-${esc(b.style)}" data-minh="${Number(b.space) || 40}"><span></span></div>`;
      break;
    case 'banner': {
      inner =`<div class="pg-banner al-${esc(b.align)}" data-minh="${Number(b.minHeight) || 320}"${b.image ? ` data-bgimg="${esc(b.image)}"` : ''}>
        ${b.image ? `<div class="pg-banner-ov" data-ov="${Number(b.overlay) || 0}"></div>` : ''}
        <div class="pg-banner-c" data-c="${esc(b.color || '#ffffff')}">
          ${b.title || editing ? `<h2${ce('title')}>${esc(b.title)}</h2>` : ''}
          ${b.text || editing ? `<p${ce('text', true)}>${esc(b.text)}</p>` : ''}
          ${b.buttonText ? pgBtnHtml(b.buttonText, b.buttonLink, 'st-light', editing) : ''}
        </div>
      </div>`;
      break;
    }
    default:
      return '';
  }
  const cls = `pgb pgb-${esc(b.type)} pad-${esc(b.pad || 'md')} w-${esc(b.width || 'normal')}${b.bg ? ' has-bg' : ''}`;
  return `<section class="${cls}"${b.bg ? ` data-bg="${esc(b.bg)}"` : ''}><div class="pgb-in">${inner}</div></section>`;
}

// البنرات المتحركة: تتبدل كل 5 ثواني، وتنسحب باللمس في الجوال
function initPageSliders(root) {
  for (const el of root.querySelectorAll('[data-slider]')) {
    const track = el.querySelector('.pg-slider-track');
    const dots = [...el.querySelectorAll('.pg-dots button')];
    const n = track.children.length;
    if (n < 2) continue;
    let i = 0;
    let timer = null;
    const show = (k) => {
      i = (k + n) % n;
      const rtl = getComputedStyle(el).direction === 'rtl';
      track.style.transform = `translateX(${i * (rtl ? 100 : -100)}%)`;
      dots.forEach((d, j) => d.classList.toggle('on', j === i));
    };
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (!document.body.contains(el)) { clearInterval(timer); return; }
        show(i + 1);
      }, 5000);
    };
    dots.forEach((d) => d.addEventListener('click', () => { show(Number(d.dataset.i)); start(); }));
    let x0 = null;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { show(i + (dx > 0 ? 1 : -1)); start(); }
      x0 = null;
    });
    show(0);
    start();
  }
}

// يطبّق الألوان والمقاسات المخزنة في data-* (بدل style داخل الـ HTML)
function applyDataStyles(root) {
  root.querySelectorAll('[data-w]').forEach((el) => { el.style.width = `${Math.min(100, Math.max(10, Number(el.dataset.w) || 100))}%`; });
  root.querySelectorAll('[data-c]').forEach((el) => {
    if (PG_HEX.test(el.dataset.c)) el.style.color = el.dataset.c;
    el.removeAttribute('data-c');
  });
  root.querySelectorAll('[data-bg]').forEach((el) => {
    if (PG_HEX.test(el.dataset.bg)) el.style.backgroundColor = el.dataset.bg;
    el.removeAttribute('data-bg');
  });
  root.querySelectorAll('[data-minh]').forEach((el) => { el.style.minHeight = `${Number(el.dataset.minh) || 0}px`; });
  root.querySelectorAll('[data-bgimg]').forEach((el) => {
    if (PG_IMG.test(el.dataset.bgimg) && !el.dataset.bgimg.includes('..')) el.style.backgroundImage = `url("${el.dataset.bgimg}")`;
  });
  root.querySelectorAll('[data-ov]').forEach((el) => { el.style.opacity = String((Number(el.dataset.ov) || 0) / 100); });
}
