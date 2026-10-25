'use strict';
// لوحة التحكم — المشرفين والصلاحيات

// =====================================================================
//  المشرفين
// =====================================================================
function permGridHtml(selected) {
  return `<div class="perm-grid">${Object.entries(A.perms).map(([k, l]) => {
    const allowed = can(k);
    return `<label${allowed ? '' : ' title="ما تقدر تعطي صلاحية ما عندك"'}><input type="checkbox" name="perm" value="${k}"${selected.includes(k) ? ' checked' : ''}${allowed ? '' : ' disabled'}>${esc(l)}</label>`;
  }).join('')}</div>`;
}

function openAdminEditor(a, onSaved) {
  const isNew = !a;
  const m = openModal({
    title: isNew ? 'إضافة مشرف جديد' : `تعديل المشرف — ${a.name}`,
    size: 'lg',
    body: `<form class="stack" novalidate data-form>
      <label class="field"><span>اسم المشرف *</span><input class="input" name="name" maxlength="60" required value="${esc(a ? a.name : '')}"></label>
      ${isNew ? `<div class="field"><span>طريقة الدخول</span>
          <div class="seg"><label><input type="radio" name="method" value="email" checked>${icon('mail', 'i-sm')}بالإيميل</label><label><input type="radio" name="method" value="phone">${icon('phone', 'i-sm')}برقم الجوال</label></div></div>
        <label class="field"><span data-id-label>الإيميل *</span><input class="input" name="identifier" required maxlength="120" dir="ltr" data-id-input placeholder="name@email.com" autocomplete="off"><small>المشرف يسجّل دخوله فيه</small></label>`
        : `<div class="grid-2"><label class="field"><span>الإيميل</span><input class="input" name="email" maxlength="120" dir="ltr" value="${esc(a.email)}"></label>
           <label class="field"><span>رقم الجوال</span><input class="input" name="phone" maxlength="20" dir="ltr" value="${esc(a.phone)}" placeholder="05xxxxxxxx"></label></div>
           <small class="hint">لازم واحد منهم على الأقل — المشرف يقدر يدخل بأي واحد منهم.</small>`}
      <div class="form-section"><div class="row"><h4 class="grow">الصلاحيات</h4><label class="check small"><input type="checkbox" data-all>تحديد الكل</label></div>${permGridHtml(a ? a.permissions : [])}</div>
      ${isNew ? `<label class="field"><span>كلمة مرور مؤقتة <span class="muted">(اختياري)</span></span><input class="input" name="password" type="text" minlength="8" maxlength="128" dir="ltr" autocomplete="off">
        <small>اتركها فاضية ونولّد لك وحدة قوية. المشرف بيُطلب منه يغيّرها أول ما يدخل.</small></label>` : ''}
      <div class="alert err" data-err hidden></div>
    </form>`,
    foot: `<button class="btn btn-primary" data-save>${isNew ? 'إضافة المشرف' : 'حفظ'}</button><button class="btn btn-outline" data-close>إلغاء</button>`,
  });
  const form = $('[data-form]', m.el);
  if (isNew) {
    $$('[name=method]', form).forEach((r) => r.addEventListener('change', () => {
      const phone = form.method.value === 'phone';
      $('[data-id-label]', form).textContent = phone ? 'رقم الجوال *' : 'الإيميل *';
      const inp = $('[data-id-input]', form);
      inp.placeholder = phone ? '05xxxxxxxx' : 'name@email.com';
      inp.inputMode = phone ? 'tel' : 'email';
      inp.focus();
    }));
  }
  const all = $('[data-all]', form);
  const boxes = $$('[name=perm]:not(:disabled)', form);
  const syncAll = () => { all.checked = boxes.length > 0 && boxes.every((b) => b.checked); };
  syncAll();
  all.addEventListener('change', () => { boxes.forEach((b) => { b.checked = all.checked; }); });
  boxes.forEach((b) => b.addEventListener('change', syncAll));
  const err = $('[data-err]', m.el);
  const save = (btn) => withBusy(btn, async () => {
    err.hidden = true;
    const f = formData(form);
    const permissions = $$('[name=perm]:checked', form).map((x) => x.value);
    try {
      if (isNew) {
        const id = f.identifier.trim();
        if (form.method.value === 'email' && id && !id.includes('@')) throw new Error('اكتب إيميل صحيح أو اختر "برقم الجوال"');
        if (form.method.value === 'phone' && id.includes('@')) throw new Error('اكتب رقم جوال أو اختر "بالإيميل"');
        const r = await aapi('POST', '/api/admin/admins', { name: f.name, identifier: id, permissions, password: f.password });
        m.close();
        onSaved(r.admin);
        showTempPassword({
          title: 'تمت إضافة المشرف', name: r.admin.name, identifier: r.admin.email || r.admin.phone, password: r.tempPassword, adminInvite: true,
          intro: `مرحباً ${r.admin.name}،\nتمت إضافتك كمشرف في لوحة تحكم ${A.store.name}.`,
        });
      } else {
        const r = await aapi('PUT', `/api/admin/admins/${encodeURIComponent(a.id)}`, { name: f.name, email: f.email, phone: f.phone, permissions });
        m.close();
        onSaved(r.admin);
        toast('تم حفظ المشرف');
      }
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $('[data-save]', m.el).addEventListener('click', (e) => save(e.currentTarget));
  form.addEventListener('submit', (e) => { e.preventDefault(); save($('[data-save]', m.el)); });
}

async function viewAdmins(el, ctx) {
  let { admins } = await aapi('GET', '/api/admin/admins');
  if (ctx.stale()) return;
  el.innerHTML = `<p class="help">أضف مشرفين بالإيميل أو رقم الجوال وحدد وش يقدر يسوي كل واحد. كل مشرف يدخل لوحة التحكم ببياناته الخاصة، وتقدر توقفه أو تحذفه بأي وقت.</p>
    <div class="toolbar"><span class="spacer"></span><button class="btn btn-primary" data-new>${icon('plus')}إضافة مشرف</button></div>
    <div class="card" data-list></div>`;
  const list = $('[data-list]', el);
  const manageable = (a) => a.role !== 'owner' && a.id !== A.me.id && (A.me.role === 'owner' || a.permissions.every((p) => can(p)));
  const render = () => {
    list.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>المشرف</th><th>بيانات الدخول</th><th>الصلاحيات</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody>
      ${admins.map((a) => `<tr>
        <td><div class="cell-main"><span class="avatar">${esc(initial(a.name))}</span><div><strong>${esc(a.name)}${a.id === A.me.id ? ' <span class="muted small">(أنت)</span>' : ''}</strong>
          <div class="small muted">${a.role === 'owner' ? 'مالك المتجر' : `مشرف${a.createdBy ? ` · أضافه ${esc(a.createdBy)}` : ''}`}</div></div></div></td>
        <td class="small">${a.email ? `<div class="row">${icon('mail', 'i-sm')}<span class="ltr">${esc(a.email)}</span></div>` : ''}${a.phone ? `<div class="row">${icon('phone', 'i-sm')}<span class="ltr">${esc(a.phone)}</span></div>` : ''}</td>
        <td>${a.role === 'owner' ? '<span class="badge primary">كل الصلاحيات</span>' : `<div class="tags">${a.permissions.map((p) => `<span class="badge">${esc(A.perms[p])}</span>`).join('')}</div>`}</td>
        <td>${!a.active ? '<span class="badge danger">موقوف</span>' : a.mustChangePassword ? '<span class="badge warn">بانتظار أول دخول</span>' : '<span class="badge ok">نشط</span>'}</td>
        <td class="small muted nowrap">${a.lastLoginAt ? fmtDate(a.lastLoginAt) : 'لم يدخل بعد'}</td>
        <td>${manageable(a) ? `<div class="actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-edit="${esc(a.id)}" title="تعديل" aria-label="تعديل">${icon('edit', 'i-sm')}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-reset="${esc(a.id)}" title="كلمة مرور مؤقتة جديدة" aria-label="إعادة تعيين كلمة المرور">${icon('key', 'i-sm')}</button>
          <button class="btn btn-ghost btn-sm" data-active="${esc(a.id)}">${a.active ? 'إيقاف' : 'تفعيل'}</button>
          <button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${esc(a.id)}" title="حذف" aria-label="حذف">${icon('trash', 'i-sm')}</button></div>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  };
  const upsert = (na) => {
    const i = admins.findIndex((x) => x.id === na.id);
    if (i >= 0) admins[i] = { ...admins[i], ...na };
    else admins.push({ ...na, createdBy: A.me.name });
    render();
  };
  render();
  $('[data-new]', el).addEventListener('click', () => openAdminEditor(null, upsert));
  list.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = b.dataset.edit || b.dataset.reset || b.dataset.active || b.dataset.del;
    const a = admins.find((x) => x.id === id);
    if (!a) return;
    if (b.dataset.edit) openAdminEditor(a, upsert);
    if (b.dataset.reset) {
      if (!(await confirmDialog(`إنشاء كلمة مرور مؤقتة جديدة للمشرف "${a.name}"؟ بيطلع من كل الأجهزة.`, { ok: 'إنشاء', title: 'إعادة تعيين كلمة المرور' }))) return;
      withBusy(null, async () => {
        const r = await aapi('POST', `/api/admin/admins/${encodeURIComponent(a.id)}/reset-password`);
        upsert(r.admin);
        showTempPassword({
          title: 'كلمة مرور مؤقتة جديدة', name: a.name, identifier: a.email || a.phone, password: r.tempPassword, adminInvite: true,
          intro: `مرحباً ${a.name}،\nهذي بيانات دخولك الجديدة للوحة تحكم ${A.store.name}.`,
        });
      });
    }
    if (b.dataset.active) {
      if (a.active && !(await confirmDialog(`إيقاف المشرف "${a.name}"؟ ما بيقدر يدخل لين تفعّله مرة ثانية.`, { ok: 'إيقاف', danger: true }))) return;
      withBusy(b, async () => {
        upsert((await aapi('PUT', `/api/admin/admins/${encodeURIComponent(a.id)}`, { active: !a.active })).admin);
        toast(a.active ? 'تم تفعيل المشرف' : 'تم إيقاف المشرف');
      });
    }
    if (b.dataset.del) {
      if (!(await confirmDialog(`حذف المشرف "${a.name}" نهائياً؟`, { ok: 'حذف', danger: true, title: 'حذف مشرف' }))) return;
      withBusy(null, async () => {
        await aapi('DELETE', `/api/admin/admins/${encodeURIComponent(a.id)}`);
        admins = admins.filter((x) => x !== a);
        render();
        toast('تم حذف المشرف');
      });
    }
  });
  if (new URLSearchParams(location.search).has('new')) {
    history.replaceState(null, '', '/admin/admins');
    openAdminEditor(null, upsert);
  }
}
