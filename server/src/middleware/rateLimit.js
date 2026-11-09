const rateLimit = require('express-rate-limit');

// Scoped per authenticated user when req.user is already set, falling back
// to IP otherwise. generalLimiter (mounted before any router's own
// `authenticate`) only ever sees req.ip in practice — it's the broad
// anti-abuse net. auditLimiter (mounted after authenticate inside
// routes/audits.js) is genuinely per-user.
function keyGenerator(req) {
  return req.user ? String(req.user._id) : req.ip;
}

function rateLimitedHandler(req, res) {
  const retryAfterSeconds = Math.ceil(req.rateLimit.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 60);
  res.status(429).json({
    error: {
      code: 'rate_limited',
      message: 'Too many requests.',
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
      suggestion: 'Reduce request frequency or retry after the time given.',
    },
  });
}

const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitedHandler,
});

const auditLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.AUDIT_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitedHandler,
});

module.exports = { generalLimiter, auditLimiter };
