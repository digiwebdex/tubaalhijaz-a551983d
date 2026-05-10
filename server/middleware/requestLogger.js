// =====================================================================
// Structured request logging + per-request correlation IDs.
//   app.use(require('./middleware/requestLogger'));
// Emits one JSON line per request to stdout (PM2 / Docker friendly).
// =====================================================================
const crypto = require('crypto');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[process.env.LOG_LEVEL || 'info'] || LEVELS.info;

function emit(level, payload) {
  if ((LEVELS[level] || 0) < minLevel) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...payload,
  });
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    emit(level, {
      msg: 'http_request',
      request_id: requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      user_id: req.user?.id || null,
    });
  });

  next();
}

requestLogger.log = emit;
module.exports = requestLogger;
