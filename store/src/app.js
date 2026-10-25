'use strict';
// تجميع المتجر: قاعدة البيانات + المسارات + سيرفر HTTP
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const config = require('./config');
const { Router } = require('./http/router');
const { Db } = require('./db');
const sec = require('./lib/security');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const { BASE_HEADERS } = require('./http/security-headers');
const { serveFile, serveHtml } = require('./http/static');
const { createApiHandler } = require('./http/api');

const { PORT, HOST, DATA_DIR, UPLOADS_DIR, PUBLIC_DIR } = config;

function makeSetupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
  }
  return out;
}

// أول تشغيل على استضافة جديدة (Volume فاضي): ننسخ بياناتك من مجلد seed-data لو موجود
function seedDataIfEmpty() {
  const seedDir = path.join(config.ROOT, 'seed-data');
  if (fs.existsSync(path.join(DATA_DIR, 'db.json')) || !fs.existsSync(path.join(seedDir, 'db.json'))) return;
  fs.cpSync(seedDir, DATA_DIR, { recursive: true });
  console.log('  ✔ تم نسخ بياناتك من seed-data إلى', DATA_DIR);
}

async function main() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  seedDataIfEmpty();
  const db = new Db(DATA_DIR);
  const fresh = db.load();
  sec.pruneSessions(db);
  setInterval(() => sec.pruneSessions(db), 3600e3).unref();
  await sec.initDummyHash();

  const app = { db, uploadsDir: UPLOADS_DIR, setupCode: db.data.admins.length ? null : makeSetupCode() };
  const router = new Router();
  publicRoutes(router, app);
  adminRoutes(router, app);


  const handleApi = createApiHandler(router);

  async function handle(req, res) {
    for (const [k, val] of Object.entries(BASE_HEADERS)) res.setHeader(k, val);
    let url;
    let pathname;
    try {
      url = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400);
      return res.end('Bad request');
    }
    if (pathname.includes('\0')) {
      res.writeHead(400);
      return res.end('Bad request');
    }

    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    if (pathname.startsWith('/uploads/')) {
      return serveFile(req, res, UPLOADS_DIR, pathname.slice('/uploads/'.length), { immutable: true, uploads: true });
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return serveHtml(req, res, 'admin/index.html', db);
    if (path.extname(pathname) && pathname !== '/index.html') return serveFile(req, res, PUBLIC_DIR, pathname);
    return serveHtml(req, res, 'index.html', db);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 20_000;

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`\n✖ البورت ${PORT} مستخدم من برنامج ثاني. غيّر PORT في ملف .env أو سكّر البرنامج الثاني.\n`);
    else console.error(e);
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    const line = '═'.repeat(58);
    console.log(`\n${line}`);
    console.log(`  ${db.data.settings.storeName} شغّال ✔`);
    console.log(`  المتجر:        http://localhost:${PORT}`);
    console.log(`  لوحة التحكم:   http://localhost:${PORT}/admin`);
    for (const ip of lanAddresses()) console.log(`  على الشبكة:    http://${ip}:${PORT}`);
    console.log(line);
    if (fresh) console.log('  تم إنشاء قاعدة بيانات جديدة مع منتجات تجريبية (تقدر تحذفها من لوحة التحكم).');
    if (app.setupCode) {
      console.log('\n  >>> أول تشغيل: افتح لوحة التحكم وأنشئ حساب مالك المتجر');
      console.log(`  >>> رمز الإعداد:  ${app.setupCode.slice(0, 4)}-${app.setupCode.slice(4)}`);
      console.log('  >>> (الرمز يتغير كل مرة تشغّل فيها السيرفر لين تنشئ الحساب)\n');
    }
  });

  const shutdown = () => {
    try { db.flush(); } catch (e) { console.error(e); }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { main };
