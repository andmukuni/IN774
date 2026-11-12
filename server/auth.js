import crypto from 'crypto';
import {
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_TTL_SECONDS,
  parseCookies,
} from './securityHelpers.js';

export function timingSafeCompare(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signJwtHmacSha256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signature}`;
}

function decodeBase64UrlJson(value) {
  try {
    const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(padded, 'base64');
    if (!buf.length) return null;
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

export function verifyJwtHmacSha256(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodeBase64UrlJson(encodedHeader);
  if (!header || header.alg !== 'HS256') return null;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (!timingSafeCompare(signature, expectedSignature)) return null;

  return decodeBase64UrlJson(encodedPayload);
}

function hashPasswordLegacy(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export function hashPassword(password) {
  const iterations = 120000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 64, 'sha512').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const value = String(storedHash || '');
  if (!value) return { valid: false, needsUpgrade: false };

  if (value.startsWith('pbkdf2$')) {
    const [, iterationsRaw, salt, expectedHash] = value.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !salt || !expectedHash) return { valid: false, needsUpgrade: false };
    const computed = crypto.pbkdf2Sync(String(password), salt, iterations, 64, 'sha512').toString('hex');
    return { valid: timingSafeCompare(computed, expectedHash), needsUpgrade: false };
  }

  const validLegacy = timingSafeCompare(hashPasswordLegacy(password), value);
  return { valid: validLegacy, needsUpgrade: validLegacy };
}

export function getBearerToken(req) {
  const bearer = String(req.headers.authorization || '').trim();
  return bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
}

export function getSessionToken(req) {
  const bearer = getBearerToken(req);
  if (bearer) return { token: bearer, source: 'bearer' };

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = String(cookies[AUTH_COOKIE_NAME] || '').trim();
  if (cookieToken) return { token: cookieToken, source: 'cookie' };

  return { token: '', source: '' };
}

export function createAuthService({ secret, adminApiKey = '', allPermissionKeys = [] }) {
  function getJwtAuth(req) {
    const { token, source } = getSessionToken(req);
    if (!token) {
      return { ok: false, status: 401, message: 'Authentication required.', token: '', source };
    }

    const claims = verifyJwtHmacSha256(token, secret);
    if (!claims?.sub) {
      return { ok: false, status: 401, message: 'Invalid session. Please log in again.', token, source };
    }

    if (!claims.exp) {
      return { ok: false, status: 401, message: 'Invalid session token. Please log in again.', token, source };
    }

    if (Math.floor(Date.now() / 1000) > Number(claims.exp)) {
      return { ok: false, status: 401, message: 'Session expired. Please log in again.', token, source };
    }

    return { ok: true, claims, token, source };
  }

  function getAdminAuth(req) {
    const jwt = getJwtAuth(req);
    if (jwt.ok) {
      const perms = Array.isArray(jwt.claims.permissions) ? jwt.claims.permissions : [];
      if (jwt.claims.role === 'admin' || jwt.claims.admin === true || perms.length > 0) {
        return { ok: true, source: jwt.source || 'jwt', claims: jwt.claims };
      }
      return { ok: false, status: 403, message: 'Administrator privileges required.' };
    }

    const headerKey = String(req.headers['x-admin-api-key'] || '').trim();
    const candidate = headerKey || (jwt.source === 'bearer' ? jwt.token : '');
    if (adminApiKey && adminApiKey.length >= 16 && candidate && timingSafeCompare(candidate, adminApiKey)) {
      return {
        ok: true,
        source: 'api-key',
        claims: { role: 'admin', admin: true, permissions: allPermissionKeys },
      };
    }

    return {
      ok: false,
      status: jwt.status || 401,
      message: jwt.message || 'Unauthorized admin request. Please log in as an administrator.',
    };
  }

  function sendAuthFailure(res, auth) {
    return res.status(auth?.status || 401).json({
      ok: false,
      message: auth?.message || 'Unauthorized request.',
    });
  }

  function signUserToken(user, { adminPermissions = [], canAccessAdmin = false } = {}) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + AUTH_TOKEN_TTL_SECONDS;
    const tokenPayload = { sub: user.id, role: user.role || 'user', iat, exp };
    if (canAccessAdmin) {
      tokenPayload.admin = true;
      tokenPayload.permissions = adminPermissions;
    }
    return signJwtHmacSha256(tokenPayload, secret);
  }

  return { getJwtAuth, getAdminAuth, sendAuthFailure, signUserToken };
}
