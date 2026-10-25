'use strict';
// لوحة التحكم — الإعداد الأول وتسجيل الدخول وتغيير كلمة المرور المؤقتة

// =====================================================================
//  الدخول والإعداد
// =====================================================================
function authShell(title, sub, inner) {
  document.body.innerHTML = `<div class="auth-page"><div class="auth-card">
    <div class="auth-logo">${A.store.logo ? `<img src="${esc(A.store.logo)}" alt="">` : ''}<h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
    ${inner}</div></div>`;
  document.title = `${title} | ${A.store.name}`;
  bindEyes(document.body);
  const first = $('input');
  if (first) first.focus();
  return $('form');
}

function renderSetup() {
  const form = authShell('إعداد المتجر لأول مرة', 'أنشئ حساب مالك المتجر — يملك كل الصلاحيات ويقدر يضيف مشرفين', `
    <form class="stack" novalidate>
      <div class="alert info">${icon('info', 'i-sm')}<div>رمز الإعداد مكتوب في نافذة تشغيل السيرفر (الشاشة السوداء اللي فتحت لما شغّلت المتجر).</div></div>
      <label class="field"><span>رمز الإعداد</span><input class="input code-input" name="code" required maxlength="12" placeholder="XXXX-XXXX" autocomplete="off" dir="ltr"></label>
      <label class="field"><span>اسمك</span><input class="input" name="name" required maxlength="60" autocomplete="name"></label>
      <label class="field"><span>الإيميل أو رقم الجوال</span><input class="input" name="identifier" required maxlength="120" dir="auto" autocomplete="username" placeholder="05xxxxxxxx أو name@email.com"><small>بتستخدمه لتسجيل الدخول</small></label>
      ${pwField('password', 'كلمة المرور', 'new-password', '8 أحرف على الأقل')}
      ${pwField('confirm', 'تأكيد كلمة المرور')}
      <div class="alert err" data-err hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">إنشاء الحساب والدخول</button>
    </form>`);
  onSubmit(form, async (d) => {
    if (d.password !== d.confirm) throw new Error('كلمتا المرور غير متطابقتين');
    const r = await api('POST', '/api/admin/setup', d);
    A.me = r.me;
    toast('تم إنشاء حسابك — أهلاً بك');
    startApp();
  });
}

function renderLogin() {
  A.me = null;
  A.dirtyGuard = null;
  const form = authShell('تسجيل الدخول', `لوحة تحكم ${A.store.name}`, `
    <form class="stack" novalidate>
      <label class="field"><span>الإيميل أو رقم الجوال</span><input class="input" name="identifier" required maxlength="120" dir="auto" autocomplete="username" placeholder="05xxxxxxxx أو name@email.com"></label>
      ${pwField('password', 'كلمة المرور', 'current-password')}
      <div class="alert err" data-err hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">دخول</button>
    </form>
    <p class="auth-foot">نسيت كلمة المرور؟ اطلب من مالك المتجر يعيد تعيينها لك من صفحة "المشرفين".</p>`);
  onSubmit(form, async (d) => {
    const r = await api('POST', '/api/admin/login', d);
    A.me = r.me;
    if (A.me.mustChangePassword) renderForcePassword();
    else startApp();
  });
}

function renderForcePassword() {
  const form = authShell('اختر كلمة مرور جديدة', `أهلاً ${A.me.name} — هذي أول مرة تدخل، غيّر كلمة المرور المؤقتة بكلمة مرور خاصة فيك`, `
    <form class="stack" novalidate>
      ${pwField('password', 'كلمة المرور الجديدة', 'new-password', '8 أحرف على الأقل')}
      ${pwField('confirm', 'تأكيد كلمة المرور')}
      <div class="alert err" data-err hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">حفظ والدخول</button>
    </form>
    <p class="auth-foot"><button type="button" class="btn btn-ghost btn-sm" data-logout>تسجيل خروج</button></p>`);
  onSubmit(form, async (d) => {
    if (d.password !== d.confirm) throw new Error('كلمتا المرور غير متطابقتين');
    A.me = (await api('POST', '/api/admin/me/password', { password: d.password })).me;
    toast('تم تغيير كلمة المرور');
    startApp();
  });
}

async function logout() {
  try { await api('POST', '/api/admin/logout'); } catch { /* حتى لو فشل نطلع */ }
  toast('تم تسجيل الخروج');
  renderLogin();
}
