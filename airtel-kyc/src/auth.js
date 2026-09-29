import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getConfig } from './config.js';

const COOKIE = 'kyc_session';
const SESSION_MS = 12 * 60 * 60 * 1000;

function safeEqual(left, right) {
  const a = createHash('sha256').update(String(left)).digest();
  const b = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(a, b);
}

export function signSession(accessKey, now = Date.now()) {
  const payload = String(now + SESSION_MS);
  const sig = createHmac('sha256', accessKey).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(token, accessKey, now = Date.now()) {
  if (!token || !accessKey) return false;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  const expected = createHmac('sha256', accessKey).update(payload).digest('base64url');
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > now;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function sessionCookie(token, config = getConfig()) {
  const flags = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${SESSION_MS / 1000}`];
  if (config.cookieSecure) flags.push('Secure');
  return `${COOKIE}=${encodeURIComponent(token)}; ${flags.join('; ')}`;
}

export function clearSessionCookie(config = getConfig()) {
  const flags = ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (config.cookieSecure) flags.push('Secure');
  return `${COOKIE}=; ${flags.join('; ')}`;
}

export function isAuthorized(req, config = getConfig()) {
  if (!config.accessKey) return true;
  const headerKey = req.headers['x-api-key'];
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if ((headerKey && safeEqual(headerKey, config.accessKey)) || (bearer && safeEqual(bearer, config.accessKey))) {
    return true;
  }
  const cookies = parseCookies(req.headers.cookie);
  return readSession(cookies[COOKIE], config.accessKey);
}

export function accessKeyMatches(candidate, config = getConfig()) {
  return Boolean(config.accessKey) && safeEqual(candidate || '', config.accessKey);
}
