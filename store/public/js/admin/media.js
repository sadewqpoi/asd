'use strict';
// لوحة التحكم — مكتبة الصور

// =====================================================================
//  مكتبة الصور
// =====================================================================
async function viewMedia(el, ctx) {
  let { media } = await aapi('GET', '/api/admin/media');
  if (ctx.stale()) return;
  el.innerHTML = `<label class="dropzone" data-drop>${icon('upload')}<strong>اسحب الصور هنا أو اضغط للرفع</strong>
      <span class="hint">JPG, PNG, WEBP, GIF — حتى 8 ميجا للصورة. الصور الكبيرة تتصغّر تلقائياً عشان المتجر يكون سريع.</span>
      <input type="file" multiple accept="${ACCEPT}" hidden data-file></label>
    <div class="progress" hidden><div></div></div>
    <h3 class="section-title mt" data-count></h3>
    <div data-grid></div>`;
  const grid = $('[data-grid]', el);
  const render = () => {
    $('[data-count]', el).innerHTML = `كل الصور <span class="muted">(${media.length})</span>`;
    grid.innerHTML = media.length
      ? `<div class="media-grid">${media.map((x) => `<div class="media-item">
          <a class="pic" href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.url)}" alt="" loading="lazy"></a>
          <div class="meta"><strong title="${esc(x.name)}">${esc(x.name)}</strong><span class="muted">${fmtSize(x.size)} · ${fmtDate(x.createdAt, false)}</span>
            ${x.usedIn.length ? `<span class="badge ok" title="${esc(x.usedIn.join('\n'))}">مستخدمة (${x.usedIn.length})</span>` : '<span class="badge">غير مستخدمة</span>'}</div>
          <div class="tools"><button type="button" class="btn btn-ghost btn-sm grow" data-copy="${esc(x.url)}">${icon('link', 'i-sm')}نسخ الرابط</button>
            ${can('media') ? `<button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-del="${esc(x.id)}" aria-label="حذف">${icon('trash', 'i-sm')}</button>` : ''}</div></div>`).join('')}</div>`
      : `<div class="card">${emptyHtml('image', 'ما فيه صور للحين', 'ارفع صور منتجاتك وبنراتك من فوق')}</div>`;
  };
  render();
  const upload = async (files) => {
    const up = await uploadFiles(files, $('.progress', el));
    media = [...up, ...media];
    render();
  };
  const file = $('[data-file]', el);
  file.addEventListener('change', async () => { if (file.files.length) await upload(file.files); file.value = ''; });
  const drop = $('[data-drop]', el);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  });
  grid.addEventListener('click', async (e) => {
    const cp = e.target.closest('[data-copy]');
    const del = e.target.closest('[data-del]');
    if (cp) copyText(location.origin + cp.dataset.copy);
    if (del) {
      const x = media.find((y) => y.id === del.dataset.del);
      const warn = x.usedIn.length ? `\n\nالصورة مستخدمة في: ${x.usedIn.join('، ')} — بتنشال من هناك.` : '';
      if (!(await confirmDialog(`حذف الصورة "${x.name}"؟${warn}`, { ok: 'حذف', danger: true, title: 'حذف صورة' }))) return;
      withBusy(null, async () => {
        await aapi('DELETE', `/api/admin/media/${encodeURIComponent(x.id)}`);
        media = media.filter((y) => y !== x);
        render();
        toast('تم حذف الصورة');
      });
    }
  });
}
