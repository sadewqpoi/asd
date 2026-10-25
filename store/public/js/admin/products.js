'use strict';
// لوحة التحكم — المنتجات

// =====================================================================
//  المنتجات
// =====================================================================
function openProductEditor(p, categories, onSaved) {
  const isNew = !p;
  const d = p ? JSON.parse(JSON.stringify(p)) : { name: '', shortDesc: '', description: '', price: '', salePrice: null, quantity: null, categoryIds: [], images: [], visible: true };
  const cur = esc(A.store.currency);
  const m = openModal({
    title: isNew ? 'إضافة منتج جديد' : 'تعديل المنتج',
    size: 'lg',
    body: `<form class="stack" novalidate data-form>
      <div class="form-section"><h4>صور المنتج</h4><div class="img-grid" data-imgs></div><p class="hint mt">أول صورة هي الصورة الرئيسية اللي تظهر في المتجر. تقدر تضيف حتى 10 صور.</p></div>
      <label class="field"><span>اسم المنتج *</span><input class="input" name="name" maxlength="120" required value="${esc(d.name)}" placeholder="مثال: حزمة بريميوم"></label>
      <label class="field"><span>وصف مختصر</span><input class="input" name="shortDesc" maxlength="200" value="${esc(d.shortDesc)}"><small>يظهر تحت اسم المنتج في صفحته</small></label>
      <div class="grid-3">
        <label class="field"><span>السعر *</span><div class="input-group"><input class="input" name="price" inputmode="decimal" required value="${esc(d.price)}" placeholder="0"><span class="suffix">${cur}</span></div></label>
        <label class="field"><span>السعر بعد الخصم</span><div class="input-group"><input class="input" name="salePrice" inputmode="decimal" value="${esc(d.salePrice ?? '')}" placeholder="اختياري"><span class="suffix">${cur}</span></div><small data-sale-hint></small></label>
        <label class="field"><span>الكمية المتوفرة</span><input class="input" name="quantity" inputmode="numeric" value="${esc(d.quantity ?? '')}" placeholder="غير محدودة"><small>اتركها فاضية = غير محدودة</small></label>
      </div>
      <div class="form-section"><h4>قوائم المنتجات (الأقسام)</h4>
        ${categories.length ? `<div class="chips-select">${categories.map((c) => `<label><input type="checkbox" name="cat" value="${esc(c.id)}"${d.categoryIds.includes(c.id) ? ' checked' : ''}>${esc(c.name)}</label>`).join('')}</div>`
          : '<p class="hint">ما فيه قوائم منتجات للحين — أضفها من صفحة "قوائم المنتجات".</p>'}
      </div>
      <label class="field"><span>وصف المنتج</span><textarea class="textarea" name="description" maxlength="5000" rows="6" placeholder="اكتب تفاصيل المنتج ومميزاته...">${esc(d.description)}</textarea></label>
      ${sw('visible', d.visible, 'المنتج ظاهر في المتجر')}
      <div class="alert err" data-err hidden></div>
    </form>`,
    foot: `<button class="btn btn-primary" data-save>${isNew ? 'إضافة المنتج' : 'حفظ التغييرات'}</button><button class="btn btn-outline" data-close>إلغاء</button>`,
  });
  const form = $('[data-form]', m.el);
  const imgs = $('[data-imgs]', m.el);
  const renderImgs = () => {
    imgs.innerHTML = `${d.images.map((u, i) => `<div class="img-tile"><img src="${esc(u)}" alt="">${i === 0 ? '<span class="main-tag">الرئيسية</span>' : ''}
        <div class="tile-tools">${i > 0 ? `<button type="button" data-main="${i}" title="اجعلها الرئيسية" aria-label="اجعلها الرئيسية">${icon('star')}</button>` : ''}<button type="button" data-rm="${i}" title="حذف" aria-label="حذف الصورة">${icon('trash')}</button></div></div>`).join('')}
      ${d.images.length < 10 ? `<button type="button" class="add-tile" data-add-img>${icon('plus')}إضافة صور</button>` : ''}`;
  };
  renderImgs();
  imgs.addEventListener('click', async (e) => {
    const main = e.target.closest('[data-main]');
    const rm = e.target.closest('[data-rm]');
    if (main) { const [x] = d.images.splice(Number(main.dataset.main), 1); d.images.unshift(x); renderImgs(); }
    else if (rm) { d.images.splice(Number(rm.dataset.rm), 1); renderImgs(); }
    else if (e.target.closest('[data-add-img]')) {
      const urls = await pickImages({ multiple: true, title: 'صور المنتج' });
      if (urls) { d.images = [...new Set([...d.images, ...urls])].slice(0, 10); renderImgs(); }
    }
  });
  const saleHint = $('[data-sale-hint]', m.el);
  const updateHint = () => {
    const price = Number(toLatinDigits(form.price.value));
    const sale = Number(toLatinDigits(form.salePrice.value));
    saleHint.textContent = form.salePrice.value && price > 0 && sale > 0 && sale < price ? `خصم ${Math.round((1 - sale / price) * 100)}%` : '';
  };
  form.price.addEventListener('input', updateHint);
  form.salePrice.addEventListener('input', updateHint);
  updateHint();
  const err = $('[data-err]', m.el);
  const save = (btn) => withBusy(btn, async () => {
    err.hidden = true;
    const f = formData(form);
    const body = {
      name: f.name,
      shortDesc: f.shortDesc,
      description: f.description,
      price: toLatinDigits(f.price).trim(),
      salePrice: toLatinDigits(f.salePrice).trim(),
      quantity: toLatinDigits(f.quantity).trim(),
      categoryIds: $$('input[name=cat]:checked', form).map((x) => x.value),
      images: d.images,
      visible: f.visible,
    };
    try {
      const r = isNew ? await aapi('POST', '/api/admin/products', body) : await aapi('PUT', `/api/admin/products/${encodeURIComponent(p.id)}`, body);
      toast(isNew ? 'تمت إضافة المنتج' : 'تم حفظ المنتج');
      m.close();
      onSaved(r.product);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest' });
    }
  });
  $('[data-save]', m.el).addEventListener('click', (e) => save(e.currentTarget));
  form.addEventListener('submit', (e) => { e.preventDefault(); save($('[data-save]', m.el)); });
}

