'use strict';
// إعادة تعيين كلمة مرور مشرف (أو المالك) من الطرفية
// الاستخدام (والسيرفر موقف):
//   node scripts/reset-password.js owner@email.com NewPassword123
//   node scripts/reset-password.js 05xxxxxxxx NewPassword123
const path = require('path');
const { Db } = require('../src/db');
const v = require('../src/lib/validate');
const sec = require('../src/lib/security');

async function main() {
  const [identifier, password] = process.argv.slice(2);
  if (!identifier || !password) {
    console.log('الاستخدام: node scripts/reset-password.js <الإيميل أو الجوال> <كلمة المرور الجديدة>');
    process.exit(1);
  }
  const id = v.identifier(identifier);
  v.password(password);
  const db = new Db(path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')));
  db.load();
  const a = db.data.admins.find((x) => (id.type === 'email' ? x.email === id.value : x.phone === id.value));
  if (!a) {
    console.log('✖ ما لقيت مشرف بهذا الإيميل أو الجوال. المشرفين الموجودين:');
    for (const x of db.data.admins) console.log(`  - ${x.name}: ${x.email || x.phone}${x.role === 'owner' ? ' (المالك)' : ''}`);
    process.exit(1);
  }
  a.passwordHash = await sec.hashPassword(password);
  a.mustChangePassword = false;
  a.active = true;
  db.data.sessions = db.data.sessions.filter((s) => !(s.kind === 'admin' && s.userId === a.id));
  db.flush();
  console.log(`✔ تم تغيير كلمة مرور ${a.name} — شغّل السيرفر وادخل بالكلمة الجديدة.`);
}

main().catch((e) => {
  console.error('✖', e.message || e);
  process.exit(1);
});
