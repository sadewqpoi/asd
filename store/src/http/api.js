'use strict';
// معالج مسارات /api: الكوكيز، حماية CSRF، قراءة الجسم، وتحويل الأخطاء لردود JSON
const { HttpError, parseCookies, serializeCookie, readBody, sendJson } = require('./router');
const { COOKIE_SECURE, TRUST_PROXY } = require('../config');

function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

// حماية من CSRF: أي طلب يغيّر بيانات لازم يجي من نفس الموقع
function checkSameOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'طلب مرفوض');
  const origin = req.headers.origin;
  if (origin) {
    const expected = (TRUST_PROXY && req.headers['x-forwarded-host']) || req.headers.host;
    let host;
    try { host = new URL(origin).host; } catch { throw new HttpError(403, 'طلب مرفوض'); }
    if (host !== expected) throw new HttpError(403, 'طلب مرفوض');
  }
}

function createApiHandler(router) {
  return async function handleApi(req, res, url) {
    const cookiesOut = [];
    const ctx = {
      req, res, params: {}, body: {},
      query: url.searchParams,
      cookies: parseCookies(req.headers.cookie),
      ip: clientIp(req),
      setCookie: (name, value, opts) => cookiesOut.push(serializeCookie(name, value, { ...opts, secure: COOKIE_SECURE })),
    };
    try {
      const m = router.match(req.method, url.pathname);
      if (!m) throw new HttpError(404, 'المسار غير موجود');
      if (m.methodNotAllowed) throw new HttpError(405, 'الطريقة غير مسموحة');
      ctx.params = m.params;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        checkSameOrigin(req);
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        if (!ct.startsWith('application/json')) throw new HttpError(415, 'نوع الطلب غير مدعوم');
        const limit = url.pathname === '/api/admin/media' ? 12 * 1024 * 1024 : url.pathname.startsWith('/api/admin/pages') ? 2 * 1024 * 1024 : 256 * 1024;
        const raw = await readBody(req, limit);
        if (raw.length) {
          try { ctx.body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'بيانات غير صالحة'); }
        }
        if (!ctx.body || typeof ctx.body !== 'object' || Array.isArray(ctx.body)) ctx.body = {};
      }
      let result;
      for (const h of m.handlers) result = await h(ctx);
      sendJson(res, 200, result ?? { ok: true }, cookiesOut.length ? { 'Set-Cookie': cookiesOut } : {});
    } catch (e) {
      if (e instanceof HttpError) {
        return sendJson(res, e.status, { error: e.message, ...(e.extra || {}) }, e.status === 413 ? { Connection: 'close' } : {});
      }
      console.error(e);
      sendJson(res, 500, { error: 'صار خطأ بالسيرفر، حاول مرة ثانية' });
    }
  };
}

module.exports = { createApiHandler };
