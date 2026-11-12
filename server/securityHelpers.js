import crypto from 'crypto';

const _genericRateBuckets = new Map();
const RATE_BUCKET_CAP = 5000;

export const AUTH_COOKIE_NAME = 'gfl_session';
export const AUTH_TOKEN_TTL_SECONDS = Math.max(
  15 * 60,
  Number(process.env.AUTH_TOKEN_TTL_SECONDS || 12 * 60 * 60) || 12 * 60 * 60,
);
export const ALLOWED_USER_ROLES = ['user', 'admin'];
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

export function rateLimitByKey({ windowMs = 60_000, max = 10, routeKey, getKey }) {
  return (req, res, next) => {
    pruneRateBuckets(windowMs);
    const key = `${routeKey}::${getKey(req)}`;
    const now = Date.now();

    let bucket = _genericRateBuckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      _genericRateBuckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({
        ok: false,
        message: 'Too many requests. Please try again shortly.',
      });
    }

    return next();
  };
}

function pruneRateBuckets(windowMs) {
  if (_genericRateBuckets.size < RATE_BUCKET_CAP) return;
  const now = Date.now();
  for (const [key, bucket] of _genericRateBuckets) {
    if (!bucket || now - bucket.start > windowMs) {
      _genericRateBuckets.delete(key);
    }
  }
  if (_genericRateBuckets.size >= RATE_BUCKET_CAP) {
    _genericRateBuckets.clear();
  }
}

export function evaluateCorsOrigin(origin, { corsOrigins, serverOrigin, nodeEnv }) {
  if (!origin) return { allowed: true };
  if (serverOrigin && origin === serverOrigin) return { allowed: true };
  if (corsOrigins.length > 0) {
    return corsOrigins.includes(origin)
      ? { allowed: true }
      : { allowed: false, reason: 'origin_not_listed' };
  }
  if (nodeEnv === 'production') {
    return { allowed: false, reason: 'cors_origins_unset' };
  }
  return { allowed: true };
}

export function applySecurityHeaders(req, res, { isProduction = false } = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
    ].join('; '),
  );
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
}

export function parseCookies(headerValue = '') {
  const parsed = {};
  for (const part of String(headerValue || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      parsed[name] = decodeURIComponent(value);
    } catch {
      parsed[name] = value;
    }
  }
  return parsed;
}

export function serializeAuthCookie(token, { maxAgeSeconds, secure = false, clearing = false } = {}) {
  const parts = [
    `${AUTH_COOKIE_NAME}=${clearing ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (secure) parts.push('Secure');
  if (clearing) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else if (maxAgeSeconds) {
    parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`);
  }
  return parts.join('; ');
}

export function setAuthCookie(res, token, { isProduction = false, appUrl = '' } = {}) {
  const secure = Boolean(isProduction || /^https:/i.test(String(appUrl || '')));
  res.append('Set-Cookie', serializeAuthCookie(token, {
    maxAgeSeconds: AUTH_TOKEN_TTL_SECONDS,
    secure,
  }));
}

export function clearAuthCookie(res, { isProduction = false, appUrl = '' } = {}) {
  const secure = Boolean(isProduction || /^https:/i.test(String(appUrl || '')));
  res.append('Set-Cookie', serializeAuthCookie('', { secure, clearing: true }));
}

export function requestOriginAllowed(req, { corsOrigins, serverOrigin, nodeEnv }) {
  const origin = String(req.headers.origin || '').trim();
  if (origin) {
    return evaluateCorsOrigin(origin, { corsOrigins, serverOrigin, nodeEnv }).allowed;
  }

  const referer = String(req.headers.referer || '').trim();
  if (!referer) {
    const method = String(req.method || '').toUpperCase();
    return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  }

  try {
    const refererOrigin = new URL(referer).origin;
    return evaluateCorsOrigin(refererOrigin, { corsOrigins, serverOrigin, nodeEnv }).allowed;
  } catch {
    return false;
  }
}

export function sendRouteError(res, error, fallback = 'Request failed. Please try again.') {
  const rawStatus = Number(error?.status);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const expose = status < 500 && typeof error?.message === 'string' && error.message.trim();
  if (status >= 500) {
    console.error('[api]', error?.stack || error?.message || error);
  }
  return res.status(status).json({
    ok: false,
    message: expose ? error.message : fallback,
  });
}

export function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return 'Password is too long.';
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include letters and numbers.';
  }
  return '';
}

export function normalizeUserRole(role, fallback = 'user') {
  const value = String(role || fallback).trim().toLowerCase();
  return ALLOWED_USER_ROLES.includes(value) ? value : fallback;
}

export function clipString(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

export function limitJsonBody(maxBytes) {
  return (req, res, next) => {
    const length = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(length) && length > maxBytes) {
      return res.status(413).json({ ok: false, message: 'Request too large.' });
    }
    return next();
  };
}

function secretKeyBuffer(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest();
}

export function encryptSecretAtRest(plain, secret) {
  const value = String(plain || '');
  if (!value || !secret) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKeyBuffer(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecretAtRest(stored, secret) {
  const value = String(stored || '');
  if (!value.startsWith('enc:v1:')) return value;
  if (!secret) return '';
  const parts = value.split(':');
  if (parts.length !== 5) return '';
  const [, , ivHex, tagHex, dataHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      secretKeyBuffer(secret),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}
