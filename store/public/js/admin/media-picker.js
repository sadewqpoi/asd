'use strict';
// لوحة التحكم — رفع الصور ونافذة اختيار الصور

// =====================================================================
//  رفع الصور ومكتبة الصور
// =====================================================================
const readAsDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('تعذر قراءة الملف'));
  r.readAsDataURL(blob);
});

// نصغّر الصور الكبيرة قبل الرفع عشان المتجر يكون سريع
async function prepareImage(file) {
  if (!IMG_TYPES.includes(file.type)) throw new Error(`"${file.name}": نوع غير مدعوم — استخدم JPG أو PNG أو WEBP أو GIF`);
  const MAX = 1920;
  if (file.type !== 'image/gif') {
    let bmp = null;
    try { bmp = await createImageBitmap(file); } catch { /* نرفعها كما هي */ }
    if (bmp && (file.size > 1.5 * 1024 * 1024 || bmp.width > MAX || bmp.height > MAX)) {
      const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.88));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
      if (blob && blob.size < file.size) {
        if (blob.size > MAX_BYTES) throw new Error(`"${file.name}": الصورة كبيرة جداً`);
        return { name: file.name, data: await readAsDataURL(blob) };
      }
    }
  }
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}": حجم الصورة أكبر من 8 ميجا`);
  return { name: file.name, data: await readAsDataURL(file) };
}

async function uploadFiles(files, progressEl) {
  const list = [...files];
  const out = [];
  const bar = progressEl ? progressEl.firstElementChild : null;
  if (progressEl) { progressEl.hidden = false; bar.style.width = '4%'; }
  for (let i = 0; i < list.length; i++) {
    try {
      const r = await aapi('POST', '/api/admin/media', await prepareImage(list[i]));
      out.push(r.media);
    } catch (e) {
      toast(e.message, 'err');
    }
    if (bar) bar.style.width = `${Math.round(((i + 1) / list.length) * 100)}%`;
  }
  if (progressEl) setTimeout(() => { progressEl.hidden = true; }, 400);
  if (out.length) toast(out.length === 1 ? 'تم رفع الصورة' : `تم رفع ${out.length} صور`);
  return out;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

// نافذة اختيار صورة من المكتبة (أو رفع جديدة)
function pickImages({ multiple = false, title } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const selected = new Set();
    let media = [];
    const m = openModal({
      title: title || (multiple ? 'اختر الصور' : 'اختر صورة'),
      size: 'lg',
      body: `<div class="toolbar">
          <button type="button" class="btn btn-primary" data-up>${icon('upload')}رفع ${multiple ? 'صور' : 'صورة'} من جهازك</button>
          <input type="file" accept="${ACCEPT}" ${multiple ? 'multiple' : ''} hidden data-file>
          <span class="hint">أو اختر من الصور المرفوعة سابقاً</span></div>
        <div class="progress" hidden><div></div></div>
        <div data-grid class="mt">${LOADING}</div>`,
      foot: multiple ? '<button class="btn btn-primary" data-choose disabled>اختيار</button><button class="btn btn-outline" data-close>إلغاء</button>' : '',
      onClose: () => resolve(result),
    });
    const grid = $('[data-grid]', m.el);
    const choose = $('[data-choose]', m.el);
    const finish = (urls) => { result = urls; m.close(); };
    const render = () => {
      grid.innerHTML = media.length
        ? `<div class="picker-grid">${media.map((x) => `<button type="button" class="pick${selected.has(x.url) ? ' on' : ''}" data-url="${esc(x.url)}" title="${esc(x.name)}"><img src="${esc(x.url)}" alt="" loading="lazy"><span class="ck">${icon('check')}</span></button>`).join('')}</div>`
        : emptyHtml('image', 'مكتبة الصور فاضية', 'ارفع أول صورة من جهازك');
      if (choose) {
        choose.disabled = !selected.size;
        choose.textContent = selected.size ? `اختيار (${selected.size})` : 'اختيار';
      }
    };
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-url]');
      if (!b) return;
      if (!multiple) { finish([b.dataset.url]); return; }
      if (selected.has(b.dataset.url)) selected.delete(b.dataset.url);
      else selected.add(b.dataset.url);
      render();
    });
    if (choose) choose.addEventListener('click', () => finish([...selected]));
    const file = $('[data-file]', m.el);
    $('[data-up]', m.el).addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files.length) return;
      const up = await uploadFiles(file.files, $('.progress', m.el));
      file.value = '';
      if (!up.length) return;
      if (!multiple) { finish([up[0].url]); return; }
      media = [...up, ...media];
      up.forEach((x) => selected.add(x.url));
      render();
    });
    aapi('GET', '/api/admin/media').then((r) => { media = r.media; render(); }).catch((e) => { grid.innerHTML = emptyHtml('alert', 'تعذر تحميل الصور', e.message); });
  });
}
