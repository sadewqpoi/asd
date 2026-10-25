'use strict';
// واجهة المتجر — السلة وإتمام الطلب وصفحة الطلب

function cartLineHtml(l) {
  const id = esc(l.id);
  return `<div class="cline${l.inStock ? '' : ' out'}">
    <a class="cline-img" href="/product/${id}">${l.image ? `<img src="${esc(l.image)}" alt="">` : `<div class="noimg">${icon('image')}</div>`}</a>
    <div>
      <a class="cline-name" href="/product/${id}">${esc(l.name)}</a>
      <div class="small muted row">${money(l.unitPrice)}${l.unitPrice < l.price ? `<del>${money(l.price)}</del>` : ''}</div>
      ${l.inStock ? '' : '<span class="badge danger">نفدت الكمية — احذفه من السلة</span>'}
    </div>
    <div class="cline-side">
      <strong>${money(l.lineTotal)}</strong>
      <div class="row">
        ${l.inStock ? `<div class="qty sm">
          <button type="button" data-cq="1" data-id="${id}" aria-label="زيادة"${l.qty >= l.max ? ' disabled' : ''}>${icon('plus', 'i-sm')}</button>
          <input value="${l.qty}" readonly aria-label="الكمية" class="num">
          <button type="button" data-cq="-1" data-id="${id}" aria-label="نقص"${l.qty <= 1 ? ' disabled' : ''}>${icon('minus', 'i-sm')}</button></div>` : ''}
        <button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-rm="${id}" aria-label="حذف">${icon('trash', 'i-sm')}</button>
      </div>
    </div>
  </div>`;
}

function renderCart(app, q) {
  if (!q.lines.length) {
    app.innerHTML = `<h1 class="page-title">سلة المشتريات</h1>
      <div class="card">${emptyHtml('bag', 'السلة فاضية', 'تصفح المنتجات وأضف اللي يعجبك')}<div class="center-row"><a class="btn btn-primary" href="/">تصفح المنتجات</a></div></div>`;
    return;
  }
  app.innerHTML = `<h1 class="page-title">سلة المشتريات <span class="muted small">(${q.count} منتج)</span></h1>
    <div class="cart-layout">
      <div class="card cart-lines">${q.lines.map(cartLineHtml).join('')}</div>
      <aside class="card summary">
        <h3>ملخص الطلب</h3>
        <div class="sum-row"><span>مجموع المنتجات</span>${money(q.subtotal)}</div>
        <div class="sum-row total"><span>الإجمالي</span>${money(q.subtotal)}</div>
        ${q.count ? '<a class="btn btn-primary btn-lg btn-block" href="/checkout">إتمام الطلب</a>' : '<button class="btn btn-primary btn-lg btn-block" disabled>إتمام الطلب</button>'}
        <a class="btn btn-ghost btn-block" href="/">مواصلة التسوق</a>
      </aside>
    </div>`;
  const rerender = async () => renderCart(app, await saveCart());
  $$('[data-cq]', app).forEach((b) => b.addEventListener('click', () => {
    const it = S.cart.find((x) => x.id === b.dataset.id);
    if (!it) return;
    it.qty = Math.min(99, Math.max(1, it.qty + Number(b.dataset.cq)));
    rerender();
  }));
  $$('[data-rm]', app).forEach((b) => b.addEventListener('click', () => {
    S.cart = S.cart.filter((x) => x.id !== b.dataset.rm);
    rerender();
  }));
}

async function viewCart(app, ctx) {
  setTitle('سلة المشتريات');
  const q = await refreshCart();
  if (ctx.stale()) return;
  renderCart(app, q);
}

async function viewCheckout(app, ctx) {
  setTitle('إتمام الطلب');
  const q = await refreshCart();
  if (ctx.stale()) return;
  const lines = q.lines.filter((l) => l.inStock);
  if (!lines.length) return go('/cart', { replace: true });
  if (!S.me) return loginRequired(app, 'سجّل دخولك أو أنشئ حساب عشان تكمل طلبك');
  const pay = S.settings.payment;
  app.innerHTML = `${crumbs([['السلة', '/cart'], ['إتمام الطلب']])}
    <h1 class="page-title">إتمام الطلب</h1>
    <div class="cart-layout">
      <div>
        <div class="card box">
          <h3>بيانات العميل</h3>
          <div class="row wrap"><strong>${esc(S.me.name)}</strong><span class="muted ltr">${esc(S.me.email || S.me.phone)}</span></div>
        </div>
        <div class="card box">
          <h3>طريقة الدفع</h3>
          <div class="pay-option">${icon('bank')}<div><strong>${pay.bankEnabled ? 'تحويل بنكي' : 'الدفع بعد مراجعة الطلب'}</strong>
            <p class="small muted">${pay.bankEnabled ? 'بتظهر لك بيانات الحساب البنكي بعد تأكيد الطلب.' : 'بنتواصل معك لإتمام الدفع بعد مراجعة طلبك.'}</p></div></div>
        </div>
        <div class="card box">
          <h3>ملاحظات على الطلب <span class="muted small">(اختياري)</span></h3>
          <textarea class="textarea" data-note maxlength="500" placeholder="مثال: تغليف المنتج بطريقة جيدة الخ."></textarea>
        </div>
      </div>
      <aside class="card summary">
        <h3>ملخص الطلب</h3>
        ${lines.map((l) => `<div class="sum-row"><span>${esc(l.name)} <span class="num">× ${l.qty}</span></span>${money(l.lineTotal)}</div>`).join('')}
        <div class="sum-row total"><span>الإجمالي</span>${money(q.subtotal)}</div>
        <button class="btn btn-primary btn-lg btn-block" data-place>تأكيد الطلب</button>
      </aside>
    </div>`;
  $('[data-place]', app).addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const { order } = await api('POST', '/api/orders', { items: lines.map((l) => ({ id: l.id, qty: l.qty })), note: $('[data-note]', app).value });
    S.cart = S.cart.filter((x) => !lines.some((l) => l.id === x.id));
    saveCart();
    toast('تم إنشاء طلبك بنجاح');
    go(`/account/orders/${order.id}`);
  }));
}

