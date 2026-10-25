'use strict';
// لوحة التحكم — حسابي

// =====================================================================
//  حسابي
// =====================================================================
async function viewAccount(el) {
  const owner = A.me.role === 'owner';
  el.innerHTML = `<div class="grid-2 align-start">
    <form class="card card-pad stack" data-profile novalidate>
      <h3 class="section-title">بياناتي</h3>
      <label class="field"><span>الاسم</span><input class="input" name="name" value="${esc(A.me.name)}" maxlength="60" required></label>
      <label class="field"><span>الإيميل</span><input class="input" name="email" value="${esc(A.me.email)}" maxlength="120" dir="ltr"${owner ? '' : ' readonly'}></label>
      <label class="field"><span>رقم الجوال</span><input class="input" name="phone" value="${esc(A.me.phone)}" maxlength="20" dir="ltr" placeholder="05xxxxxxxx"${owner ? '' : ' readonly'}></label>
      ${owner ? '<small class="hint">تقدر تدخل بالإيميل أو برقم الجوال.</small>' : '<small class="hint">لتغيير الإيميل أو الجوال تواصل مع مالك المتجر.</small>'}
      <div class="alert err" data-err hidden></div>
      <div><button class="btn btn-primary" type="submit">حفظ</button></div>
    </form>
    <div class="stack">
      <form class="card card-pad stack" data-pass novalidate>
        <h3 class="section-title">تغيير كلمة المرور</h3>
        ${pwField('current', 'كلمة المرور الحالية', 'current-password')}
        ${pwField('password', 'كلمة المرور الجديدة', 'new-password', '8 أحرف على الأقل')}
        ${pwField('confirm', 'تأكيد كلمة المرور الجديدة')}
        <div class="alert err" data-err hidden></div>
        <div><button class="btn btn-outline" type="submit">تغيير كلمة المرور</button></div>
      </form>
      <div class="card card-pad"><h3 class="section-title">صلاحياتي</h3>
        ${owner ? '<span class="badge primary">مالك المتجر — كل الصلاحيات</span>' : `<div class="tags">${A.me.permissions.map((p) => `<span class="badge">${esc(A.perms[p])}</span>`).join('')}</div>`}</div>
    </div></div>`;
  bindEyes(el);
  const pf = $('[data-profile]', el);
  onSubmit(pf, async (d) => {
    A.me = (await aapi('PUT', '/api/admin/me', d)).me;
    $$('.me-btn .name, .me-menu .who strong').forEach((x) => { x.textContent = A.me.name; });
    toast('تم الحفظ');
  });
  const pw = $('[data-pass]', el);
  onSubmit(pw, async (d) => {
    if (d.password !== d.confirm) throw new Error('كلمتا المرور غير متطابقتين');
    A.me = (await aapi('POST', '/api/admin/me/password', { current: d.current, password: d.password })).me;
    pw.reset();
    toast('تم تغيير كلمة المرور — طلعناك من باقي الأجهزة');
  });
}
