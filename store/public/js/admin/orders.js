'use strict';
// لوحة التحكم — الطلبات

// =====================================================================
//  الطلبات
// =====================================================================
async function openOrder(id, onChange) {
  const { order: o } = await aapi('GET', `/api/admin/orders/${encodeURIComponent(id)}`);
  const digits = (o.customer.phone || '').replace(/\D/g, '');
  const m = openModal({
    title: `طلب #${o.id}`,
    size: 'lg',
    body: `<div class="grid-2 align-start">
      <div class="stack">
        <div class="form-section"><h4>المنتجات</h4>
          <div class="order-items">${o.items.map((it) => `<div>${thumb(it.image)}<div class="grow"><strong>${esc(it.name)}</strong><div class="small muted">${money(it.unitPrice)} × <span class="num">${it.qty}</span></div></div><strong>${money(it.total)}</strong></div>`).join('')}</div>
          <div class="row mt"><span class="grow muted">الإجمالي</span><strong>${money(o.total)}</strong></div></div>
        ${o.note ? `<div class="form-section"><h4>ملاحظة العميل</h4><p class="pre">${esc(o.note)}</p></div>` : ''}
        ${o.reference ? `<div class="form-section"><h4>تأكيد التحويل من العميل</h4><p>${esc(o.reference)}</p></div>` : ''}
      </div>
      <div class="stack">
        <div class="form-section"><h4>العميل</h4>
          <dl class="kv"><dt>الاسم</dt><dd>${esc(o.customer.name)}</dd>
            ${o.customer.email ? `<dt>الإيميل</dt><dd class="ltr">${esc(o.customer.email)}</dd>` : ''}
            ${o.customer.phone ? `<dt>الجوال</dt><dd class="ltr">${esc(o.customer.phone)}</dd>` : ''}
            <dt>التاريخ</dt><dd>${fmtDate(o.createdAt)}</dd></dl>
          <div class="row wrap mt">
            ${digits ? `<a class="btn btn-outline btn-sm" href="https://wa.me/${digits}" target="_blank" rel="noopener">${icon('chat', 'i-sm')}واتساب</a>` : ''}
            ${o.customer.email ? `<a class="btn btn-outline btn-sm" href="mailto:${esc(o.customer.email)}">${icon('mail', 'i-sm')}إيميل</a>` : ''}
          </div></div>
        <div class="form-section"><h4>حالة الطلب</h4>
          <select class="select" name="status"${o.status === 'cancelled' ? ' disabled' : ''}>${Object.entries(A.statuses).map(([k, l]) => `<option value="${k}"${k === o.status ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          ${o.status === 'cancelled' ? '<p class="hint mt">الطلب ملغي وما تقدر تغيّر حالته.</p>' : ''}
          <label class="field mt"><span>ملاحظة داخلية <span class="muted">(ما يشوفها العميل)</span></span><textarea class="textarea" name="adminNote" maxlength="1000" rows="3">${esc(o.adminNote)}</textarea></label>
          <div class="timeline-mini mt">${[...o.history].reverse().map((h) => `<div><b>${esc(A.statuses[h.status] || h.status)}</b><span class="muted small">${fmtDate(h.at)} — ${esc(h.by)}</span></div>`).join('')}</div>
        </div>
      </div></div>`,
    foot: '<button class="btn btn-primary" data-save>حفظ التغييرات</button><button class="btn btn-outline" data-close>إغلاق</button>',
  });
  $('[data-save]', m.el).addEventListener('click', async (e) => {
    const status = $('[name=status]', m.el).value;
    if (status === 'cancelled' && o.status !== 'cancelled'
      && !(await confirmDialog('إلغاء الطلب يرجّع الكميات للمخزون وما تقدر تتراجع عنه. متأكد؟', { ok: 'إلغاء الطلب', danger: true }))) return;
    withBusy(e.target, async () => {
      await aapi('PUT', `/api/admin/orders/${o.id}`, { status, adminNote: $('[name=adminNote]', m.el).value });
      toast('تم حفظ الطلب');
      m.close();
      refreshOrdersBadge();
      if (onChange) onChange();
    });
  });
}

async function viewOrders(el, ctx) {
  const params = new URLSearchParams(location.search);
  let status = params.get('status') || '';
  let q = '';
  el.innerHTML = `<div class="pills" data-pills></div>
    <div class="toolbar"><div class="search">${icon('search')}<input class="input" placeholder="ابحث برقم الطلب أو اسم العميل أو الجوال" data-q></div></div>
    <div class="card" data-list>${LOADING}</div>`;
  const load = async () => {
    const data = await aapi('GET', `/api/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    if (ctx.stale()) return;
    const pills = [['', 'الكل', data.counts.all], ...Object.entries(A.statuses).map(([k, l]) => [k, l, data.counts[k]])];
    $('[data-pills]', el).innerHTML = pills.map(([k, l, n]) => `<button type="button" data-st="${k}" class="${k === status ? 'on' : ''}">${esc(l)} <span class="n num">${n}</span></button>`).join('');
    $('[data-list]', el).innerHTML = data.orders.length
      ? `<div class="table-wrap"><table class="t"><thead><tr><th>رقم الطلب</th><th>العميل</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
        ${data.orders.map((o) => `<tr class="click" data-open="${o.id}" tabindex="0"><td><strong class="num">#${o.id}</strong></td>
          <td><strong>${esc(o.customer.name)}</strong><div class="small muted ltr">${esc(o.customer.phone || o.customer.email)}</div></td>
          <td class="num">${o.count}</td><td class="nowrap">${money(o.total)}</td>
          <td><span class="badge ${STATUS_CLASS[o.status]}">${esc(A.statuses[o.status])}</span>${o.reference && o.status === 'under_review' ? `<div class="small muted">${icon('check', 'i-sm')} أكّد التحويل</div>` : ''}</td>
          <td class="small muted nowrap">${fmtDate(o.createdAt)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyHtml('receipt', q || status ? 'ما فيه طلبات مطابقة' : 'ما فيه طلبات للحين', q || status ? '' : 'أول ما يطلب عميل بيظهر طلبه هنا');
  };
  $('[data-pills]', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    status = b.dataset.st;
    history.replaceState(null, '', status ? `/admin/orders?status=${status}` : '/admin/orders');
    load();
  });
  $('[data-q]', el).addEventListener('input', debounce((e) => { q = e.target.value.trim(); load(); }));
  const list = $('[data-list]', el);
  const openRow = (tr) => withBusy(null, () => openOrder(tr.dataset.open, load));
  list.addEventListener('click', (e) => { const tr = e.target.closest('[data-open]'); if (tr) openRow(tr); });
  list.addEventListener('keydown', (e) => { const tr = e.target.closest('[data-open]'); if (tr && e.key === 'Enter') openRow(tr); });
  await load();
  const open = params.get('open');
  if (open && !ctx.stale()) {
    history.replaceState(null, '', '/admin/orders');
    withBusy(null, () => openOrder(open, load));
  }
}
