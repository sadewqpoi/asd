'use strict';
// واجهة المتجر — تسجيل دخول العميل وإنشاء الحساب

// =====================================================================
//  تسجيل دخول العميل
// =====================================================================
const isPhone = (val) => /^\+?[\d\s\-()]{8,20}$/.test(toLatinDigits(val || '').trim());

const pwInput = (name, ac, label = 'كلمة المرور', hint = '') => `<label class="field"><span>${label}</span>
    <div class="input-group"><input class="input" type="password" name="${name}" required minlength="8" maxlength="128" autocomplete="${ac}">
    <button type="button" class="btn btn-ghost btn-icon btn-sm addon" data-eye aria-label="إظهار كلمة المرور">${icon('eye')}</button></div>
    ${hint ? `<small>${hint}</small>` : ''}</label>`;

const phoneInput = (label = 'رقم الجوال (واتساب)') => `<label class="field"><span>${label}</span>
    <input class="input" name="phone" type="tel" inputmode="tel" required maxlength="20" autocomplete="tel" dir="ltr" placeholder="05xxxxxxxx"></label>`;

function authFormHtml(mode) {
  if (mode === 'forgot') {
    return `<div class="auth-head"><h3>استرجاع كلمة المرور</h3><p class="small muted">اكتب رقم جوالك المسجل وبنرسل لك رمز تحقق على الواتساب</p></div>
      <form class="stack" novalidate>
        ${phoneInput('رقم الجوال المسجل')}
        <div class="alert err" data-err hidden></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">إرسال الرمز</button>
        <button type="button" class="link-btn" data-mode="login">رجوع لتسجيل الدخول</button>
      </form>`;
  }
  const reg = mode === 'register';
  return `<div class="auth-tabs" role="tablist">
      <button type="button" data-mode="login" class="${reg ? '' : 'on'}">تسجيل الدخول</button>
      <button type="button" data-mode="register" class="${reg ? 'on' : ''}">حساب جديد</button>
    </div>
    <form class="stack" novalidate>
      ${reg ? `<label class="field"><span>الاسم</span><input class="input" name="name" required maxlength="60" autocomplete="name"></label>
        <label class="field"><span>الإيميل</span><input class="input" name="email" type="email" required maxlength="120" autocomplete="email" dir="ltr" placeholder="name@email.com"></label>
        ${phoneInput()}`
        : `<label class="field"><span>الإيميل أو رقم الجوال</span>
        <input class="input" name="identifier" required maxlength="120" autocomplete="username" dir="auto" placeholder="05xxxxxxxx أو name@email.com"></label>`}
      ${pwInput('password', reg ? 'new-password' : 'current-password', 'كلمة المرور', reg ? '8 أحرف على الأقل' : '')}
      ${reg && S.settings.whatsappVerify ? `<p class="small muted row">${icon('chat', 'i-sm')}بنرسل لك رمز تحقق على الواتساب لتأكيد رقمك.</p>` : ''}
      <div class="alert err" data-err hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${reg ? 'إنشاء الحساب' : 'دخول'}</button>
      ${reg ? '' : '<button type="button" class="link-btn" data-mode="forgot">نسيت كلمة المرور؟</button>'}
    </form>`;
}

function otpStepHtml(o, reset) {
  return `<div class="otp-step">
    <div class="otp-icon">${icon('chat')}</div>
    <h3>رمز التحقق</h3>
    <p class="small muted">أرسلنا رمز من 6 أرقام على الواتساب إلى <b class="ltr">${esc(o.phone)}</b></p>
    <form class="stack" novalidate>
      <input class="input otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="------" aria-label="رمز التحقق" required>
      ${reset ? pwInput('password', 'new-password', 'كلمة المرور الجديدة', '8 أحرف على الأقل') : ''}
      <div class="alert err" data-err hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${reset ? 'تغيير كلمة المرور والدخول' : 'تأكيد'}</button>
      <div class="otp-foot"><button type="button" class="link-btn" data-resend disabled>إعادة الإرسال</button><button type="button" class="link-btn" data-back>رجوع</button></div>
    </form></div>`;
}

