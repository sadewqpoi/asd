'use strict';
// محرر الصفحات — قائمة الصفحات وإنشاء صفحة جديدة

// =====================================================================
//  قائمة الصفحات
// =====================================================================
async function viewPages(el, ctx) {
  const id = location.pathname.split('/')[3];
  if (id) return pageBuilder(el, ctx, decodeURIComponent(id));
  return pagesList(el, ctx);
}

function openNewPage(templates) {
  const m = openModal({
    title: 'صفحة جديدة',
    size: 'lg',
    body: `<form class="stack" novalidate data-form>
      <div class="field"><span>ابدأ من قالب</span>
        <div class="tpl-grid">${templates.map((t, i) => `<label class="tpl"><input type="radio" name="template" value="${esc(t.key)}"${i === 0 ? ' checked' : ''}>
          <span class="tpl-ic">${icon(TPL_ICONS[t.key] || 'file')}</span><strong>${esc(t.label)}</strong></label>`).join('')}</div></div>
      <div class="grid-2">
        <label class="field"><span>عنوان الصفحة <span class="muted">(اختياري)</span></span><input class="input" name="title" maxlength="80" placeholder="يتعبّى من القالب"></label>
        <label class="field"><span>رابط الصفحة <span class="muted">(اختياري)</span></span>
          <div class="pb-slug"><span class="ltr">/page/</span><input class="input ltr" name="slug" maxlength="60" placeholder="policy-and-terms"></div>
          <small>حروف وأرقام و - فقط</small></label>
      </div>
      <div class="alert err" data-err hidden></div>
    </form>`,
    foot: '<button class="btn btn-primary" data-save>إنشاء الصفحة</button><button class="btn btn-outline" data-close>إلغاء</button>',
  });
  const form = $('[data-form]', m.el);
  const err = $('[data-err]', m.el);
  const create = (btn) => withBusy(btn, async () => {
    err.hidden = true;
    try {
      const r = await aapi('POST', '/api/admin/pages', {
        template: form.querySelector('[name=template]:checked').value,
        title: form.title.value,
        slug: form.slug.value,
      });
      m.close();
      go(`/admin/pages/${r.page.id}`);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  $('[data-save]', m.el).addEventListener('click', (e) => create(e.currentTarget));
  form.addEventListener('submit', (e) => { e.preventDefault(); create($('[data-save]', m.el)); });
}

async function pagesList(el, ctx) {
  const data = await aapi('GET', '/api/admin/pages');
  if (ctx.stale()) return;
  let { pages } = data;
  const { templates } = data;
  el.innerHTML = `<p class="help">الصفحة الرئيسية وصفحات مثل «من نحن» و«الشروط والأحكام». تعدّلها مباشرة مثل الوورد والبوربوينت: نصوص منسّقة، صور، بانرات، أزرار — وتظهر روابطها في فوتر المتجر. الصفحات الجديدة تكون <b>مخفية</b> لين تفعّلها.</p>
    <div class="toolbar"><span class="spacer"></span><button class="btn btn-primary" data-new>${icon('plus')}صفحة جديدة</button></div>
    <div class="card" data-list></div>`;
  const list = $('[data-list]', el);
  const render = () => {
    list.innerHTML = pages.length
      ? `<div class="table-wrap"><table class="t"><thead><tr><th>الصفحة</th><th>الرابط</th><th>ظاهرة</th><th>في الفوتر</th><th>آخر تعديل</th><th></th></tr></thead><tbody>
        ${pages.map((p) => (p.isHome ? `<tr class="home-row">
          <td><a class="cell-main" href="/admin/pages/${esc(p.id)}"><span class="thumb-empty">${icon('home', 'i-sm')}</span><strong>الصفحة الرئيسية</strong><span class="badge primary">الرئيسية</span></a></td>
          <td><span class="ltr small muted">/</span></td>
          <td><span class="badge ok">دائماً ظاهرة</span></td>
          <td class="muted">—</td>
          <td class="small muted nowrap">${fmtDate(p.updatedAt)}</td>
          <td><div class="actions">
            <a class="btn btn-ghost btn-sm" href="/admin/pages/${esc(p.id)}">${icon('edit', 'i-sm')}تعديل</a>
            <a class="btn btn-ghost btn-icon btn-sm" href="/" target="_blank" rel="noopener" title="عرض" aria-label="عرض">${icon('eye', 'i-sm')}</a>
          </div></td></tr>` : `<tr>
          <td><a class="cell-main" href="/admin/pages/${esc(p.id)}"><span class="thumb-empty">${icon('file', 'i-sm')}</span><strong>${esc(p.title)}</strong></a></td>
          <td><span class="ltr small muted">/page/${esc(p.slug)}</span></td>
          <td>${sw('vis', p.visible, '', `data-toggle="visible" data-id="${esc(p.id)}" aria-label="ظاهرة"`)}</td>
          <td>${sw('foot', p.showInFooter, '', `data-toggle="showInFooter" data-id="${esc(p.id)}" aria-label="في الفوتر"`)}</td>
          <td class="small muted nowrap">${fmtDate(p.updatedAt)}</td>
          <td><div class="actions">
            <a class="btn btn-ghost btn-sm" href="/admin/pages/${esc(p.id)}">${icon('edit', 'i-sm')}تعديل</a>
            <a class="btn btn-ghost btn-icon btn-sm" href="/page/${esc(encodeURIComponent(p.slug))}?preview=1" target="_blank" rel="noopener" title="عرض" aria-label="عرض">${icon('eye', 'i-sm')}</a>
            <button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${esc(p.id)}" title="حذف" aria-label="حذف">${icon('trash', 'i-sm')}</button>
          </div></td></tr>`)).join('')}</tbody></table></div>`
      : emptyHtml('file', 'ما فيه صفحات', 'أضف أول صفحة من زر "صفحة جديدة"');
  };
  render();
  $('[data-new]', el).addEventListener('click', () => openNewPage(templates));
  list.addEventListener('change', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    withBusy(null, async () => {
      try {
        const r = await aapi('PUT', `/api/admin/pages/${encodeURIComponent(t.dataset.id)}`, { [t.dataset.toggle]: t.checked });
        pages = pages.map((p) => (p.id === r.page.id ? { ...p, visible: r.page.visible, showInFooter: r.page.showInFooter } : p));
        toast(t.dataset.toggle === 'visible' ? (t.checked ? 'الصفحة صارت ظاهرة في المتجر' : 'تم إخفاء الصفحة') : 'تم الحفظ');
      } catch (ex) { t.checked = !t.checked; throw ex; }
    });
  });
  list.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const p = pages.find((x) => x.id === del.dataset.del);
    if (!(await confirmDialog(`حذف صفحة "${p.title}" نهائياً؟`, { ok: 'حذف', danger: true, title: 'حذف صفحة' }))) return;
    withBusy(null, async () => {
      await aapi('DELETE', `/api/admin/pages/${encodeURIComponent(p.id)}`);
      pages = pages.filter((x) => x !== p);
      render();
      toast('تم حذف الصفحة');
    });
  });
}
