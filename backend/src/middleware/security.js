import crypto from 'crypto';

const requestCounts = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

function cleanup(now) {
  for (const [key, value] of requestCounts.entries()) {
    if (now - value.windowStart > WINDOW_MS) {
      requestCounts.delete(key);
    }
  }
}

export function assignRequestId(req, res, next) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function basicSecurityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
}

export function basicRateLimit(req, res, next) {
  const now = Date.now();
  cleanup(now);
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const current = requestCounts.get(key);

  if (!current || now - current.windowStart > WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return next();
  }

  current.count += 1;
  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      message: 'Too many requests from this client. Please wait and try again.',
      requestId: req.requestId
    });
  }

  next();
}
