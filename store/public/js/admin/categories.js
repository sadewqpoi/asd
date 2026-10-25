'use strict';
// لوحة التحكم — قوائم المنتجات (الأقسام)

// =====================================================================
//  قوائم المنتجات (الأقسام)
// =====================================================================
function imageFieldHtml(key, url, label = 'الصورة') {
  return `<div class="field"><span>${label}</span><div class="image-field">
    ${url ? `<img class="preview-img" src="${esc(url)}" alt="">` : `<div class="preview-img empty">${icon('image')}</div>`}
    <div class="row wrap"><button type="button" class="btn btn-outline btn-sm" data-pick="${key}">${icon('upload', 'i-sm')}${url ? 'تغيير' : 'اختيار صورة'}</button>
    ${url ? `<button type="button" class="btn btn-danger-ghost btn-sm" data-clear="${key}">إزالة</button>` : ''}</div></div></div>`;
}

function openCategoryEditor(c, onSaved) {
  const isNew = !c;
  const d = c ? { ...c } : { name: '', description: '', image: '', visible: true, showOnHome: true };
  const m = openModal({
    title: isNew ? 'إضافة قائمة منتجات' : 'تعديل القائمة',
    body: `<form class="stack" novalidate data-form>
      <label class="field"><span>اسم القائمة *</span><input class="input" name="name" maxlength="60" required value="${esc(d.name)}" placeholder="مثال: حزم المواطنين"></label>
      <label class="field"><span>وصف <span class="muted">(اختياري)</span></span><input class="input" name="description" maxlength="300" value="${esc(d.description)}"></label>
      <div data-img></div>
      ${sw('showOnHome', d.showOnHome, 'تظهر كقسم في الصفحة الرئيسية')}
      ${sw('visible', d.visible, 'ظاهرة في المتجر')}
      ${isNew ? sw('addToMenu', true, 'أضفها للقائمة الرئيسية بأعلى المتجر') : ''}
      <div class="alert err" data-err hidden></div>
    </form>`,
    foot: `<button class="btn btn-primary" data-save>${isNew ? 'إضافة' : 'حفظ'}</button><button class="btn btn-outline" data-close>إلغاء</button>`,
  });
  const form = $('[data-form]', m.el);
  const imgBox = $('[data-img]', m.el);
  const renderImg = () => { imgBox.innerHTML = imageFieldHtml('image', d.image, 'صورة القائمة (اختياري)'); };
  renderImg();
  imgBox.addEventListener('click', async (e) => {
    if (e.target.closest('[data-pick]')) {
      const u = await pickImages({ title: 'صورة القائمة' });
      if (u) { d.image = u[0]; renderImg(); }
    } else if (e.target.closest('[data-clear]')) { d.image = ''; renderImg(); }
  });
  const err = $('[data-err]', m.el);
  const save = (btn) => withBusy(btn, async () => {
    err.hidden = true;
    const body = { ...formData(form), image: d.image };
    try {
      const r = isNew ? await aapi('POST', '/api/admin/categories', body) : await aapi('PUT', `/api/admin/categories/${encodeURIComponent(c.id)}`, body);
      toast(isNew ? 'تمت إضافة القائمة' : 'تم الحفظ');
      m.close();
      onSaved(r.category);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $('[data-save]', m.el).addEventListener('click', (e) => save(e.currentTarget));
  form.addEventListener('submit', (e) => { e.preventDefault(); save($('[data-save]', m.el)); });
}

async function viewCategories(el, ctx) {
  let { categories } = await aapi('GET', '/api/admin/categories');
  if (ctx.stale()) return;
  el.innerHTML = `<p class="help">قوائم المنتجات هي الأقسام اللي تنظّم فيها منتجاتك (مثل: حزم المواطنين، SPECIAL CAR). كل قائمة تقدر تظهرها كقسم في الصفحة الرئيسية وتضيفها للقائمة العلوية. رتّبها بالأسهم.</p>
    <div class="toolbar"><span class="spacer"></span><button class="btn btn-primary" data-new>${icon('plus')}إضافة قائمة جديدة</button></div>
    <div class="card" data-list></div>`;
  const list = $('[data-list]', el);
  const render = () => {
    list.innerHTML = categories.length
      ? `<div class="table-wrap"><table class="t"><thead><tr><th>الترتيب</th><th>القائمة</th><th>المنتجات</th><th>في الرئيسية</th><th>ظاهرة</th><th></th></tr></thead><tbody>
        ${categories.map((c, i) => `<tr><td><div class="row"><button class="btn btn-ghost btn-icon btn-sm" data-mv="-1" data-i="${i}" aria-label="لأعلى"${i === 0 ? ' disabled' : ''}>${icon('up', 'i-sm')}</button><button class="btn btn-ghost btn-icon btn-sm" data-mv="1" data-i="${i}" aria-label="لأسفل"${i === categories.length - 1 ? ' disabled' : ''}>${icon('down', 'i-sm')}</button></div></td>
          <td><div class="cell-main">${thumb(c.image)}<div><strong>${esc(c.name)}</strong>${c.description ? `<div class="small muted">${esc(c.description)}</div>` : ''}</div></div></td>
          <td class="num">${c.count}</td>
          <td>${sw('home', c.showOnHome, '', `data-toggle="showOnHome" data-id="${esc(c.id)}" aria-label="في الرئيسية"`)}</td>
          <td>${sw('vis', c.visible, '', `data-toggle="visible" data-id="${esc(c.id)}" aria-label="ظاهرة"`)}</td>
          <td><div class="actions">
            <a class="btn btn-ghost btn-icon btn-sm" href="/category/${esc(c.id)}" target="_blank" rel="noopener" aria-label="عرض في المتجر" title="عرض في المتجر">${icon('eye', 'i-sm')}</a>
            <button class="btn btn-ghost btn-icon btn-sm" data-edit="${esc(c.id)}" aria-label="تعديل" title="تعديل">${icon('edit', 'i-sm')}</button>
            <button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${esc(c.id)}" aria-label="حذف" title="حذف">${icon('trash', 'i-sm')}</button></div></td></tr>`).join('')}</tbody></table></div>`
      : emptyHtml('list', 'ما فيه قوائم منتجات', 'أضف أول قائمة عشان ترتب منتجاتك');
  };
  const upsert = (nc) => {
    const i = categories.findIndex((x) => x.id === nc.id);
    if (i >= 0) categories[i] = nc;
    else categories.push(nc);
    render();
  };
  render();
  $('[data-new]', el).addEventListener('click', () => openCategoryEditor(null, upsert));
  list.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-mv]');
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (mv) {
      const i = Number(mv.dataset.i);
      const j = i + Number(mv.dataset.mv);
      if (j < 0 || j >= categories.length) return;
      [categories[i], categories[j]] = [categories[j], categories[i]];
      render();
      withBusy(null, async () => { categories = (await aapi('POST', '/api/admin/categories/reorder', { ids: categories.map((c) => c.id) })).categories; });
    }
    if (ed) openCategoryEditor(categories.find((c) => c.id === ed.dataset.edit), upsert);
    if (del) {
      const c = categories.find((x) => x.id === del.dataset.del);
      if (!(await confirmDialog(`حذف القائمة "${c.name}"؟ المنتجات ما تنحذف — بس تنشال من هذي القائمة.`, { ok: 'حذف', danger: true, title: 'حذف قائمة' }))) return;
      withBusy(null, async () => {
        await aapi('DELETE', `/api/admin/categories/${encodeURIComponent(c.id)}`);
        categories = categories.filter((x) => x !== c);
        render();
        toast('تم حذف القائمة');
      });
    }
  });
  list.addEventListener('change', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    withBusy(null, async () => {
      try {
        upsert((await aapi('PUT', `/api/admin/categories/${encodeURIComponent(t.dataset.id)}`, { [t.dataset.toggle]: t.checked })).category);
        toast('تم الحفظ');
      } catch (ex) { t.checked = !t.checked; throw ex; }
    });
  });
  if (new URLSearchParams(location.search).has('new')) {
    history.replaceState(null, '', '/admin/categories');
    openCategoryEditor(null, upsert);
  }
}
