import http from 'http';
import https from 'https';
import mysql from 'mysql2/promise';
import { assertSafeHost, assertSafeUrl, isTcpPortValid, net } from './monitorSsrf.js';

function fail(error, startedAt) {
  return {
    ok: false,
    latencyMs: Date.now() - startedAt,
    error: String(error?.message || error || 'Check failed'),
  };
}

function success(startedAt, extra = {}) {
  return {
    ok: true,
    latencyMs: Date.now() - startedAt,
    error: null,
    ...extra,
  };
}

async function probeHttp(target) {
  const startedAt = Date.now();
  const timeoutMs = Number(target.timeoutMs) || 8000;
  const allowPrivateNetwork = Boolean(target.allowPrivateNetwork);

  let resolved;
  try {
    resolved = await assertSafeUrl(target.hostOrUrl, { allowPrivateNetwork });
  } catch (error) {
    return fail(error, startedAt);
  }

  const { url } = resolved;
  const expectedStatus = target.expectedStatus == null ? null : Number(target.expectedStatus);
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      url,
      {
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'FormGFL-Monitor/1.0',
          Accept: '*/*',
        },
      },
      (res) => {
        res.resume();
        const status = res.statusCode || 0;
        if (expectedStatus != null) {
          if (status === expectedStatus) {
            resolve(success(startedAt, { statusCode: status }));
          } else {
            resolve(fail(new Error(`Unexpected status ${status} (expected ${expectedStatus})`), startedAt));
          }
          return;
        }
        if (status >= 200 && status < 400) {
          resolve(success(startedAt, { statusCode: status }));
        } else {
          resolve(fail(new Error(`HTTP status ${status}`), startedAt));
        }
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(fail(new Error(`Timed out after ${timeoutMs}ms`), startedAt));
    });
    req.on('error', (error) => {
      resolve(fail(error, startedAt));
    });
    req.end();
  });
}

async function probeTcp(target) {
  const startedAt = Date.now();
  const timeoutMs = Number(target.timeoutMs) || 8000;
  const port = Number(target.port);
  const host = String(target.hostOrUrl || '').trim();

  if (!host) return fail(new Error('Host is required'), startedAt);
  if (!isTcpPortValid(port)) return fail(new Error('Valid port is required'), startedAt);

  try {
    await assertSafeHost(host, { allowPrivateNetwork: Boolean(target.allowPrivateNetwork) });
  } catch (error) {
    return fail(error, startedAt);
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(success(startedAt));
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(fail(new Error(`Timed out after ${timeoutMs}ms`), startedAt));
    });
    socket.on('error', (error) => {
      resolve(fail(error, startedAt));
    });
  });
}

async function probeMysql(target) {
  const startedAt = Date.now();
  const timeoutMs = Number(target.timeoutMs) || 8000;
  const host = String(target.hostOrUrl || '').trim();
  const port = Number(target.port) || 3306;

  if (!host) return fail(new Error('Host is required'), startedAt);
  if (!target.dbUser) return fail(new Error('Database user is required'), startedAt);
  if (!target.dbName) return fail(new Error('Database name is required'), startedAt);

  try {
    await assertSafeHost(host, { allowPrivateNetwork: Boolean(target.allowPrivateNetwork) });
  } catch (error) {
    return fail(error, startedAt);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user: target.dbUser,
      password: target.dbPassword || '',
      database: target.dbName,
      connectTimeout: timeoutMs,
    });
    await connection.query('SELECT 1');
    return success(startedAt);
  } catch (error) {
    return fail(error, startedAt);
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // ignore close errors
      }
    }
  }
}

export async function runProbe(target) {
  const type = String(target?.type || '').toLowerCase();
  if (type === 'http') return probeHttp(target);
  if (type === 'tcp') return probeTcp(target);
  if (type === 'mysql') return probeMysql(target);
  return {
    ok: false,
    latencyMs: 0,
    error: `Unsupported monitor type: ${type}`,
  };
}
