'use strict';
// لوحة التحكم — تعديل المتجر (الهوية، الهيدر، الفوتر، الدفع...)

// =====================================================================
//  تعديل المتجر
// =====================================================================
const DESIGN_TABS = [
  ['identity', 'الهوية', 'store'],
  ['home', 'الصفحة الرئيسية', 'home'],
  ['menus', 'الهيدر والقوائم', 'list'],
  ['announce', 'شريط الإعلان', 'megaphone'],
  ['footer', 'الفوتر', 'layout'],
  ['payment', 'الدفع', 'bank'],
  ['verify', 'التحقق بالواتساب', 'shieldCheck'],
  ['pages', 'الصفحات', 'file'],
];
const SWATCHES = ['#0f4c52', '#173b30', '#0b7380', '#004956', '#1a7f37', '#1d4ed8', '#6d28d9', '#be123c', '#111827'];
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const setPath = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  ks.reduce((x, k) => x[k], o)[last] = v;
};

function linkListHtml(key, list, { urlPh = '/category/... أو https://...' } = {}) {
  return `<div class="link-list">${list.map((l, i) => `<div class="link-row">
      <input class="input" data-li="${key}.${i}.label" value="${esc(l.label)}" placeholder="العنوان" maxlength="40" aria-label="العنوان">
      <input class="input" data-li="${key}.${i}.url" value="${esc(l.url)}" placeholder="${esc(urlPh)}" dir="ltr" aria-label="الرابط">
      <div class="btns">
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-mv="${key}" data-i="${i}" data-d="-1" aria-label="لأعلى"${i === 0 ? ' disabled' : ''}>${icon('up', 'i-sm')}</button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-mv="${key}" data-i="${i}" data-d="1" aria-label="لأسفل"${i === list.length - 1 ? ' disabled' : ''}>${icon('down', 'i-sm')}</button>
        <button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-rmi="${key}" data-i="${i}" aria-label="حذف">${icon('trash', 'i-sm')}</button></div></div>`).join('')}
    ${list.length ? '' : '<p class="hint">ما فيه روابط.</p>'}</div>
    <button type="button" class="btn btn-outline btn-sm" data-add-link="${key}">${icon('plus', 'i-sm')}إضافة رابط</button>`;
}

