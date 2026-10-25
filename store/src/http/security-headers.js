'use strict';
// هيدرات الأمان (CSP وغيرها) تنضاف على كل رد

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': CSP,
};

module.exports = { CSP, BASE_HEADERS };
