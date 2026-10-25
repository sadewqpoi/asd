'use strict';
// تقديم الملفات الثابتة وصفحات HTML
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('../config');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const UPLOAD_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function notFound(res) {
  if (res.headersSent) return;
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — الصفحة غير موجودة');
}

function serveFile(req, res, root, rel, { immutable = false, uploads = false } = {}) {
  const full = path.resolve(root, '.' + path.posix.normalize('/' + rel));
  if (!full.startsWith(root + path.sep)) return notFound(res);
  const ext = path.extname(full).toLowerCase();
  const type = MIME[ext];
  if (!type || (uploads && !UPLOAD_EXT.has(ext))) return notFound(res);
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full).on('error', () => res.destroy()).pipe(res);
  });
}

// صفحات HTML: نحط اسم المتجر ووصفه وشعاره من الإعدادات (عشان المعاينة بالواتساب وغيره)
function serveHtml(req, res, file, db) {
  fs.readFile(path.join(PUBLIC_DIR, file), 'utf8', (err, html) => {
    if (err) return notFound(res);
    const s = db.data.settings;
    const out = html
      .replace(/__STORE_NAME__/g, escHtml(s.storeName))
      .replace(/__STORE_DESC__/g, escHtml(s.description))
      .replace(/__STORE_LOGO__/g, escHtml(s.logo || '/img/logo.png'))
      .replace(/__THEME__/g, escHtml(s.primaryColor));
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : out);
  });
}

module.exports = { MIME, notFound, serveFile, serveHtml };