function addPhoneHtml() {
  return `<div class="otp-step">
    <div class="otp-icon">${icon('phone')}</div>
    <h3>أضف رقم جوالك</h3>
    <p class="small muted">حسابك ما فيه رقم جوال. أضف رقمك (عليه واتساب) عشان نرسل لك رمز التحقق.</p>
    <form class="stack" novalidate>
      ${phoneInput()}
      <div class="alert err" data-err hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">إرسال الرمز</button>
      <button type="button" class="link-btn" data-back>رجوع</button>
    </form></div>`;
}

// تحقق سريع قبل الإرسال عشان الرسالة تكون واضحة
function authProblem(m, d) {
  const pw = d.password || '';
  if (m === 'register') {
    if ((d.name || '').trim().length < 2) return 'اكتب اسمك (حرفين على الأقل)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.email || '').trim())) return 'اكتب إيميل صحيح — مثال: name@gmail.com';
    if (!isPhone(d.phone)) return 'اكتب رقم جوال صحيح — مثال: 05xxxxxxxx';
    if (pw.length < 8) return 'كلمة المرور لازم تكون 8 أحرف أو أرقام على الأقل';
  } else if (m === 'login') {
    const id = toLatinDigits(d.identifier || '').trim();
    if (!id) return 'اكتب الإيميل أو رقم الجوال';
    if (!id.includes('@') && !isPhone(id)) return 'اكتب إيميل صحيح (مثل name@gmail.com) أو رقم جوال (مثل 05xxxxxxxx)';
    if (!pw) return 'اكتب كلمة المرور';
  } else if (m === 'forgot' && !isPhone(d.phone)) {
    return 'اكتب رقم جوال صحيح — مثال: 05xxxxxxxx';
  }
  return '';
}

function bindEye(root) {
  $$('[data-eye]', root).forEach((b) => {
    b.addEventListener('click', () => {
      const input = b.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.innerHTML = icon(show ? 'eyeOff' : 'eye');
    });
  });
}

// يمنع الإرسال المكرر ويعرض الخطأ داخل النموذج
function onFormSubmit(form, fn) {
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const btn = form.querySelector('[type=submit]');
    const err = form.querySelector('[data-err]');
    err.hidden = true;
    busy = true;
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      await fn(formData(form));
    } catch (ex) {
      if (err.isConnected) { err.textContent = ex.message; err.hidden = false; }
    } finally {
      busy = false;
      if (btn.isConnected) { btn.disabled = false; btn.classList.remove('loading'); }
    }
  });
}

