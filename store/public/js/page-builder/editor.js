'use strict';
// محرر الصفحات — المحرر نفسه

async function pageBuilder(el, ctx, id) {
  const { page, theme, categories, products } = await aapi('GET', `/api/admin/pages/${encodeURIComponent(id)}`);
  if (ctx.stale()) return;
  PB_CTX.categories = categories || [];
  PB_CTX.products = products || [];
  PB_CTX.currency = theme.currency || 'ر.س';
  const P = JSON.parse(JSON.stringify(page));
  const isHome = Boolean(P.isHome);
  let sel = null;
  let dirty = false;
  let savedRange = null;
  let activeRt = null;
  A.dirtyGuard = () => dirty;
  el.classList.add('wide');
  const layout = $('.layout');
  if (layout) layout.classList.add('builder');
  $('#pageTitle').textContent = isHome ? 'تعديل الصفحة الرئيسية' : 'تعديل الصفحة';
  document.title = `${isHome ? 'الصفحة الرئيسية' : P.title} | تعديل الصفحة`;

  el.innerHTML = `<div class="pb">
    <div class="pb-top card">
      <a class="btn btn-ghost btn-sm" href="/admin/pages">${icon('chevR', 'i-sm')}كل الصفحات</a>
      ${isHome ? `<strong class="pb-home-title">${icon('home', 'i-sm')}الصفحة الرئيسية</strong>` : `<input class="input pb-title-in" data-f="title" value="${esc(P.title)}" maxlength="80" aria-label="عنوان الصفحة">
      <label class="pb-slug" title="رابط الصفحة"><span class="ltr">/page/</span><input class="input ltr" data-f="slug" value="${esc(P.slug)}" maxlength="60" aria-label="رابط الصفحة"></label>`}
      <div class="seg pb-device" role="group" aria-label="المعاينة">
        <label title="كمبيوتر"><input type="radio" name="pbdev" value="desktop" checked>${icon('monitor', 'i-sm')}<span class="sr">كمبيوتر</span></label>
        <label title="جوال"><input type="radio" name="pbdev" value="mobile">${icon('smartphone', 'i-sm')}<span class="sr">جوال</span></label>
      </div>
      ${isHome ? '' : `<label class="switch"><input type="checkbox" data-f="visible"${P.visible ? ' checked' : ''}><span class="track"></span><span>ظاهرة للعملاء</span></label>`}
      <span class="spacer"></span>
      <span class="dirty small" data-dirty hidden>تغييرات ما انحفظت</span>
      <a class="btn btn-outline btn-sm" data-view target="_blank" rel="noopener">${icon('eye', 'i-sm')}معاينة</a>
      <button class="btn btn-primary" data-save>${icon('check', 'i-sm')}حفظ</button>
    </div>
    <div class="pb-main">
      <div class="pb-stage">
        <div class="pb-rtbar card" data-rtbar>${rtToolbarHtml()}</div>
        <div class="pb-canvas-wrap"><div class="pb-canvas pg-theme" data-canvas></div></div>
      </div>
      <aside class="pb-panel card" data-panel></aside>
    </div>
  </div>`;

  const canvas = $('[data-canvas]', el);
  const panel = $('[data-panel]', el);
  const rtbar = $('[data-rtbar]', el);
  const viewLink = $('[data-view]', el);
  const accent = theme.accentColor || '#a8844a';
  canvas.style.setProperty('--primary', theme.primaryColor);
  canvas.style.setProperty('--on-primary', inkFor(theme.primaryColor));
  canvas.style.setProperty('--accent', accent);
  canvas.style.setProperty('--on-accent', inkFor(accent));

  const idxOf = (bid) => P.blocks.findIndex((b) => b.id === bid);
  const blockOf = (bid) => P.blocks[idxOf(bid)];
  const markDirty = () => { dirty = true; $('[data-dirty]', el).hidden = false; };
  const updateViewLink = () => { viewLink.href = isHome ? '/' : `/page/${encodeURIComponent(P.slug)}?preview=1`; };
  updateViewLink();

  // ---------- مزامنة النصوص المكتوبة مع البيانات ----------
  const syncRt = (rtEl) => {
    const eb = rtEl.closest('.eb');
    const b = eb && blockOf(eb.dataset.id);
    if (b) b.doc = htmlToRich(rtEl);
  };
  const flush = () => $$('[data-rt]', canvas).forEach(syncRt);
  const syncLater = debounce(syncRt, 250);

  // ---------- العرض ----------
  const insertHtml = (i) => `<div class="pb-ins"><button type="button" data-insert="${i}" title="إضافة قسم هنا" aria-label="إضافة قسم هنا">${icon('plus', 'i-sm')}</button></div>`;
  const shell = (b, i) => `<div class="eb${b.id === sel ? ' sel' : ''}" data-id="${esc(b.id)}">
      <div class="eb-tools">
        <span class="eb-name">${icon(PB_ICON[b.type], 'i-sm')}${esc(PB_LABEL[b.type] || '')}</span>
        <button type="button" class="eb-drag" data-drag draggable="true" title="اسحب لتغيير المكان" aria-label="سحب">${icon('grip', 'i-sm')}</button>
        <button type="button" data-act="up" title="لفوق" aria-label="لفوق"${i === 0 ? ' disabled' : ''}>${icon('up', 'i-sm')}</button>
        <button type="button" data-act="down" title="لتحت" aria-label="لتحت"${i === P.blocks.length - 1 ? ' disabled' : ''}>${icon('down', 'i-sm')}</button>
        <button type="button" data-act="dup" title="تكرار" aria-label="تكرار">${icon('copy', 'i-sm')}</button>
        <button type="button" data-act="del" class="danger" title="حذف" aria-label="حذف">${icon('trash', 'i-sm')}</button>
      </div>
      ${pageBlockHtml(b, { editing: true, products: b.type === 'products' ? { [b.id]: pbProducts(b) } : {}, card: pbCard })}
    </div>`;

  const renderCanvas = () => {
    canvas.innerHTML = `${P.showTitle ? `<h1 class="pg-title">${esc(P.title)}</h1>${P.description ? `<p class="pg-desc">${esc(P.description)}</p>` : ''}` : ''}
      ${P.blocks.map((b, i) => insertHtml(i) + shell(b, i)).join('')}
      <div class="pb-add-end"><button type="button" class="btn btn-outline" data-insert="${P.blocks.length}">${icon('plus')}إضافة قسم</button></div>`;
    applyDataStyles(canvas);
  };

  const rerenderBlock = (bid) => {
    const i = idxOf(bid);
    const old = $(`.eb[data-id="${CSS.escape(bid)}"]`, canvas);
    if (i < 0 || !old) { renderCanvas(); return; }
    const tmp = document.createElement('div');
    tmp.innerHTML = shell(P.blocks[i], i);
    const fresh = tmp.firstElementChild;
    old.replaceWith(fresh);
    applyDataStyles(fresh);
  };

  // ---------- لوحة الإعدادات ----------
  const ALIGN3 = [['right', 'يمين', 'alignRight'], ['center', 'وسط', 'alignCenter'], ['left', 'يسار', 'alignLeft']];
  const seg = (key, opts, cur) => `<div class="seg pp-seg">${opts.map(([val, label, ic]) => `<label title="${esc(label)}"><input type="radio" name="pp-${key}" data-p="${key}" value="${esc(val)}"${String(cur) === String(val) ? ' checked' : ''}>${ic ? `${icon(ic, 'i-sm')}<span class="sr">${esc(label)}</span>` : esc(label)}</label>`).join('')}</div>`;
  const range = (key, min, max, step, cur, unit) => `<div class="pp-range"><input type="range" min="${min}" max="${max}" step="${step}" value="${cur}" data-p="${key}" data-num data-unit="${unit}" aria-label="${key}"><output>${cur}${unit}</output></div>`;
  const colorRow = (key, cur, allowNone) => `<div class="color-field"><input type="color" value="${esc(cur || '#ffffff')}" data-p="${key}" aria-label="اللون">
    ${allowNone ? `<button type="button" class="btn btn-ghost btn-sm" data-clear-p="${key}"${cur ? '' : ' disabled'}>${cur ? 'إزالة اللون' : 'بدون لون'}</button>` : ''}</div>`;
  const textIn = (key, label, cur, o = {}) => `<label class="field"><span>${label}</span><input class="input" data-p="${key}" value="${esc(cur || '')}" maxlength="${o.max || 200}"${o.dir ? ` dir="${o.dir}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}></label>`;
  const check = (key, label, cur) => `<label class="switch"><input type="checkbox" data-p="${key}"${cur ? ' checked' : ''}><span class="track"></span><span>${label}</span></label>`;
  const imgField = (key, cur, label) => `<div class="field"><span>${label}</span><div class="image-field">
    ${cur ? `<img class="preview-img" src="${esc(cur)}" alt="">` : `<div class="preview-img empty">${icon('image')}</div>`}
    <div class="row wrap"><button type="button" class="btn btn-outline btn-sm" data-pick-p="${key}">${icon('upload', 'i-sm')}${cur ? 'تغيير' : 'اختيار'}</button>
    ${cur ? `<button type="button" class="btn btn-danger-ghost btn-sm" data-clear-p="${key}">إزالة</button>` : ''}</div></div></div>`;
  const typesGrid = () => `<div class="pp-types">${PB_TYPES.map(([k, l, ic, d]) => `<button type="button" class="pp-type" data-add="${k}"><span class="pp-type-ic">${icon(ic)}</span><span><strong>${l}</strong><small>${d}</small></span></button>`).join('')}</div>`;

  const pagePanelHtml = () => `<div class="pp">
      ${isHome ? `<h3 class="pp-title">${icon('home', 'i-sm')}الصفحة الرئيسية</h3>
      <p class="hint">رتّب الرئيسية مثل ما تبي: بنرات متحركة، واجهة ترحيبية، أقسام منتجات، نصوص وصور. أقسام المنتجات تتحدث تلقائياً لما تضيف منتجات.</p>`
        : `<h3 class="pp-title">${icon('file', 'i-sm')}إعدادات الصفحة</h3>
      <label class="switch"><input type="checkbox" data-pf="showTitle"${P.showTitle ? ' checked' : ''}><span class="track"></span><span>إظهار عنوان الصفحة فوق</span></label>
      <label class="switch"><input type="checkbox" data-pf="showInFooter"${P.showInFooter ? ' checked' : ''}><span class="track"></span><span>رابط الصفحة في فوتر المتجر</span></label>
      <label class="field"><span>وصف قصير <span class="muted">(اختياري)</span></span><textarea class="textarea" rows="2" maxlength="200" data-pf="description">${esc(P.description)}</textarea><small>يظهر تحت عنوان الصفحة</small></label>`}
      <hr class="sep">
      <h3 class="pp-title">${icon('plus', 'i-sm')}أضف قسم للصفحة</h3>
      ${typesGrid()}
      <p class="hint">اضغط على أي قسم في الصفحة عشان تعدّل إعداداته هنا، واسحبه من ${icon('grip', 'i-sm')} عشان تغيّر مكانه.</p>
    </div>`;

  const blockPanelHtml = (b) => {
    let h = '';
    switch (b.type) {
      case 'slider':
        h = `<div class="field"><span>الصور (${b.slides.length})</span>
            <div class="pp-slides">${b.slides.map((sl, i) => `<div class="pp-slide"><img src="${esc(sl.image)}" alt="">
              <input class="input" data-slide="${i}" value="${esc(sl.link)}" placeholder="رابط عند الضغط (اختياري)" dir="ltr" maxlength="500" aria-label="رابط الشريحة ${i + 1}">
              <div class="row"><button type="button" class="btn btn-ghost btn-icon btn-sm" data-slide-mv="${i}" data-d="-1" aria-label="لفوق"${i ? '' : ' disabled'}>${icon('up', 'i-sm')}</button>
                <button type="button" class="btn btn-ghost btn-icon btn-sm" data-slide-mv="${i}" data-d="1" aria-label="لتحت"${i === b.slides.length - 1 ? ' disabled' : ''}>${icon('down', 'i-sm')}</button>
                <button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-slide-rm="${i}" aria-label="حذف">${icon('trash', 'i-sm')}</button></div></div>`).join('')}</div>
            ${b.slides.length < 12 ? `<button type="button" class="btn btn-outline btn-block" data-slides-add>${icon('plus', 'i-sm')}إضافة صور</button>` : ''}</div>
          <div class="field"><span>ارتفاع البنر</span>${seg('ratio', [['wide', 'عريض'], ['medium', 'متوسط'], ['tall', 'عالي']], b.ratio)}</div>
          <p class="hint">المقاس المناسب للصور تقريباً 1600×550 بكسل. الصور تتبدل كل 5 ثواني.</p>`;
        break;
      case 'hero':
        h = `<p class="hint">اكتب العنوان الصغير والعنوان الكبير والنص مباشرة على الواجهة في الصفحة.</p>
          ${imgField('image', b.image, 'الصورة الجانبية')}
          ${textIn('buttonText', 'نص الزر', b.buttonText, { max: 50 })}
          ${textIn('buttonLink', 'رابط الزر', b.buttonLink, { dir: 'ltr', ph: '#products أو /category/...', max: 500 })}`;
        break;
      case 'products':
        h = `<label class="field"><span>القائمة</span><select class="select" data-p="categoryId">
            <option value=""${b.categoryId ? '' : ' selected'}>كل المنتجات</option>
            ${PB_CTX.categories.map((c) => `<option value="${esc(c.id)}"${c.id === b.categoryId ? ' selected' : ''}>${esc(c.name)}${c.visible ? '' : ' (مخفية)'}</option>`).join('')}
          </select></label>
          ${textIn('title', 'العنوان', b.title, { max: 80, ph: 'اسم القائمة تلقائياً' })}
          <div class="field"><span>طريقة العرض</span>${seg('layout', [['row', 'صف يتمرر'], ['grid', 'شبكة']], b.layout)}</div>
          <div class="field"><span>الترتيب</span>${seg('sort', [['new', 'الأحدث'], ['best', 'الأكثر مبيعاً'], ['price_asc', 'الأرخص'], ['price_desc', 'الأغلى']], b.sort)}</div>
          <div class="field"><span>عدد المنتجات</span>${range('limit', 2, 40, 1, b.limit, '')}</div>
          ${check('seeAll', 'زر «عرض الكل»', b.seeAll)}
          <p class="hint">المنتجات تتحدث تلقائياً — أي منتج تضيفه للقائمة يظهر هنا.</p>`;
        break;
      case 'text':
        h = '<p class="hint">اكتب مباشرة في الصفحة، واستخدم شريط التنسيق فوق: عناوين، عريض، ألوان، محاذاة، قوائم، روابط — مثل الوورد.</p>';
        break;
      case 'image':
        h = `${imgField('src', b.src, 'الصورة')}
          <div class="field"><span>الحجم</span>${range('size', 10, 100, 5, b.size, '%')}<small>أو اسحب الزاوية الصغيرة على الصورة</small></div>
          <div class="field"><span>المكان</span>${seg('align', ALIGN3, b.align)}</div>
          ${check('radius', 'زوايا دائرية', b.radius)}${check('shadow', 'ظل', b.shadow)}
          ${textIn('caption', 'تعليق تحت الصورة', b.caption)}
          ${textIn('link', 'رابط عند الضغط على الصورة', b.link, { dir: 'ltr', ph: '/category/... أو https://...', max: 500 })}
          ${textIn('alt', 'وصف الصورة (لمحركات البحث)', b.alt, { max: 150 })}`;
        break;
      case 'imageText':
        h = `${imgField('src', b.src, 'الصورة')}
          <div class="field"><span>مكان الصورة</span>${seg('imagePos', [['right', 'يمين'], ['left', 'يسار']], b.imagePos)}</div>
          <div class="field"><span>مساحة الصورة</span>${seg('imageSize', [[33, 'ثلث'], [40, '٤٠٪'], [50, 'نص'], [60, '٦٠٪']], b.imageSize)}</div>
          <div class="field"><span>مكان النص</span>${seg('valign', [['top', 'فوق'], ['center', 'بالوسط']], b.valign)}</div>
          ${check('radius', 'زوايا دائرية للصورة', b.radius)}
          <p class="hint">النص تكتبه مباشرة جنب الصورة في الصفحة.</p>`;
        break;
      case 'gallery':
        h = `<div class="field"><span>عدد الأعمدة</span>${seg('cols', [[2, '٢'], [3, '٣'], [4, '٤']], b.cols)}</div>
          ${check('radius', 'زوايا دائرية', b.radius)}
          <button type="button" class="btn btn-outline btn-block" data-gal-add>${icon('plus', 'i-sm')}إضافة صور</button>
          <p class="hint">${b.images.length} صورة — تحذف أي صورة من علامة × عليها.</p>`;
        break;
      case 'button':
        h = `${textIn('text', 'نص الزر', b.text, { max: 40 })}
          ${textIn('link', 'الرابط', b.link, { dir: 'ltr', ph: '/ أو https://...', max: 500 })}
          <div class="field"><span>الشكل</span>${seg('style', [['primary', 'أساسي'], ['accent', 'ذهبي'], ['outline', 'إطار']], b.style)}</div>
          <div class="field"><span>الحجم</span>${seg('size', [['md', 'عادي'], ['lg', 'كبير']], b.size)}</div>
          <div class="field"><span>المكان</span>${seg('align', ALIGN3, b.align)}</div>`;
        break;
      case 'divider':
        h = `<div class="field"><span>الشكل</span>${seg('style', [['ornament', 'زخرفة'], ['line', 'خط'], ['space', 'مسافة']], b.style)}</div>
          <div class="field"><span>الارتفاع</span>${range('space', 8, 200, 4, b.space, 'px')}</div>`;
        break;
      default: // banner
        h = `<p class="hint">اكتب العنوان والنص مباشرة على البانر.</p>
          ${imgField('image', b.image, 'صورة الخلفية')}
          ${b.image ? `<div class="field"><span>تعتيم الصورة</span>${range('overlay', 0, 85, 5, b.overlay, '%')}</div>` : ''}
          <div class="field"><span>لون النص</span>${colorRow('color', b.color)}</div>
          <div class="field"><span>مكان النص</span>${seg('align', ALIGN3, b.align)}</div>
          <div class="field"><span>الارتفاع</span>${range('minHeight', 140, 720, 10, b.minHeight, 'px')}</div>
          ${textIn('buttonText', 'نص الزر (اختياري)', b.buttonText, { max: 40 })}
          ${textIn('buttonLink', 'رابط الزر', b.buttonLink, { dir: 'ltr', ph: '/', max: 500 })}`;
    }
    return `<div class="pp">
      <div class="pp-head"><h3 class="pp-title">${icon(PB_ICON[b.type], 'i-sm')}${esc(PB_LABEL[b.type])}</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-deselect>${icon('x', 'i-sm')}تم</button></div>
      ${h}
      <hr class="sep">
      <h4 class="pp-sub">مظهر القسم</h4>
      <div class="field"><span>لون الخلفية</span>${colorRow('bg', b.bg, true)}</div>
      <div class="field"><span>المسافة فوق وتحت</span>${seg('pad', [['none', 'بدون'], ['sm', 'صغيرة'], ['md', 'متوسطة'], ['lg', 'كبيرة']], b.pad)}</div>
      <div class="field"><span>عرض المحتوى</span>${seg('width', [['narrow', 'ضيق'], ['normal', 'عادي'], ['wide', 'عريض'], ['full', 'كامل']], b.width)}</div>
    </div>`;
  };

  const renderPanel = () => {
    const b = blockOf(sel);
    panel.innerHTML = b ? blockPanelHtml(b) : pagePanelHtml();
  };

  const select = (bid) => {
    if (sel === bid) return;
    sel = bid;
    $$('.eb', canvas).forEach((x) => x.classList.toggle('sel', x.dataset.id === bid));
    renderPanel();
  };

  // ---------- عمليات الأقسام ----------
  const addBlock = (type, at) => {
    flush();
    const b = newPageBlock(type);
    P.blocks.splice(at, 0, b);
    sel = b.id;
    markDirty();
    renderCanvas();
    renderPanel();
    const node = $(`.eb[data-id="${CSS.escape(b.id)}"]`, canvas);
    if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (type === 'image' || type === 'imageText') pickInto(b.id, 'src');
    if (type === 'gallery') galleryAdd(b);
    if (type === 'slider') slidesAdd(b);
  };

  const openAddMenu = (at) => {
    const m = openModal({ title: 'إضافة قسم', body: typesGrid() });
    m.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-add]');
      if (!t) return;
      m.close();
      addBlock(t.dataset.add, at);
    });
  };

  const pickInto = async (bid, key) => {
    const urls = await pickImages({ title: 'اختر صورة' });
    const b = blockOf(bid);
    if (!urls || !b) return;
    flush();
    b[key] = urls[0];
    markDirty();
    rerenderBlock(bid);
    renderPanel();
  };

  const galleryAdd = async (b) => {
    const urls = await pickImages({ multiple: true, title: 'صور المعرض' });
    if (!urls) return;
    flush();
    b.images = [...new Set([...b.images, ...urls])].slice(0, 40);
    markDirty();
    rerenderBlock(b.id);
    renderPanel();
  };

  const slidesAdd = async (b) => {
    const urls = await pickImages({ multiple: true, title: 'صور البنر المتحرك' });
    if (!urls) return;
    flush();
    for (const u of urls) if (b.slides.length < 12 && !b.slides.some((x) => x.image === u)) b.slides.push({ image: u, link: '', alt: '' });
    markDirty();
    rerenderBlock(b.id);
    renderPanel();
  };

  const blockAction = async (act, bid) => {
    flush();
    const i = idxOf(bid);
    if (i < 0) return;
    if (act === 'up' && i > 0) [P.blocks[i - 1], P.blocks[i]] = [P.blocks[i], P.blocks[i - 1]];
    else if (act === 'down' && i < P.blocks.length - 1) [P.blocks[i + 1], P.blocks[i]] = [P.blocks[i], P.blocks[i + 1]];
    else if (act === 'dup') {
      const c = JSON.parse(JSON.stringify(P.blocks[i]));
      c.id = pbId();
      P.blocks.splice(i + 1, 0, c);
      sel = c.id;
    } else if (act === 'del') {
      if (!(await confirmDialog(`حذف قسم "${PB_LABEL[P.blocks[i].type]}"؟`, { ok: 'حذف', danger: true }))) return;
      P.blocks.splice(i, 1);
      if (sel === bid) sel = null;
    } else return;
    markDirty();
    renderCanvas();
    renderPanel();
  };

  // ---------- أحداث الصفحة (الكانفس) ----------
  canvas.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('a')) e.preventDefault(); // الروابط داخل المحرر ما تفتح
    const ins = t.closest('[data-insert]');
    if (ins) { openAddMenu(Number(ins.dataset.insert)); return; }
    const eb = t.closest('.eb');
    if (!eb) { select(null); return; }
    const act = t.closest('[data-act]');
    if (act) { blockAction(act.dataset.act, eb.dataset.id); return; }
    select(eb.dataset.id);
    const b = blockOf(eb.dataset.id);
    const pick = t.closest('[data-pick]');
    if (pick) { pickInto(b.id, pick.dataset.pick); return; }
    if (t.closest('[data-gal-add]')) { galleryAdd(b); return; }
    if (t.closest('[data-slides-add]')) { slidesAdd(b); return; }
    const rm = t.closest('[data-gal-rm]');
    if (rm) {
      flush();
      b.images.splice(Number(rm.dataset.galRm), 1);
      markDirty();
      rerenderBlock(b.id);
      renderPanel();
    }
  });

  canvas.addEventListener('input', (e) => {
    const rtEl = e.target.closest('[data-rt]');
    if (rtEl) { materializeStyles(rtEl); markDirty(); syncLater(rtEl); return; }
    const f = e.target.closest('[data-field]');
    if (f) {
      const b = blockOf(f.closest('.eb').dataset.id);
      if (b) { b[f.dataset.field] = f.innerText.replace(/\n+$/, ''); markDirty(); }
    }
  });

  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('[data-single]')) e.preventDefault();
  });

  // اللصق يكون نص بدون تنسيق (عشان ما ينسخ خطوط وألوان غريبة من الوورد والمواقع)
  canvas.addEventListener('paste', (e) => {
    const target = e.target.closest('[data-rt], [data-field]');
    if (!target) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, target.hasAttribute('data-single') ? text.replace(/\s*\n\s*/g, ' ') : text);
  });

  canvas.addEventListener('focusin', (e) => {
    if (e.target.closest('[data-rt]')) {
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* متصفح قديم */ }
    }
  });

  // ---------- السحب لتغيير ترتيب الأقسام ----------
  let dragId = null;
  const dropLine = document.createElement('div');
  dropLine.className = 'pb-drop';
  const dropIndex = (y) => {
    const ebs = $$('.eb', canvas);
    for (let i = 0; i < ebs.length; i++) {
      const r = ebs[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return ebs.length;
  };
  canvas.addEventListener('dragstart', (e) => {
    const h = e.target.closest && e.target.closest('[data-drag]');
    if (!h) return;
    const eb = h.closest('.eb');
    flush();
    dragId = eb.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    try { e.dataTransfer.setDragImage(eb, 40, 20); } catch { /* تجاهل */ }
    eb.classList.add('dragging');
  });
  canvas.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const ebs = $$('.eb', canvas);
    const i = dropIndex(e.clientY);
    if (i < ebs.length) ebs[i].before(dropLine);
    else if (ebs.length) ebs[ebs.length - 1].after(dropLine);
  });
  canvas.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const to = dropIndex(e.clientY);
    const from = idxOf(dragId);
    dragId = null;
    dropLine.remove();
    if (from < 0 || to === from || to === from + 1) { renderCanvas(); return; }
    const [b] = P.blocks.splice(from, 1);
    P.blocks.splice(to > from ? to - 1 : to, 0, b);
    markDirty();
    renderCanvas();
  });
  canvas.addEventListener('dragend', () => {
    dragId = null;
    dropLine.remove();
    $$('.eb.dragging', canvas).forEach((x) => x.classList.remove('dragging'));
  });

  // ---------- تكبير وتصغير الصورة بسحب الزاوية ----------
  canvas.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-resize]');
    if (!h) return;
    e.preventDefault();
    const fig = h.closest('.pg-fig');
    const b = blockOf(h.closest('.eb').dataset.id);
    const cont = fig.parentElement.getBoundingClientRect();
    const start = fig.getBoundingClientRect();
    h.setPointerCapture(e.pointerId);
    fig.classList.add('resizing');
    const move = (ev) => {
      let w;
      if (b.align === 'center') w = (Math.abs(ev.clientX - (start.left + start.width / 2)) * 2) / cont.width;
      else if (b.align === 'left') w = (ev.clientX - start.left) / cont.width;
      else w = (start.right - ev.clientX) / cont.width;
      b.size = Math.min(100, Math.max(10, Math.round(w * 20) * 5));
      fig.style.width = `${b.size}%`;
      fig.dataset.w = b.size;
      const out = $('[data-p=size] + output', panel);
      if (out) { out.textContent = `${b.size}%`; out.previousElementSibling.value = b.size; }
    };
    const up = () => {
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerup', up);
      fig.classList.remove('resizing');
      markDirty();
    };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
  });

  // ---------- شريط التنسيق (مثل الوورد) ----------
  const refreshBar = () => {
    for (const c of ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyCenter', 'justifyLeft', 'justifyFull']) {
      const btn = $(`[data-cmd="${c}"]`, rtbar);
      let on = false;
      try { on = document.queryCommandState(c); } catch { /* تجاهل */ }
      if (btn) btn.classList.toggle('on', on);
    }
    let fb = '';
    try { fb = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch { /* تجاهل */ }
    $('[data-block-style]', rtbar).value = ['h2', 'h3', 'h4', 'blockquote'].includes(fb) ? fb : 'p';
  };
  const onSelChange = () => {
    if (!canvas.isConnected) { document.removeEventListener('selectionchange', onSelChange); return; }
    const s = getSelection();
    if (!s.rangeCount) return;
    const n = s.anchorNode;
    const elx = n && (n.nodeType === 1 ? n : n.parentElement);
    const rtEl = elx && elx.closest('[data-rt]');
    if (rtEl && canvas.contains(rtEl)) {
      savedRange = s.getRangeAt(0).cloneRange();
      activeRt = rtEl;
      rtbar.classList.add('active');
      refreshBar();
    }
  };
  document.addEventListener('selectionchange', onSelChange);

  const restoreSel = () => {
    if (!activeRt || !activeRt.isConnected || !savedRange) return false;
    activeRt.focus({ preventScroll: true });
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(savedRange);
    return true;
  };
  const exec = (cmd, val = null) => {
    if (!restoreSel()) { toast('اضغط داخل النص اللي تبي تنسّقه أول', 'err'); return; }
    try { document.execCommand('styleWithCSS', false, ['foreColor', 'hiliteColor', 'fontSize'].includes(cmd)); } catch { /* تجاهل */ }
    document.execCommand(cmd, false, val);
    materializeStyles(activeRt);
    markDirty();
    syncRt(activeRt);
    refreshBar();
  };

  rtbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  rtbar.addEventListener('click', async (e) => {
    const bt = e.target.closest('[data-cmd]');
    if (!bt) return;
    if (bt.dataset.cmd !== 'link') { exec(bt.dataset.cmd); return; }
    const range = savedRange;
    if (!activeRt || !range) { toast('حدد النص اللي تبي تحوّله لرابط', 'err'); return; }
    if (range.collapsed) { toast('حدد الكلمة أو الجملة اللي تبي تحوّلها لرابط', 'err'); return; }
    const url = await promptLink();
    if (!url) return;
    savedRange = range;
    exec('createLink', url);
  });
  rtbar.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-block-style]')) exec('formatBlock', `<${t.value}>`);
    else if (t.matches('[data-font-size]') && t.value) { exec('fontSize', t.value); t.value = ''; }
    else if (t.matches('[data-color]')) exec(t.dataset.color, t.value);
  });

  // ---------- أحداث لوحة الإعدادات ----------
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.pf) {
      P[t.dataset.pf] = t.type === 'checkbox' ? t.checked : t.value;
      markDirty();
      if (t.dataset.pf !== 'showInFooter') { flush(); renderCanvas(); }
      return;
    }
    const b = blockOf(sel);
    if (t.dataset.slide !== undefined && b && b.slides) {
      b.slides[Number(t.dataset.slide)].link = t.value;
      markDirty();
      return;
    }
    const key = t.dataset.p;
    if (!key || !b) return;
    let val = t.type === 'checkbox' ? t.checked : t.value;
    if (t.hasAttribute('data-num') || key === 'imageSize' || key === 'cols') val = Number(val);
    b[key] = val;
    if (t.type === 'range') t.nextElementSibling.textContent = `${val}${t.dataset.unit || ''}`;
    if (key === 'bg') { const c = $('[data-clear-p=bg]', panel); if (c) { c.disabled = false; c.textContent = 'إزالة اللون'; } }
    markDirty();
    flush();
    rerenderBlock(b.id);
  });
  panel.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-deselect')) { select(null); return; }
    if (t.dataset.add) { addBlock(t.dataset.add, P.blocks.length); return; }
    const b = blockOf(sel);
    if (!b) return;
    if (t.dataset.pickP) pickInto(b.id, t.dataset.pickP);
    else if (t.hasAttribute('data-gal-add')) galleryAdd(b);
    else if (t.hasAttribute('data-slides-add')) slidesAdd(b);
    else if (t.dataset.slideMv !== undefined) {
      const i = Number(t.dataset.slideMv);
      const j = i + Number(t.dataset.d);
      if (j < 0 || j >= b.slides.length) return;
      [b.slides[i], b.slides[j]] = [b.slides[j], b.slides[i]];
      markDirty();
      rerenderBlock(b.id);
      renderPanel();
    } else if (t.dataset.slideRm !== undefined) {
      b.slides.splice(Number(t.dataset.slideRm), 1);
      markDirty();
      rerenderBlock(b.id);
      renderPanel();
    }
    else if (t.dataset.clearP) {
      flush();
      b[t.dataset.clearP] = '';
      markDirty();
      rerenderBlock(b.id);
      renderPanel();
    }
  });

  // ---------- الشريط العلوي ----------
  const top = $('.pb-top', el);
  top.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'title') {
      P.title = e.target.value;
      const h = $('.pg-title', canvas);
      if (h) h.textContent = P.title;
    } else if (f === 'slug') P.slug = e.target.value;
    else if (f === 'visible') P.visible = e.target.checked;
    markDirty();
  });
  const slugIn = $('[data-f=slug]', top);
  if (slugIn) {
    slugIn.addEventListener('blur', (e) => {
      const s = slugifyClient(e.target.value);
      if (s) { e.target.value = s; P.slug = s; }
    });
  }
  top.addEventListener('change', (e) => {
    if (e.target.name === 'pbdev') canvas.closest('.pb-canvas-wrap').classList.toggle('is-mobile', e.target.value === 'mobile');
  });
  viewLink.addEventListener('click', () => {
    if (dirty) toast('المعاينة تعرض آخر نسخة محفوظة — احفظ عشان تشوف تعديلاتك', 'err');
  });

  const save = (btn) => withBusy(btn, async () => {
    flush();
    if (!P.title.trim()) throw new Error('اكتب عنوان الصفحة');
    const r = await aapi('PUT', `/api/admin/pages/${encodeURIComponent(P.id)}`, {
      title: P.title, slug: P.slug, visible: P.visible, showInFooter: P.showInFooter, showTitle: P.showTitle, description: P.description, blocks: P.blocks,
    });
    Object.assign(P, JSON.parse(JSON.stringify(r.page)));
    if (slugIn) slugIn.value = P.slug;
    dirty = false;
    $('[data-dirty]', el).hidden = true;
    updateViewLink();
    if (sel && !blockOf(sel)) sel = null;
    renderCanvas();
    renderPanel();
    toast(isHome ? 'تم حفظ الصفحة الرئيسية' : P.visible ? 'تم الحفظ — الصفحة ظاهرة في المتجر' : 'تم الحفظ — الصفحة مخفية، فعّل "ظاهرة للعملاء" لنشرها');
  });
  $('[data-save]', el).addEventListener('click', (e) => save(e.currentTarget));
  const onKey = (e) => {
    if (!canvas.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save($('[data-save]', el));
    }
  };
  document.addEventListener('keydown', onKey);

  renderCanvas();
  renderPanel();
}
