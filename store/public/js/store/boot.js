'use strict';
// واجهة المتجر — الهيدر والفوتر ونقطة التشغيل (لازم يكون آخر ملف)

// =====================================================================
//  الهيدر والفوتر
// =====================================================================
function renderChrome() {
  const s = S.settings;
  applyPrimary(s.primaryColor);
  applyAccent(s.accentColor);

  const ann = $('#announce');
  ann.hidden = !(s.announcement.enabled && s.announcement.text);
  ann.textContent = s.announcement.text;
  if (s.announcement.link) ann.setAttribute('href', safeUrl(s.announcement.link));
  else ann.removeAttribute('href');

  const links = (list) => list.map((l) => `<a ${linkAttrs(l.url)}>${esc(l.label)}</a>`).join('');
  $('#toplinks').innerHTML = links(s.topLinks);
  $('#mainnav').innerHTML = links(s.menu);
  $('#drawerNav').innerHTML = `${links(s.menu)}${s.topLinks.length ? `<p class="sub">روابط</p>${links(s.topLinks)}` : ''}<a href="/account">حسابي</a>`;
  $('#drawerTitle').textContent = s.storeName;

  // الشعار بالهيدر: صورة / نص / الاثنين (يتغير من تعديل المتجر ← الهوية)
  const mode = s.logoMode || 'image';
  const withText = mode !== 'image';
  const brandText = (withText && s.logoText) || s.storeName;
  const logo = $('#brandLogo');
  const brandName = $('#brandName');
  logo.hidden = mode === 'text' || !s.logo;
  if (s.logo) logo.src = s.logo;
  logo.alt = s.storeName;
  brandName.hidden = !(withText || !s.logo);
  brandName.textContent = brandText;
  brandName.classList.toggle('logo-text', withText);
  brandName.style.color = withText ? s.logoTextColor : '';
  $('#brand').setAttribute('aria-label', s.storeName);

  $('#menuBtn').innerHTML = icon('menu');
  $('#userBtn').innerHTML = icon('user');
  $('#cartIcon').innerHTML = icon('bag');
  $('#drawerClose').innerHTML = icon('x');

  const f = s.footer;
  const socials = [['discord', 'Discord'], ['x', 'X'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['snapchat', 'Snapchat'], ['youtube', 'YouTube']]
    .filter(([k]) => s.social[k]);
  const socialsHtml = socials.length ? `<div class="socials">${socials.map(([k, label]) => `<a ${linkAttrs(s.social[k])}>${label}</a>`).join('')}</div>` : '';
  // أيقونة صغيرة حسب نوع الرابط (إيميل، جوال، واتساب)
  const linkIcon = (u) => (/^mailto:/i.test(u) ? icon('mail', 'i-sm') : /^tel:/i.test(u) ? icon('phone', 'i-sm') : /wa\.me|whatsapp/i.test(u) ? icon('chat', 'i-sm') : '');
  const cols = (f.columns || []).filter((c) => c.links.length);
  const showBrand = f.showBrand !== false;
  $('#footer').innerHTML = `<div class="container footer-in${showBrand ? '' : ' no-brand'}">
      ${showBrand ? `<div><div class="fbrand">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : ''}<span class="${withText ? 'logo-text' : ''}">${esc(brandText)}</span></div>
        <p class="about">${esc(f.about || s.description)}</p>${socialsHtml}</div>` : ''}
      ${cols.map((c) => `<div>${c.title ? `<h4>${esc(c.title)}</h4>` : ''}<div class="flinks contact">${c.links.map((l) => `<a ${linkAttrs(l.url)}>${linkIcon(l.url)}<span dir="auto">${esc(l.label)}</span></a>`).join('')}</div></div>`).join('')}
    </div>
    <div class="container footer-bottom"><span>© ${new Date().getFullYear()} ${esc(s.storeName)} — ${esc(f.copyright)}</span>
      ${showBrand ? '' : socialsHtml}
      <span>${s.payment.bankEnabled ? 'طرق الدفع: تحويل بنكي' : ''}</span></div>`;
  $('.footer-in').style.setProperty('--cols', String(Math.max(1, cols.length)));
}

async function boot() {
  try {
    const [data, me] = await Promise.all([
      api('GET', '/api/store'),
      api('GET', '/api/auth/me').catch(() => ({ customer: null })),
    ]);
    S.settings = data.settings;
    S.categories = data.categories;
    S.me = me.customer;
  } catch (e) {
    $('#app').innerHTML = `<div class="card"><div class="empty"><h3>تعذر تحميل المتجر</h3><p>${esc(e.message)}</p></div></div>`;
    return;
  }
  renderChrome();
  renderUserMenu();
  updateCartBadge();
  refreshCart();

  document.addEventListener('click', onDocClick);
  window.addEventListener('popstate', route);
  // تحديث السلة لو تغيرت من تبويب ثاني
  window.addEventListener('storage', (e) => {
    if (e.key === 'cart') { S.cart = store.get('cart', []); refreshCart(); }
  });

  $('#userBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!S.me) return openAuthModal();
    $('#userMenu').hidden = !$('#userMenu').hidden;
    return undefined;
  });
  $('#menuBtn').addEventListener('click', () => { $('#drawer').hidden = false; });
  $('#drawerClose').addEventListener('click', () => { $('#drawer').hidden = true; });
  $('#drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') $('#drawer').hidden = true; });
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#searchForm input').value.trim();
    go(`/search?q=${encodeURIComponent(q)}`);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlays();
  });

  route();
}

boot();
