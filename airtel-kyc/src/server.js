import { createReadStream, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { accessKeyMatches, clearSessionCookie, isAuthorized, sessionCookie, signSession } from './auth.js';
import { enquireUser, KycError, testConnection } from './airtel.js';
import { getConfig, publicStatus, rootDir } from './config.js';
import { listVerifications, rememberVerification } from './store.js';

const publicDir = resolve(rootDir, 'public');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const buckets = new Map();

function clientIp(req, config) {
  if (config.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function allow(key, limit, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16_384) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413, code: 'BODY_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Request body must be JSON.'), { status: 400, code: 'BAD_JSON' }));
      }
    });
    req.on('error', reject);
  });
}

function publicFile(pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const full = resolve(publicDir, rel);
  if (full !== publicDir && !full.startsWith(publicDir + sep)) return null;
  if (!existsSync(full) || !extname(full)) return null;
  return full;
}

function failure(error) {
  if (error instanceof KycError) {
    return { status: error.status, body: { ok: false, error: error.message, code: error.code } };
  }
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return { status: 504, body: { ok: false, error: 'The request to Airtel timed out.', code: 'TIMEOUT' } };
  }
  if (error.status && error.code) {
    return { status: error.status, body: { ok: false, error: error.message, code: error.code } };
  }
  if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return { status: 502, body: { ok: false, error: 'Could not reach Airtel.', code: 'UPSTREAM' } };
  }
  return { status: 502, body: { ok: false, error: 'Could not complete the Airtel lookup.', code: 'UPSTREAM' } };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const config = getConfig();
    const url = new URL(req.url || '/', 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'");

    try {
      if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/health')) {
        send(res, 200, { ok: true, service: 'airtel-kyc' });
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url, config);
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        send(res, 405, { ok: false, error: 'Method not allowed.', code: 'METHOD' });
        return;
      }

      const file = publicFile(url.pathname);
      if (!file) {
        send(res, 404, { ok: false, error: 'Not found.', code: 'NOT_FOUND' });
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      createReadStream(file).pipe(res);
    } catch (error) {
      const mapped = failure(error);
      if (!res.headersSent) send(res, mapped.status, mapped.body);
    }
  });
}

async function handleApi(req, res, url, config) {
  if (req.method === 'GET' && url.pathname === '/api/session') {
    send(res, 200, {
      ok: true,
      authRequired: Boolean(config.accessKey),
      authenticated: isAuthorized(req, config),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/session') {
    if (!allow(`login:${clientIp(req, config)}`, 10, 60_000)) {
      send(res, 429, { ok: false, error: 'Too many sign-in attempts. Wait a minute and try again.', code: 'RATE_LIMIT' });
      return;
    }
    const body = await readBody(req);
    if (!config.accessKey) {
      send(res, 200, { ok: true, authRequired: false, authenticated: true });
      return;
    }
    if (!accessKeyMatches(body.accessKey, config)) {
      send(res, 401, { ok: false, error: 'That access key is not valid.', code: 'UNAUTHORIZED' });
      return;
    }
    send(res, 200, { ok: true, authRequired: true, authenticated: true }, {
      'Set-Cookie': sessionCookie(signSession(config.accessKey), config),
    });
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/api/session') {
    send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(config) });
    return;
  }

  if (!isAuthorized(req, config)) {
    send(res, 401, { ok: false, error: 'Sign in required.', code: 'UNAUTHORIZED' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    send(res, 200, { ok: true, ...publicStatus(config) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/connection') {
    if (!allow(`connect:${clientIp(req, config)}`, 10, 60_000)) {
      send(res, 429, { ok: false, error: 'Too many connection checks. Wait a minute and try again.', code: 'RATE_LIMIT' });
      return;
    }
    try {
      const result = await testConnection({ config });
      send(res, 200, result);
    } catch (error) {
      const mapped = failure(error);
      console.error(JSON.stringify({ level: 'error', op: 'connection', code: error.code || error.name, message: error.message }));
      send(res, mapped.status, mapped.body);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/verifications') {
    const limit = url.searchParams.get('limit') || '20';
    const records = await listVerifications(limit, config.dataFile);
    send(res, 200, { ok: true, data: records });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/verify') {
    if (!allow(`verify:${clientIp(req, config)}`, 30, 60_000)) {
      send(res, 429, { ok: false, error: 'Too many lookups. Wait a minute and try again.', code: 'RATE_LIMIT' });
      return;
    }
    const body = await readBody(req);
    const msisdn = body.msisdn;
    try {
      const result = await enquireUser(msisdn, { config });
      const record = {
        id: randomUUID(),
        checkedAt: new Date().toISOString(),
        ...result,
      };
      await rememberVerification(record, config.dataFile);
      const completed = result.verdict !== 'error';
      send(res, completed ? 200 : 502, { ok: completed, ...record });
    } catch (error) {
      const tail = String(msisdn || '').replace(/\D/g, '').slice(-4);
      console.error(JSON.stringify({
        level: 'error',
        op: 'verify',
        msisdnTail: tail,
        code: error.code || error.name,
        message: error.message,
      }));
      const mapped = failure(error);
      send(res, mapped.status, mapped.body);
    }
    return;
  }

  send(res, 404, { ok: false, error: 'Not found.', code: 'NOT_FOUND' });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const config = getConfig();
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`Airtel KYC listening on http://${config.host}:${config.port} (${config.environment}${config.mock ? ', mock' : ''})`);
  });
}
