'use strict';
// محرر الصفحات — شريط التنسيق

// =====================================================================
//  المحرر
// =====================================================================
function rtToolbarHtml() {
  const b = (cmd, ic, title) => `<button type="button" data-cmd="${cmd}" title="${title}" aria-label="${title}">${icon(ic)}</button>`;
  return `<select class="select" data-block-style aria-label="نوع النص" title="نوع النص">
      <option value="p">نص عادي</option><option value="h2">عنوان كبير</option><option value="h3">عنوان متوسط</option><option value="h4">عنوان صغير</option><option value="blockquote">اقتباس</option>
    </select>
    <select class="select" data-font-size aria-label="حجم الخط" title="حجم الخط">
      <option value="">الحجم</option><option value="2">صغير</option><option value="3">عادي</option><option value="5">كبير</option><option value="6">كبير جداً</option>
    </select>
    <span class="sep"></span>
    ${b('bold', 'bold', 'عريض (Ctrl+B)')}${b('italic', 'italic', 'مائل (Ctrl+I)')}${b('underline', 'underline', 'تحته خط (Ctrl+U)')}${b('strikeThrough', 'strike', 'يتوسطه خط')}
    <span class="sep"></span>
    <label class="rt-color" title="لون النص">${icon('textColor')}<input type="color" data-color="foreColor" value="#0f4c52" aria-label="لون النص"></label>
    <label class="rt-color" title="لون التظليل">${icon('highlighter')}<input type="color" data-color="hiliteColor" value="#f3e5c4" aria-label="لون التظليل"></label>
    <span class="sep"></span>
    ${b('justifyRight', 'alignRight', 'محاذاة لليمين')}${b('justifyCenter', 'alignCenter', 'توسيط')}${b('justifyLeft', 'alignLeft', 'محاذاة لليسار')}${b('justifyFull', 'alignJustify', 'ضبط')}
    <span class="sep"></span>
    ${b('insertUnorderedList', 'listUl', 'قائمة نقطية')}${b('insertOrderedList', 'listOl', 'قائمة مرقمة')}
    <span class="sep"></span>
    ${b('link', 'link', 'إضافة رابط')}${b('unlink', 'unlink', 'إزالة الرابط')}${b('removeFormat', 'eraser', 'مسح التنسيق')}`;
}

function promptLink() {
  return new Promise((resolve) => {
    let val = null;
    const m = openModal({
      title: 'إضافة رابط',
      size: 'sm',
      body: `<form class="stack" novalidate><label class="field"><span>الرابط</span><input class="input ltr" name="url" placeholder="/page/terms أو https://..." autocomplete="off"></label>
        <small class="hint">روابط المتجر تبدأ بـ / (مثل /category/... أو /page/...) والروابط الخارجية بـ https://</small></form>`,
      foot: '<button class="btn btn-primary" data-ok>إضافة</button><button class="btn btn-outline" data-close>إلغاء</button>',
      onClose: () => resolve(val),
    });
    const input = $('[name=url]', m.el);
    const ok = () => {
      const u = input.value.trim();
      if (!u || safeUrl(u) === '#') { toast('الرابط لازم يبدأ بـ / أو https://', 'err'); return; }
      val = u;
      m.close();
    };
    $('[data-ok]', m.el).addEventListener('click', ok);
    $('form', m.el).addEventListener('submit', (e) => { e.preventDefault(); ok(); });
  });
}