async function viewDesign(el, ctx) {
  const { settings, categories, whatsappConfigured, pages: storePages = [], homePageId = '' } = await aapi('GET', '/api/admin/settings');
  if (ctx.stale()) return;
  let draft = JSON.parse(JSON.stringify(settings));
  let tab = new URLSearchParams(location.search).get('tab') || 'identity';
  if (!DESIGN_TABS.some(([k]) => k === tab)) tab = 'identity';
  let dirty = false;
  A.dirtyGuard = () => dirty;

  el.innerHTML = `<div class="design-wrap">
    <div class="card">
      <div class="design-tabs" role="tablist">${DESIGN_TABS.map(([k, l, ic]) => `<button type="button" data-tab="${k}" role="tab">${icon(ic, 'i-sm')}${l}</button>`).join('')}</div>
      <div class="design-body" data-body></div>
      <div class="save-bar"><button class="btn btn-primary" data-save>حفظ التغييرات</button><span class="dirty" data-dirty hidden>فيه تغييرات ما انحفظت</span><span class="spacer"></span>
        <a class="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener">${icon('external', 'i-sm')}فتح المتجر</a></div>
    </div>
    <div class="card preview"><div class="preview-head">${icon('eye', 'i-sm')}معاينة المتجر<span class="small muted">(تتحدّث بعد الحفظ)</span><span class="spacer"></span>
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-reload aria-label="تحديث المعاينة">${icon('refresh', 'i-sm')}</button></div>
      <div class="preview-frame"><iframe src="/" title="معاينة المتجر" data-frame tabindex="-1"></iframe></div></div>
  </div>`;
  const body = $('[data-body]', el);
  const frame = $('[data-frame]', el);
  const fitFrame = () => {
    const box = frame.parentElement;
    const scale = box.clientWidth / 1280;
    frame.style.transform = `scale(${scale})`;
    frame.style.height = `${box.clientHeight / scale}px`;
  };
  fitFrame();
  const ro = new ResizeObserver(fitFrame);
  ro.observe(frame.parentElement);
  const reloadFrame = () => { try { frame.contentWindow.location.reload(); } catch { frame.src = '/'; } };
  $('[data-reload]', el).addEventListener('click', reloadFrame);

  const markDirty = () => { dirty = true; $('[data-dirty]', el).hidden = false; };
  const input = (k, label, { ph = '', max = 100, dir = '', hint = '', type = 'text' } = {}) => `<label class="field"><span>${label}</span>
    <input class="input" type="${type}" data-k="${k}" value="${esc(getPath(draft, k))}" placeholder="${esc(ph)}" maxlength="${max}"${dir ? ` dir="${dir}"` : ''}>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const area = (k, label, { max = 500, rows = 3, hint = '' } = {}) => `<label class="field"><span>${label}</span>
    <textarea class="textarea" data-k="${k}" maxlength="${max}" rows="${rows}">${esc(getPath(draft, k))}</textarea>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const colorField = (k, label, hint = '') => `<div class="field"><span>${label}</span>
    <div class="color-field"><input type="color" data-k="${k}" value="${esc(getPath(draft, k))}" aria-label="${label}"><input class="input ltr" data-k="${k}" value="${esc(getPath(draft, k))}" maxlength="7" aria-label="كود ${label}"></div>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const toggle = (k, label) => `<label class="switch"><input type="checkbox" data-k="${k}"${getPath(draft, k) ? ' checked' : ''}><span class="track"></span><span>${label}</span></label>`;

  const linkLimit = (key) => (key === 'menu' ? 20 : key === 'topLinks' ? 12 : 25);
  // قائمة روابط جاهزة: صفحات المتجر، الصفحات، قوائم المنتجات، وروابط التواصل
  const quickSelect = (key) => `<select class="select quick-add" data-quick="${key}" aria-label="أضف رابط جاهز">
      <option value="">+ أضف رابط جاهز…</option>
      <optgroup label="صفحات المتجر">${[['/', 'الرئيسية'], ['/account', 'حسابي'], ['/account', 'طلباتي'], ['/cart', 'سلة المشتريات'], ['/wishlist', 'المفضلة'], ['#footer', 'تواصل معنا']]
        .map(([u, l]) => `<option value="${esc(u)}|${esc(l)}">${esc(l)}</option>`).join('')}</optgroup>
      ${storePages.length ? `<optgroup label="الصفحات">${storePages.map((pg) => `<option value="/page/${esc(pg.slug)}|${esc(pg.title)}">${esc(pg.title)}${pg.visible ? '' : ' (مخفية)'}</option>`).join('')}</optgroup>` : ''}
      ${categories.length ? `<optgroup label="قوائم المنتجات">${categories.map((c) => `<option value="/category/${esc(c.id)}|${esc(c.name)}">${esc(c.name)}</option>`).join('')}</optgroup>` : ''}
      <optgroup label="تواصل (عدّل الرقم أو الإيميل بعد الإضافة)">
        <option value="https://wa.me/966500000000|واتساب">واتساب</option>
        <option value="mailto:info@example.com|الإيميل">إيميل</option>
        <option value="tel:+966500000000|اتصل بنا">رقم جوال</option>
        <option value="https://discord.gg/|الدسكورد">دسكورد</option>
      </optgroup>
    </select>`;

  const TABS = {
    identity: () => `
      ${input('storeName', 'اسم المتجر *', { max: 60 })}
      ${area('description', 'وصف المتجر', { max: 300, rows: 2, hint: 'يظهر عند مشاركة رابط المتجر وفي الفوتر' })}
      <div class="field"><span>الشعار في أعلى المتجر</span>
        <div class="seg">${[['both', 'صورة + نص'], ['image', 'صورة'], ['text', 'نص']].map(([k, l]) => `<label><input type="radio" name="logoMode" data-k="logoMode" value="${k}"${(draft.logoMode || 'image') === k ? ' checked' : ''}>${l}</label>`).join('')}</div></div>
      ${draft.logoMode !== 'image' ? `<div class="grid-2">${input('logoText', 'نص الشعار', { max: 40, hint: 'إذا تركته فاضي يظهر اسم المتجر' })}
        ${colorField('logoTextColor', 'لون النص')}</div>` : ''}
      ${imageFieldHtml('logo', draft.logo, draft.logoMode === 'text' ? 'صورة الشعار (تظهر في الفوتر وأيقونة المتصفح)' : 'صورة الشعار (يفضّل دائرية أو مربعة بخلفية شفافة)')}
      <div class="grid-2">
        <div class="stack">${colorField('primaryColor', 'اللون الأساسي', 'الأزرار والعناوين والشريط العلوي والفوتر')}
          <div class="swatches">${SWATCHES.map((c) => `<button type="button" data-swatch="${c}" aria-label="${c}" title="${c}"></button>`).join('')}</div></div>
        ${colorField('accentColor', 'اللون الثانوي (الذهبي)', 'الزخارف وشارات الخصم وشريط الإعلان')}
      </div>
      ${input('currency', 'رمز العملة', { max: 10, hint: 'مثال: ر.س أو SAR' })}`,
    home: () => `<div class="home-cta">
        <div class="stat-ic">${icon('home')}</div>
        <div class="stack">
          <h3 class="section-title">الصفحة الرئيسية صارت تتعدل بالمحرر</h3>
          <p class="help">نفس محرر صفحات «من نحن» و«سياسة الاسترجاع»: بنرات متحركة، واجهة ترحيبية، أقسام منتجات من أي قائمة، نصوص، صور وأزرار — ترتّبها بالسحب وتشوفها مثل ما تطلع للعملاء.</p>
          ${homePageId ? `<div><a class="btn btn-primary" href="/admin/pages/${esc(homePageId)}">${icon('edit', 'i-sm')}فتح محرر الصفحة الرئيسية</a></div>` : ''}
        </div></div>`,
    menus: () => `
      <h3 class="section-title">القائمة الرئيسية</h3>
      <p class="help">الروابط اللي تظهر جنب الشعار بأعلى المتجر. اكتب الاسم والرابط ورتّبها بالأسهم.</p>
      ${linkListHtml('menu', draft.menu)}
      ${quickSelect('menu')}
      <hr class="sep">
      <h3 class="section-title">الشريط العلوي</h3>
      <p class="help">الروابط الصغيرة في الشريط الغامق بأعلى الصفحة (مثل الدسكورد، تواصل معنا).</p>
      ${linkListHtml('topLinks', draft.topLinks, { urlPh: 'https://discord.gg/...' })}
      ${quickSelect('topLinks')}`,
    announce: () => `
      <p class="help">شريط ملوّن بأعلى كل صفحات المتجر — مناسب للعروض والتنبيهات.</p>
      ${toggle('announcement.enabled', 'إظهار شريط الإعلان')}
      ${input('announcement.text', 'نص الإعلان', { max: 200, ph: 'خصم 10% على جميع الحزم' })}
      ${input('announcement.link', 'رابط عند الضغط (اختياري)', { max: 500, dir: 'ltr', ph: '/category/...' })}`,
    footer: () => `
      ${toggle('footer.showBrand', 'إظهار عمود الشعار والنبذة')}
      ${area('footer.about', 'نبذة عن المتجر', { max: 500, rows: 3 })}
      <hr class="sep">
      <h3 class="section-title">أعمدة الفوتر</h3>
      <p class="help">كل عمود له عنوان وروابط (مثل «روابط مهمة»، «الأقسام»، «تواصل معنا»). أضف واحذف ورتّب الأعمدة والروابط — اكتب الاسم والرابط بس.</p>
      <div class="fcols">${draft.footer.columns.map((c, ci) => `<div class="fcol">
          <div class="fcol-head">
            <input class="input" data-li="footer.columns.${ci}.title" value="${esc(c.title)}" placeholder="عنوان العمود" maxlength="40" aria-label="عنوان العمود">
            <div class="btns">
              <button type="button" class="btn btn-ghost btn-icon btn-sm" data-col-mv="${ci}" data-d="-1" title="العمود لليمين" aria-label="العمود لليمين"${ci === 0 ? ' disabled' : ''}>${icon('chevR', 'i-sm')}</button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" data-col-mv="${ci}" data-d="1" title="العمود لليسار" aria-label="العمود لليسار"${ci === draft.footer.columns.length - 1 ? ' disabled' : ''}>${icon('chevL', 'i-sm')}</button>
              <button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-col-rm="${ci}" title="حذف العمود" aria-label="حذف العمود">${icon('trash', 'i-sm')}</button>
            </div>
          </div>
          ${linkListHtml(`footer.columns.${ci}.links`, c.links)}
          ${quickSelect(`footer.columns.${ci}.links`)}
        </div>`).join('')}</div>
      ${draft.footer.columns.length < 8 ? `<div><button type="button" class="btn btn-outline" data-add-col>${icon('plus', 'i-sm')}إضافة عمود</button></div>` : ''}
      <hr class="sep">
      ${input('footer.copyright', 'نص الحقوق (أسفل الفوتر)', { max: 120 })}
      <h3 class="section-title">حسابات التواصل الاجتماعي</h3>
      <p class="help">تظهر كأزرار تحت نبذة المتجر.</p>
      <div class="grid-2">${[['discord', 'Discord'], ['x', 'X (تويتر)'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['snapchat', 'Snapchat'], ['youtube', 'YouTube']]
        .map(([k, l]) => input(`social.${k}`, l, { max: 500, dir: 'ltr', ph: 'https://...' })).join('')}</div>`,
    payment: () => `
      ${toggle('payment.bankEnabled', 'الدفع بالتحويل البنكي')}
      <p class="help">لما يأكد العميل طلبه تظهر له بيانات الحساب البنكي، وبعد ما يحوّل يضغط "أكّدت التحويل" ويوصلك الطلب بحالة "بانتظار المراجعة". إذا قفلته، الطلبات توصلك مباشرة بانتظار المراجعة وتتواصل مع العميل للدفع.</p>
      <div class="grid-2">${input('payment.bankName', 'اسم البنك', { max: 60 })}${input('payment.accountName', 'اسم صاحب الحساب', { max: 80 })}</div>
      ${input('payment.iban', 'رقم الآيبان', { max: 40, dir: 'ltr', ph: 'SA00 0000 0000 0000 0000 0000' })}
      ${area('payment.instructions', 'تعليمات الدفع للعميل', { max: 600, rows: 3 })}`,
    verify: () => `
      ${toggle('whatsappVerify', 'تفعيل التحقق برمز واتساب للعملاء')}
      <p class="help">لما يكون مفعّل: يوصل العميل رمز من 6 أرقام على الواتساب عند إنشاء حساب جديد وعند كل تسجيل دخول، وما يكمل إلا بالرمز الصحيح. ويقدر يسترجع كلمة المرور بنفس الطريقة. الرمز صالح 5 دقايق، وفيه حماية من الإرسال المتكرر.</p>
      ${whatsappConfigured
        ? `<div class="alert ok">${icon('checkCircle', 'i-sm')}<div>ربط الواتساب شغّال — الرموز تنرسل فعلياً لجوالات العملاء.</div></div>`
        : `<div class="alert warn">${icon('alert', 'i-sm')}<div><b>الواتساب ما انربط للحين.</b> الرموز حالياً تطلع بس في نافذة تشغيل السيرفر (للتجربة). قبل ما تفتح المتجر للناس: اربط الواتساب، أو قفّل التحقق مؤقتاً.</div></div>
          <div class="form-section"><h4>طريقة الربط — WhatsApp Cloud API (الرسمي من Meta)</h4>
            <ol class="steps">
              <li>ادخل <b class="ltr">developers.facebook.com</b> وأنشئ تطبيق من نوع <b>Business</b> وأضف له منتج <b>WhatsApp</b>.</li>
              <li>أضف رقم جوال المتجر (رقم مو مستخدم في واتساب عادي) وانسخ <b class="ltr">Phone number ID</b>.</li>
              <li>من إعدادات النشاط التجاري أنشئ <b class="ltr">System User</b> وولّد له <b class="ltr">Access Token</b> دائم بصلاحية <span class="ltr">whatsapp_business_messaging</span>.</li>
              <li>من <b class="ltr">WhatsApp Manager ← Message templates</b> أنشئ قالب من نوع <b>Authentication</b> باللغة العربية وانتظر الموافقة.</li>
              <li>حط القيم في ملف <b class="ltr">.env</b> بمجلد المتجر وأعد تشغيله:</li>
            </ol>
            <pre class="code" dir="ltr">WHATSAPP_TOKEN=التوكن
WHATSAPP_PHONE_NUMBER_ID=رقم_المعرّف
WHATSAPP_TEMPLATE=اسم_القالب</pre>
          </div>`}`,
  };

  const renderTab = () => {
    $$('[data-tab]', el).forEach((b) => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
    body.innerHTML = TABS[tab]();
    $$('[data-swatch]', body).forEach((b) => { b.style.background = b.dataset.swatch; });
  };
  renderTab();

  $('.design-tabs', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'pages') { go('/admin/pages'); return; }
    tab = b.dataset.tab;
    history.replaceState(null, '', `/admin/design?tab=${tab}`);
    renderTab();
  });

  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) {
      const val = t.type === 'checkbox' ? t.checked : t.value;
      setPath(draft, t.dataset.k, val);
      if (/Color$/.test(t.dataset.k)) {
        $$(`[data-k="${t.dataset.k}"]`, body).forEach((x) => { if (x !== t && /^#[0-9a-f]{6}$/i.test(val)) x.value = val; });
      }
      markDirty();
    } else if (t.dataset.li) {
      setPath(draft, t.dataset.li, t.value);
      markDirty();
    }
  });
  body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-quick]') && t.value) {
      const cut = t.value.indexOf('|');
      const arr = getPath(draft, t.dataset.quick);
      if (arr.length >= linkLimit(t.dataset.quick)) { toast('وصلت للحد الأقصى', 'err'); t.value = ''; return; }
      arr.push({ label: t.value.slice(cut + 1), url: t.value.slice(0, cut) });
      markDirty();
      renderTab();
    } else if (t.type === 'checkbox' && t.dataset.k) {
      setPath(draft, t.dataset.k, t.checked);
      markDirty();
    } else if (t.type === 'radio' && t.dataset.k) {
      setPath(draft, t.dataset.k, t.value);
      markDirty();
      renderTab();
    }
  });
  body.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.swatch) {
      draft.primaryColor = t.dataset.swatch;
      markDirty();
      renderTab();
    } else if (t.dataset.mv) {
      const arr = getPath(draft, t.dataset.mv);
      const i = Number(t.dataset.i);
      const j = i + Number(t.dataset.d);
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      markDirty();
      renderTab();
    } else if (t.dataset.rmi) {
      getPath(draft, t.dataset.rmi).splice(Number(t.dataset.i), 1);
      markDirty();
      renderTab();
    } else if (t.dataset.addLink) {
      const arr = getPath(draft, t.dataset.addLink);
      if (arr.length >= linkLimit(t.dataset.addLink)) { toast('وصلت للحد الأقصى', 'err'); return; }
      arr.push({ label: '', url: '' });
      markDirty();
      renderTab();
      const inputs = $$(`[data-li^="${t.dataset.addLink}."]`, body);
      if (inputs.length >= 2) inputs[inputs.length - 2].focus();
    } else if (t.dataset.colMv !== undefined) {
      const cols = draft.footer.columns;
      const i = Number(t.dataset.colMv);
      const j = i + Number(t.dataset.d);
      if (j < 0 || j >= cols.length) return;
      [cols[i], cols[j]] = [cols[j], cols[i]];
      markDirty();
      renderTab();
    } else if (t.dataset.colRm !== undefined) {
      const col = draft.footer.columns[Number(t.dataset.colRm)];
      if (col.links.length && !(await confirmDialog(`حذف عمود "${col.title || 'بدون عنوان'}" وكل روابطه؟`, { ok: 'حذف', danger: true }))) return;
      draft.footer.columns.splice(Number(t.dataset.colRm), 1);
      markDirty();
      renderTab();
    } else if (t.hasAttribute('data-add-col')) {
      draft.footer.columns.push({ id: Math.random().toString(36).slice(2, 10), title: 'عمود جديد', links: [] });
      markDirty();
      renderTab();
      const ins = $$('.fcol-head input', body);
      if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); }
    } else if (t.dataset.pick) {
      const urls = await pickImages({ title: 'اختر صورة' });
      if (!urls) return;
      setPath(draft, t.dataset.pick, urls[0]);
      markDirty();
      renderTab();
    } else if (t.dataset.clear) {
      setPath(draft, t.dataset.clear, '');
      markDirty();
      renderTab();
    }
  });

  $('[data-save]', el).addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const r = await aapi('PUT', '/api/admin/settings', draft);
    draft = JSON.parse(JSON.stringify(r.settings));
    dirty = false;
    $('[data-dirty]', el).hidden = true;
    A.store = { ...A.store, name: r.settings.storeName, logo: r.settings.logo, currency: r.settings.currency };
    $$('[data-store-name]').forEach((x) => { x.textContent = A.store.name; });
    renderTab();
    reloadFrame();
    toast('تم حفظ التغييرات — المتجر تحدّث');
  }));
}
