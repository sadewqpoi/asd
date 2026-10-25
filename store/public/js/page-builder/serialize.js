'use strict';
// محرر الصفحات — تحويل محتوى المحرر (HTML) إلى بيانات منظمة

// =====================================================================
//  تحويل محتوى المحرر (HTML) إلى بيانات منظمة — اللي يتخزن هو البيانات بس
// =====================================================================
function cssColorToHex(c) {
  c = String(c || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(c);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return '';
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
}

function cssFontSize(fs) {
  if (!fs) return undefined;
  if (fs === 'x-small' || fs === 'xx-small' || fs === 'small' || fs === 'smaller') return 'sm';
  if (fs === 'large' || fs === 'larger') return 'lg';
  if (/x+-large/.test(fs)) return 'xl';
  const px = parseFloat(fs);
  if (fs.endsWith('px') && px) return px < 14 ? 'sm' : px >= 26 ? 'xl' : px >= 19 ? 'lg' : undefined;
  if (fs.endsWith('em') && px) return px < 0.95 ? 'sm' : px >= 1.5 ? 'xl' : px >= 1.15 ? 'lg' : undefined;
  return undefined;
}

// نقرأ التنسيق من نص الـ style نفسه، لأن سياسة الأمان (CSP) تمنع المتصفح يطبّق style المكتوب داخل HTML
function styleDecls(el) {
  const out = {};
  const raw = el.getAttribute && el.getAttribute('style');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim().replace(/\s*!important$/i, '');
    if (k && val) out[k] = val;
  }
  return out;
}

// يطبّق التنسيق اللي يضيفه شريط الأدوات عبر CSSOM (مسموح) عشان يبان مباشرة أثناء الكتابة
function materializeStyles(root) {
  root.querySelectorAll('[style]').forEach((el) => {
    const d = styleDecls(el);
    for (const [k, val] of Object.entries(d)) el.style.setProperty(k, val);
  });
}

const PB_BLOCK_TAGS = /^(P|DIV|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|UL|OL|LI|SECTION|ARTICLE|HEADER|FOOTER|PRE|TABLE|FIGURE)$/;
const MARK_KEYS = ['b', 'i', 'u', 's', 'color', 'bg', 'size', 'href'];

function cleanInlines(list) {
  const out = [];
  for (const n of list) {
    for (const k of MARK_KEYS) if (n[k] === undefined || n[k] === false || n[k] === '') delete n[k];
    if (!n.text) continue;
    const prev = out[out.length - 1];
    if (prev && MARK_KEYS.every((k) => prev[k] === n[k])) prev.text += n.text;
    else out.push(n);
  }
  const last = out[out.length - 1];
  if (last && last.text.endsWith('\n')) {
    last.text = last.text.slice(0, -1);
    if (!last.text) out.pop();
  }
  return out;
}

function htmlToRich(root) {
  const blocks = [];
  let loose = null; // نص خارج أي فقرة
  const flushLoose = () => {
    if (loose) {
      loose.children = cleanInlines(loose.children);
      if (loose.children.length) blocks.push(loose);
      loose = null;
    }
  };
  const alignOf = (el) => {
    const raw = styleDecls(el)['text-align'] || el.getAttribute('align') || ([...el.classList].find((c) => c.startsWith('ta-')) || '').slice(3);
    return { center: 'center', left: 'left', justify: 'justify', right: 'right', end: 'left' }[raw];
  };
  const walkInline = (node, marks, out) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue.replace(/​/g, '');
      if (t) out.push({ text: t, ...marks });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'BR') { out.push({ text: '\n', ...marks }); return; }
    if (/^(SCRIPT|STYLE|IMG|SVG|BUTTON|INPUT|TEXTAREA|SELECT|IFRAME|OBJECT|VIDEO|AUDIO)$/.test(tag)) return;
    const m = { ...marks };
    if (tag === 'B' || tag === 'STRONG') m.b = true;
    if (tag === 'I' || tag === 'EM') m.i = true;
    if (tag === 'U') m.u = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') m.s = true;
    if (tag === 'A' && node.getAttribute('href')) m.href = node.getAttribute('href');
    if (tag === 'FONT') {
      if (node.getAttribute('color')) m.color = cssColorToHex(node.getAttribute('color')) || m.color;
      const sz = Number(node.getAttribute('size'));
      if (sz) m.size = sz <= 2 ? 'sm' : sz >= 5 ? 'xl' : sz === 4 ? 'lg' : undefined;
    }
    const st = styleDecls(node);
    if (st['font-weight'] === 'bold' || st['font-weight'] === 'bolder' || Number(st['font-weight']) >= 600) m.b = true;
    if (st['font-weight'] === 'normal' || Number(st['font-weight']) === 400) delete m.b;
    if (st['font-style'] === 'italic') m.i = true;
    const td = `${st['text-decoration-line'] || ''} ${st['text-decoration'] || ''}`;
    if (td.includes('underline')) m.u = true;
    if (td.includes('line-through')) m.s = true;
    if (st.color) m.color = cssColorToHex(st.color) || m.color;
    const bgc = st['background-color'] || st.background;
    if (bgc) m.bg = cssColorToHex(bgc) || m.bg;
    const fs = cssFontSize(st['font-size']);
    if (fs) m.size = fs;
    const szc = [...node.classList].find((c) => /^sz-(sm|lg|xl)$/.test(c));
    if (szc) m.size = szc.slice(3);
    for (const ch of node.childNodes) walkInline(ch, m, out);
  };
  const walkBlock = (node) => {
    if (node.nodeType === 3 || (node.nodeType === 1 && !PB_BLOCK_TAGS.test(node.tagName))) {
      if (node.nodeType === 3 && !node.nodeValue.trim() && !loose) return;
      if (!loose) loose = { type: 'p', children: [] };
      walkInline(node, {}, loose.children);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'UL' || tag === 'OL') {
      flushLoose();
      const items = [];
      for (const li of node.children) {
        if (li.tagName !== 'LI') continue;
        const out = [];
        for (const ch of li.childNodes) walkInline(ch, {}, out);
        items.push(cleanInlines(out));
      }
      if (items.length) blocks.push({ type: tag.toLowerCase(), align: alignOf(node), items });
      return;
    }
    if ([...node.children].some((c) => PB_BLOCK_TAGS.test(c.tagName))) {
      flushLoose();
      for (const ch of node.childNodes) walkBlock(ch);
      flushLoose();
      return;
    }
    flushLoose();
    const type = tag === 'H1' || tag === 'H2' ? 'h2' : tag === 'H3' ? 'h3' : /^H[4-6]$/.test(tag) ? 'h4' : tag === 'BLOCKQUOTE' ? 'blockquote' : 'p';
    const out = [];
    for (const ch of node.childNodes) walkInline(ch, {}, out);
    blocks.push({ type, align: alignOf(node), children: cleanInlines(out) });
  };
  for (const ch of root.childNodes) walkBlock(ch);
  flushLoose();
  for (const b of blocks) if (!b.align || b.align === 'right') delete b.align;
  return blocks;
}