// خطوات الدخول: النموذج ← (إضافة رقم) ← رمز الواتساب ← تم
function mountAuth(container, { mode = 'login', onDone, focus = false } = {}) {
  let timer = null;

  const finish = (r, purpose) => {
    clearInterval(timer);
    S.me = r.customer;
    renderUserMenu();
    toast(purpose === 'register' ? 'تم إنشاء حسابك بنجاح' : purpose === 'reset' ? 'تم تغيير كلمة المرور' : `أهلاً ${S.me.name}`);
    if (onDone) onDone();
  };

  const showOtp = (o, purpose) => {
    clearInterval(timer);
    container.innerHTML = otpStepHtml(o, purpose === 'reset');
    bindEye(container);
    const form = $('form', container);
    const code = form.code;
    const resend = $('[data-resend]', container);
    let left = o.resendIn;
    const tick = () => {
      resend.disabled = left > 0;
      resend.textContent = left > 0 ? `إعادة الإرسال بعد ${left} ث` : 'إعادة الإرسال';
      left -= 1;
    };
    tick();
    timer = setInterval(() => (container.isConnected ? tick() : clearInterval(timer)), 1000);
    resend.addEventListener('click', async () => {
      const err = $('[data-err]', container);
      err.hidden = true;
      resend.disabled = true;
      try {
        const r = await api('POST', '/api/auth/otp/resend', { id: o.id });
        left = r.otp.resendIn;
        code.value = '';
        code.focus();
        toast('أرسلنا رمز جديد على الواتساب');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
      tick();
    });
    $('[data-back]', container).addEventListener('click', () => showForm(purpose === 'reset' ? 'forgot' : purpose));
    code.addEventListener('input', () => {
      code.value = toLatinDigits(code.value).replace(/\D/g, '').slice(0, 6);
      if (code.value.length === 6 && purpose !== 'reset') form.requestSubmit();
    });
    setTimeout(() => code.focus(), 30);
    onFormSubmit(form, async (d) => {
      if (code.value.length !== 6) throw new Error('اكتب الرمز كامل (6 أرقام)');
      if (purpose === 'reset' && (d.password || '').length < 8) throw new Error('كلمة المرور الجديدة لازم تكون 8 أحرف على الأقل');
      finish(await api('POST', '/api/auth/otp/verify', { id: o.id, code: code.value, password: d.password }), purpose);
    });
  };

  const showAddPhone = (o, purpose) => {
    container.innerHTML = addPhoneHtml();
    const form = $('form', container);
    $('[data-back]', container).addEventListener('click', () => showForm(purpose));
    setTimeout(() => form.phone.focus(), 30);
    onFormSubmit(form, async (d) => {
      if (!isPhone(d.phone)) throw new Error('اكتب رقم جوال صحيح — مثال: 05xxxxxxxx');
      showOtp((await api('POST', '/api/auth/otp/phone', { id: o.id, phone: d.phone })).otp, purpose);
    });
  };

  const showForm = (m) => {
    clearInterval(timer);
    container.innerHTML = authFormHtml(m);
    $$('[data-mode]', container).forEach((b) => b.addEventListener('click', () => showForm(b.dataset.mode)));
    bindEye(container);
    const form = $('form', container);
    if (focus || m === 'forgot') setTimeout(() => form.querySelector('input').focus(), 30);
    onFormSubmit(form, async (d) => {
      const problem = authProblem(m, d);
      if (problem) throw new Error(problem);
      if (m === 'forgot') {
        showOtp((await api('POST', '/api/auth/forgot', d)).otp, 'reset');
        return;
      }
      const r = await api('POST', m === 'login' ? '/api/auth/login' : '/api/auth/register', d);
      if (r.customer) finish(r, m);
      else if (r.needPhone) showAddPhone(r.otp, m);
      else showOtp(r.otp, m);
    });
  };

  showForm(mode);
}

function openAuthModal(mode = 'login') {
  const m = openModal({ title: 'حسابي', size: 'sm' });
  mountAuth(m.body, { mode, focus: true, onDone: () => { m.close(); route(); } });
}

function loginRequired(app, text) {
  app.innerHTML = `<div class="card auth-box"><p class="muted center-text gap-b">${esc(text)}</p><div data-auth></div></div>`;
  mountAuth($('[data-auth]', app), { onDone: () => route() });
}

async function logout() {
  await withBusy(null, async () => {
    await api('POST', '/api/auth/logout');
    S.me = null;
    renderUserMenu();
    toast('تم تسجيل الخروج');
    if (/^\/(account|checkout)/.test(location.pathname)) go('/');
  });
}

function renderUserMenu() {
  const menu = $('#userMenu');
  menu.hidden = true;
  if (!S.me) { menu.innerHTML = ''; return; }
  menu.innerHTML = `<div class="who"><strong>${esc(S.me.name)}</strong><span class="small muted ltr">${esc(S.me.email || S.me.phone)}</span></div>
    <a href="/account">${icon('receipt')}طلباتي</a>
    <a href="/wishlist">${icon('heart')}المفضلة</a>
    <a href="/account?tab=profile">${icon('user')}بياناتي</a>
    <button type="button" data-logout>${icon('logout')}تسجيل خروج</button>`;
}
