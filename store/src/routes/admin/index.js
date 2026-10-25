'use strict';
// مسارات لوحة التحكم: كل مسار يتحقق من الجلسة والصلاحية من السيرفر نفسه
const { createContext } = require('./context');

module.exports = function adminRoutes(router, app) {
  const c = createContext(app);
  for (const name of ['auth', 'stats', 'products', 'categories', 'media', 'settings', 'orders', 'customers', 'pages', 'admins']) {
    require(`./${name}`)(router, c);
  }
};