function bankHtml(o) {
  const b = o.bank;
  const rows = [['اسم البنك', b.bankName], ['اسم صاحب الحساب', b.accountName], ['رقم الآيبان', b.iban], ['المبلغ', `${fmtNum(o.total)} ${S.settings.currency}`], ['رقم الطلب', `#${o.id}`]]
    .filter(([, v]) => v);
  return `<div class="card box">
    <h3>${icon('bank', 'i-sm')} بيانات التحويل</h3>
    ${b.iban ? '' : '<div class="alert warn">بيانات الحساب البنكي ما انضافت بعد — تواصل معنا لإتمام الدفع.</div>'}
    <div class="bank">${rows.map(([k, v]) => `<div class="bank-row"><div><span>${esc(k)}</span><br><strong dir="auto">${esc(v)}</strong></div><button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${esc(v)}" aria-label="نسخ">${icon('copy', 'i-sm')}</button></div>`).join('')}</div>
    ${b.instructions ? `<p class="small muted gap-t">${esc(b.instructions)}</p>` : ''}
    <form class="stack gap-t" data-paid>
      <label class="field"><span>اسم المحوّل أو رقم العملية</span><input class="input" name="reference" required maxlength="120"></label>
      <button class="btn btn-primary btn-block" type="submit">أكّدت التحويل</button>
    </form>
    <button type="button" class="btn btn-danger-ghost btn-block gap-t" data-cancel>إلغاء الطلب</button>
  </div>`;
}

async function viewOrder(app, ctx) {
  setTitle('تفاصيل الطلب');
  if (!S.me) return loginRequired(app, 'سجّل دخولك عشان تشوف طلبك');
  const { order: o } = await api('GET', `/api/my/orders/${encodeURIComponent(ctx.params[0])}`);
  if (ctx.stale()) return;
  setTitle(`طلب #${o.id}`);
  app.innerHTML = `${crumbs([['طلباتي', '/account'], [`طلب #${o.id}`]])}
    <div class="order-head"><div><h1 class="page-title tight">طلب <span class="num">#${o.id}</span></h1><p class="small muted">${fmtDate(o.createdAt)}</p></div>
      <span class="badge ${STATUS_CLASS[o.status] || ''}">${esc(o.statusLabel)}</span></div>
    <div class="order-grid">
      <div>
        <div class="card cart-lines">${o.items.map((it) => `<div class="cline">
          <a class="cline-img" href="/product/${esc(it.productId)}">${it.image ? `<img src="${esc(it.image)}" alt="">` : `<div class="noimg">${icon('image')}</div>`}</a>
          <div><a class="cline-name" href="/product/${esc(it.productId)}">${esc(it.name)}</a><div class="small muted">${money(it.unitPrice)} <span class="num">× ${it.qty}</span></div></div>
          <div class="cline-side"><strong>${money(it.total)}</strong></div></div>`).join('')}</div>
        <div class="card box"><div class="sum-row total"><span>الإجمالي</span>${money(o.total)}</div></div>
        ${o.note ? `<div class="card box"><h3>ملاحظاتك</h3><p class="desc-plain">${esc(o.note)}</p></div>` : ''}
      </div>
      <div>
        ${o.bank ? bankHtml(o) : ''}
        ${o.status === 'under_review' ? `<div class="card box"><div class="alert info">${icon('clock', 'i-sm')}<div>استلمنا تأكيد التحويل${o.reference ? ` (${esc(o.reference)})` : ''} — طلبك قيد المراجعة.</div></div></div>` : ''}
        <div class="card box"><h3>حالة الطلب</h3><div class="timeline">${[...o.history].reverse().map((h) => `<div class="tl"><span class="tl-dot"></span><div><strong>${esc(STATUS_LABELS[h.status] || h.status)}</strong><div class="small muted">${fmtDate(h.at)}</div></div></div>`).join('')}</div></div>
      </div>
    </div>`;
  $$('[data-copy]', app).forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)));
  const paid = $('[data-paid]', app);
  if (paid) {
    paid.addEventListener('submit', (e) => {
      e.preventDefault();
      withBusy(paid.querySelector('button'), async () => {
        await api('POST', `/api/my/orders/${o.id}/paid`, formData(paid));
        toast('تم إرسال تأكيد التحويل');
        route();
      });
    });
    $('[data-cancel]', app).addEventListener('click', async (e) => {
      if (!(await confirmDialog('متأكد تبي تلغي الطلب؟', { ok: 'إلغاء الطلب', danger: true }))) return;
      withBusy(e.target, async () => {
        await api('POST', `/api/my/orders/${o.id}/cancel`);
        toast('تم إلغاء الطلب');
        route();
      });
    });
  }
}
