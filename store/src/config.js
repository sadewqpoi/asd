'use strict';
// إعدادات المتجر: تقرأ ملف .env (إن وجد) وتجمع كل الثوابت في مكان واحد
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let val = m[2];
    if (/^(["']).*\1$/.test(val)) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadEnv(path.join(ROOT, '.env'));

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT) || 8080,
  HOST: process.env.HOST || '0.0.0.0',
  DATA_DIR,
  UPLOADS_DIR: path.join(DATA_DIR, 'uploads'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  TRUST_PROXY: ['1', 'true'].includes(String(process.env.TRUST_PROXY || '').toLowerCase()),
  loadEnv,
};
