'use strict';
// لوحة التحكم — العملاء

// =====================================================================
//  العملاء
// =====================================================================
function showTempPassword({ title, name, identifier, password, intro, adminInvite = false }) {
  const isPhone = identifier && !identifier.includes('@');
  const loginUrl = `${location.origin}${adminInvite ? '/admin' : '/'}`;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const msg = `${intro}\n\nرابط الدخول: ${loginUrl}\nالإيميل أو الجوال: ${identifier}\nكلمة المرور المؤقتة: ${password}${adminInvite ? '\n\nبيُطلب منك تغيير كلمة المرور أول ما تدخل.' : ''}`;
  const m = openModal({
    title,
    body: `<div class="stack">
      <div class="alert ok">${icon('checkCircle', 'i-sm')}<div>${esc(name)} — انسخ البيانات وأرسلها له.</div></div>
      <div class="cred">
        <div class="cred-row"><div><span>رابط الدخول</span><br><strong class="ltr">${esc(loginUrl)}</strong></div><button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${esc(loginUrl)}" aria-label="نسخ">${icon('copy', 'i-sm')}</button></div>
        <div class="cred-row"><div><span>الإيميل أو الجوال</span><br><strong class="ltr">${esc(identifier)}</strong></div><button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${esc(identifier)}" aria-label="نسخ">${icon('copy', 'i-sm')}</button></div>
        <div class="cred-row"><div><span>كلمة المرور المؤقتة</span><br><strong class="ltr">${esc(password)}</strong></div><button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${esc(password)}" aria-label="نسخ">${icon('copy', 'i-sm')}</button></div>
      </div>
      <div class="alert warn">${icon('alert', 'i-sm')}<div>كلمة المرور تظهر هالمرة بس — انسخها الحين.${local ? ' وانتبه: الرابط هذا محلي (localhost)، أرسل له رابط متجرك العام (الآيبي أو الدومين).' : ''}</div></div>
      <div class="share-row">
        ${isPhone ? `<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/${identifier.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}">${icon('chat')}إرسال بالواتساب</a>`
          : `<a class="btn btn-primary" href="mailto:${esc(identifier)}?subject=${encodeURIComponent(`بيانات الدخول — ${A.store.name}`)}&body=${encodeURIComponent(msg)}">${icon('mail')}إرسال بالإيميل</a>`}
        <button type="button" class="btn btn-outline" data-copy-msg>${icon('copy')}نسخ الرسالة كاملة</button>
      </div></div>`,
    foot: '<button class="btn btn-outline" data-close>تم</button>',
  });
  $$('[data-copy]', m.el).forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)));
  $('[data-copy-msg]', m.el).addEventListener('click', () => copyText(msg));
}

async function viewCustomers(el, ctx) {
  let { customers } = await aapi('GET', '/api/admin/customers');
  if (ctx.stale()) return;
  let q = '';
  el.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" placeholder="ابحث بالاسم أو الإيميل أو الجوال" data-q></div><span class="spacer"></span><span class="muted">${customers.length} عميل</span></div>
    <div class="card" data-list></div>`;
  const list = $('[data-list]', el);
  const render = () => {
    const t = q.toLowerCase();
    const rows = customers.filter((c) => !t || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(t));
    list.innerHTML = rows.length
      ? `<div class="table-wrap"><table class="t"><thead><tr><th>العميل</th><th>الطلبات</th><th>إجمالي المشتريات</th><th>آخر طلب</th><th>التسجيل</th><th></th></tr></thead><tbody>
        ${rows.map((c) => `<tr><td><div class="cell-main"><span class="avatar">${esc(initial(c.name))}</span><div><strong>${esc(c.name)}</strong>
          ${c.email ? `<div class="small muted ltr">${esc(c.email)}</div>` : ''}
          ${c.phone ? `<div class="small muted row"><span class="ltr">${esc(c.phone)}</span>${c.phoneVerified ? `<span class="badge ok" title="تم التحقق بالواتساب">${icon('check', 'i-sm')}موثّق</span>` : ''}</div>` : ''}</div></div></td>
          <td class="num">${c.ordersCount}</td><td class="nowrap">${money(c.spent)}</td>
          <td class="small muted nowrap">${c.lastOrderAt ? fmtDate(c.lastOrderAt, false) : '—'}</td><td class="small muted nowrap">${fmtDate(c.createdAt, false)}</td>
          <td><div class="actions">
            <button class="btn btn-ghost btn-icon btn-sm" data-reset="${esc(c.id)}" title="إعادة تعيين كلمة المرور" aria-label="إعادة تعيين كلمة المرور">${icon('key', 'i-sm')}</button>
            <button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${esc(c.id)}" title="حذف" aria-label="حذف">${icon('trash', 'i-sm')}</button></div></td></tr>`).join('')}</tbody></table></div>`
      : emptyHtml('users', customers.length ? 'ما فيه نتائج' : 'ما فيه عملاء للحين', customers.length ? '' : 'أول ما يسجّل عميل بيظهر هنا');
  };
  render();
  $('[data-q]', el).addEventListener('input', debounce((e) => { q = e.target.value.trim(); render(); }, 150));
  list.addEventListener('click', async (e) => {
    const rs = e.target.closest('[data-reset]');
    const del = e.target.closest('[data-del]');
    if (rs) {
      const c = customers.find((x) => x.id === rs.dataset.reset);
      if (!(await confirmDialog(`إنشاء كلمة مرور مؤقتة جديدة للعميل "${c.name}"؟ كلمة مروره الحالية بتتوقف.`, { ok: 'إنشاء', title: 'إعادة تعيين كلمة المرور' }))) return;
      withBusy(null, async () => {
        const r = await aapi('POST', `/api/admin/customers/${encodeURIComponent(c.id)}/reset-password`);
        showTempPassword({
          title: 'كلمة مرور جديدة للعميل', name: c.name, identifier: c.email || c.phone, password: r.tempPassword,
          intro: `مرحباً ${c.name}،\nهذي بيانات الدخول الجديدة لحسابك في ${A.store.name}. تقدر تغيّر كلمة المرور من صفحة "بياناتي".`,
        });
      });
    }
    if (del) {
      const c = customers.find((x) => x.id === del.dataset.del);
      if (!(await confirmDialog(`حذف حساب العميل "${c.name}"؟ طلباته القديمة تبقى محفوظة.`, { ok: 'حذف', danger: true, title: 'حذف عميل' }))) return;
      withBusy(null, async () => {
        await aapi('DELETE', `/api/admin/customers/${encodeURIComponent(c.id)}`);
        customers = customers.filter((x) => x !== c);
        render();
        toast('تم حذف العميل');
      });
    }
  });
}
