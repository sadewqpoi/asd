'use strict';
// قاعدة بيانات بسيطة بملف JSON — الكتابة ذرّية (ملف مؤقت ثم استبدال) عشان ما يخرب الملف لو انقطع التشغيل
const fs = require('fs');
const path = require('path');
const { defaultPages, makeHomePage } = require('../lib/pages');
const { defaultSettings, emptyData } = require('./defaults');
const { seed, buildFooterColumns } = require('./seed');

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

class Db {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.data = null;
    this.timer = null;
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    if (fs.existsSync(this.file)) {
      const raw = fs.readFileSync(this.file, 'utf8');
      try {
        this.data = JSON.parse(raw);
      } catch (e) {
        throw new Error(`ملف قاعدة البيانات خربان (${this.file}). فيه نسخة احتياطية باسم db.backup.json — انسخها مكانه.\n${e.message}`);
      }
      // نسخة احتياطية مع كل تشغيل
      try { fs.copyFileSync(this.file, path.join(this.dir, 'db.backup.json')); } catch { /* تجاهل */ }
      this.migrate();
      this.save();
      return false;
    }
    this.data = emptyData();
    seed(this.data);
    this.flush();
    return true;
  }

  // يضيف أي إعدادات جديدة ناقصة من الإصدارات القديمة بدون ما يمسح شي
  migrate() {
    // الصفحات انضافت بعد الإصدار الأول — نضيف الصفحات الجاهزة (مخفية) للمتاجر القديمة
    if (!Array.isArray(this.data.pages)) this.data.pages = defaultPages(this.data.settings && this.data.settings.storeName);
    // الصفحة الرئيسية صارت تتعدل بمحرر الصفحات
    if (!this.data.pages.some((p) => p.isHome)) this.data.pages.unshift(makeHomePage(this.data.settings, this.data.categories));
    // الفوتر صار أعمدة وروابط قابلة للتعديل
    const ft = this.data.settings && this.data.settings.footer;
    if (ft && !Array.isArray(ft.columns)) ft.columns = buildFooterColumns(this.data);
    const base = emptyData();
    for (const k of Object.keys(base)) if (this.data[k] === undefined) this.data[k] = base[k];
    const def = base.settings;
    const s = this.data.settings;
    for (const k of Object.keys(def)) {
      if (s[k] === undefined) s[k] = def[k];
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) {
        for (const kk of Object.keys(def[k])) if (s[k][kk] === undefined) s[k][kk] = def[k][kk];
      }
    }
  }

  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try { this.flush(); } catch (e) { console.error('فشل حفظ قاعدة البيانات:', e); }
    }, 120);
  }

  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const json = JSON.stringify(this.data, null, 1);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, json);
    // ويندوز/ون درايف أحياناً يقفل الملف لحظياً — نعيد المحاولة
    for (let i = 0; i < 6; i++) {
      try {
        fs.renameSync(tmp, this.file);
        return;
      } catch (e) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
        sleepSync(40 * (i + 1));
      }
    }
    fs.writeFileSync(this.file, json);
    try { fs.unlinkSync(tmp); } catch { /* تجاهل */ }
  }
}

module.exports = { Db, defaultSettings };
