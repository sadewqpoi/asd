'use strict';
// مسارات واجهة المتجر للعملاء
const { createContext } = require('./context');

module.exports = function publicRoutes(router, app) {
  const c = createContext(app);
  require('./catalog')(router, c);
  require('./cart')(router, c);
  require('./auth')(router, c);
  require('./orders')(router, c);
};
