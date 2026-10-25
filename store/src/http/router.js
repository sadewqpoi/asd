'use strict';
// أدوات HTTP صغيرة: راوتر، قراءة الطلب، الكوكيز — بدون أي مكتبة خارجية

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handlers) {
    const keys = [];
    const src = pattern.replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
    this.routes.push({ method, re: new RegExp(`^${src}/?$`), keys, handlers });
    return this;
  }

  get(p, ...h) { return this.add('GET', p, h); }
  post(p, ...h) { return this.add('POST', p, h); }
  put(p, ...h) { return this.add('PUT', p, h); }
  delete(p, ...h) { return this.add('DELETE', p, h); }

  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => {
        try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; }
      });
      return { handlers: r.handlers, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function serializeCookie(name, value, { maxAge, path = '/', secure = false } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  if (secure) c += '; Secure';
  return c;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) {
        done = true;
        chunks.length = 0;
        reject(new HttpError(413, 'حجم البيانات أكبر من المسموح'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!done) { done = true; resolve(Buffer.concat(chunks)); }
    });
    req.on('error', (e) => {
      if (!done) { done = true; reject(e); }
    });
  });
}

function sendJson(res, status, data, headers = {}) {
  if (res.headersSent) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

module.exports = { HttpError, Router, parseCookies, serializeCookie, readBody, sendJson };