async function viewProducts(el, ctx) {
  const [pr, cr] = await Promise.all([aapi('GET', '/api/admin/products'), aapi('GET', '/api/admin/categories')]);
  if (ctx.stale()) return;
  let products = pr.products;
  const categories = cr.categories;
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  let q = '';
  let cat = '';
  el.innerHTML = `<div class="toolbar">
      <div class="search">${icon('search')}<input class="input" placeholder="ابحث عن منتج" data-q></div>
      <select class="select" data-cat aria-label="القسم"><option value="">كل الأقسام</option>${categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-new>${icon('plus')}إضافة منتج</button></div>
    <div class="card" data-list></div>`;
  const list = $('[data-list]', el);
  const stockHtml = (p) => (p.quantity === null ? '<span class="muted">غير محدودة</span>'
    : p.quantity === 0 ? '<span class="badge danger">نفدت</span>'
      : `<span class="num${p.quantity <= 3 ? ' badge warn' : ''}">${p.quantity}</span>`);
  const render = () => {
    const term = q.toLowerCase();
    const rows = products.filter((p) => (!cat || p.categoryIds.includes(cat)) && (!term || p.name.toLowerCase().includes(term)));
    list.innerHTML = rows.length
      ? `<div class="table-wrap"><table class="t"><thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>المبيعات</th><th>ظاهر</th><th></th></tr></thead><tbody>
        ${rows.map((p) => `<tr><td><div class="cell-main">${thumb(p.images[0])}<div><strong>${esc(p.name)}</strong><div class="small muted">${p.categoryIds.map((c) => esc(catName[c] || '')).filter(Boolean).join('، ') || 'بدون قسم'}</div></div></div></td>
          <td class="nowrap">${p.salePrice !== null ? `${money(p.salePrice)}<div class="small muted"><del>${money(p.price)}</del></div>` : money(p.price)}</td>
          <td>${stockHtml(p)}</td><td class="num">${p.sold || 0}</td>
          <td>${sw('vis', p.visible, '', `data-vis="${esc(p.id)}" aria-label="إظهار المنتج"`)}</td>
          <td><div class="actions">
            <a class="btn btn-ghost btn-icon btn-sm" href="/product/${esc(p.id)}" target="_blank" rel="noopener" title="عرض في المتجر" aria-label="عرض في المتجر">${icon('eye', 'i-sm')}</a>
            <button class="btn btn-ghost btn-icon btn-sm" data-edit="${esc(p.id)}" title="تعديل" aria-label="تعديل">${icon('edit', 'i-sm')}</button>
            <button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${esc(p.id)}" title="حذف" aria-label="حذف">${icon('trash', 'i-sm')}</button>
          </div></td></tr>`).join('')}</tbody></table></div>`
      : emptyHtml('box', products.length ? 'ما فيه منتجات مطابقة' : 'ما عندك منتجات للحين', products.length ? '' : 'أضف أول منتج لمتجرك من زر "إضافة منتج"');
  };
  const upsert = (np) => {
    const i = products.findIndex((x) => x.id === np.id);
    if (i >= 0) products[i] = np;
    else products = [np, ...products];
    render();
  };
  const edit = (id) => openProductEditor(id ? products.find((x) => x.id === id) : null, categories, upsert);
  render();
  $('[data-q]', el).addEventListener('input', debounce((e) => { q = e.target.value.trim(); render(); }, 150));
  $('[data-cat]', el).addEventListener('change', (e) => { cat = e.target.value; render(); });
  $('[data-new]', el).addEventListener('click', () => edit(null));
  list.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) edit(ed.dataset.edit);
    if (del) {
      const p = products.find((x) => x.id === del.dataset.del);
      if (!(await confirmDialog(`حذف المنتج "${p.name}"؟ ما تقدر تتراجع عن الحذف. (الطلبات القديمة ما تتأثر)`, { ok: 'حذف', danger: true, title: 'حذف منتج' }))) return;
      withBusy(null, async () => {
        await aapi('DELETE', `/api/admin/products/${encodeURIComponent(p.id)}`);
        products = products.filter((x) => x !== p);
        render();
        toast('تم حذف المنتج');
      });
    }
  });
  list.addEventListener('change', (e) => {
    const v = e.target.closest('[data-vis]');
    if (!v) return;
    withBusy(null, async () => {
      try {
        upsert((await aapi('PUT', `/api/admin/products/${encodeURIComponent(v.dataset.vis)}`, { visible: v.checked })).product);
        toast(v.checked ? 'المنتج صار ظاهر' : 'تم إخفاء المنتج');
      } catch (ex) { v.checked = !v.checked; throw ex; }
    });
  });
  const params = new URLSearchParams(location.search);
  if (params.has('new') || params.has('edit')) {
    history.replaceState(null, '', '/admin/products');
    if (params.has('new')) edit(null);
    else if (products.some((x) => x.id === params.get('edit'))) edit(params.get('edit'));
  }
}
