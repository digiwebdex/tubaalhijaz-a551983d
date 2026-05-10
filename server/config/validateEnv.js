// =====================================================================
// Environment validator — fail fast on boot if critical vars are missing.
// Call once from server/index.js:  require('./config/validateEnv')();
// =====================================================================

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const RECOMMENDED = [
  'FRONTEND_URL',
  'REDIS_URL',
  'BULKSMSBD_API_KEY',
  'RESEND_API_KEY',
];

function validateEnv({ strict = false } = {}) {
  const missing = REQUIRED.filter((k) => !process.env[k] || String(process.env[k]).startsWith('REPLACE_ME'));
  const warn = RECOMMENDED.filter((k) => !process.env[k]);

  if (missing.length) {
    const msg = `[env] Missing required environment variables: ${missing.join(', ')}`;
    if (strict || process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error(msg);
      process.exit(1);
    } else {
      // eslint-disable-next-line no-console
      console.warn(msg);
    }
  }

  if (warn.length) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Recommended env vars not set (some features will be disabled): ${warn.join(', ')}`);
  }

  // Warn against weak JWT secrets in production
  if (process.env.NODE_ENV === 'production') {
    ['JWT_SECRET', 'JWT_REFRESH_SECRET'].forEach((k) => {
      if (process.env[k] && process.env[k].length < 32) {
        // eslint-disable-next-line no-console
        console.warn(`[env] ${k} is shorter than 32 characters — use a long random string in production.`);
      }
    });
  }
}

module.exports = validateEnv;
