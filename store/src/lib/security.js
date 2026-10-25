'use strict';
// تشفير كلمات المرور، الجلسات، وتحديد عدد المحاولات
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
let dummyHash = null;

function hashPassword(pw) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(pw.normalize('NFKC'), salt, 64, SCRYPT, (err, key) => {
      if (err) return reject(err);
      resolve(`s1$${salt.toString('base64')}$${key.toString('base64')}`);
    });
  });
}

function verifyPassword(pw, stored) {
  return new Promise((resolve) => {
    const parts = String(stored || dummyHash || '').split('$');
    if (parts.length !== 3 || parts[0] !== 's1' || typeof pw !== 'string') return resolve(false);
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    crypto.scrypt(pw.normalize('NFKC'), salt, expected.length, SCRYPT, (err, key) => {
      if (err) return resolve(false);
      resolve(Boolean(stored) && key.length === expected.length && crypto.timingSafeEqual(key, expected));
    });
  });
}

// لما المستخدم غير موجود نحسب هاش وهمي عشان وقت الرد ما يكشف وجود الحساب
async function initDummyHash() {
  dummyHash = await hashPassword(crypto.randomBytes(12).toString('hex'));
}

function tempPassword(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}

function newId(len = 10) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- الجلسات (محفوظة بقاعدة البيانات كهاش فقط) ----------
function createSession(db, kind, userId, ttlMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.data.sessions.push({ h: sha256(token), kind, userId, exp: Date.now() + ttlMs });
  db.save();
  return token;
}

function getSession(db, kind, token) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  const h = sha256(token);
  const s = db.data.sessions.find((x) => x.h === h && x.kind === kind);
  if (!s) return null;
  if (s.exp < Date.now()) {
    db.data.sessions = db.data.sessions.filter((x) => x !== s);
    db.save();
    return null;
  }
  return s;
}

function destroySession(db, token) {
  if (!token) return;
  const h = sha256(token);
  const before = db.data.sessions.length;
  db.data.sessions = db.data.sessions.filter((x) => x.h !== h);
  if (db.data.sessions.length !== before) db.save();
}

function destroyUserSessions(db, kind, userId, keepToken) {
  const keep = keepToken ? sha256(keepToken) : null;
  db.data.sessions = db.data.sessions.filter((x) => !(x.kind === kind && x.userId === userId && x.h !== keep));
  db.save();
}

function pruneSessions(db) {
  const now = Date.now();
  const before = db.data.sessions.length;
  db.data.sessions = db.data.sessions.filter((x) => x.exp > now);
  if (db.data.sessions.length !== before) db.save();
}

// ---------- تحديد عدد المحاولات ----------
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60_000).unref();
  return {
    hit(key) {
      const now = Date.now();
      let e = hits.get(key);
      if (!e || e.reset < now) {
        e = { n: 0, reset: now + windowMs };
        hits.set(key, e);
      }
      e.n++;
      return e.n <= max;
    },
    clear(key) { hits.delete(key); },
    minutesLeft(key) {
      const e = hits.get(key);
      return e ? Math.max(1, Math.ceil((e.reset - Date.now()) / 60000)) : 0;
    },
  };
}

module.exports = {
  hashPassword, verifyPassword, initDummyHash, tempPassword, newId, sha256, safeEqual,
  createSession, getSession, destroySession, destroyUserSessions, pruneSessions, rateLimiter,
};
