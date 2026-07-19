import crypto from 'crypto';
import pool from '../db.js';
import { timingSafeCompare } from '../auth.js';
import { EXTERNAL_API_SCOPE_KEYS } from '../../shared/externalApiScopes.js';

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

function generateApiKeyId() {
  return `apk-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function generateRawApiKey() {
  const secret = crypto.randomBytes(24).toString('hex');
  return `gfl_${secret}`;
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      return trimmed.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
    }
  }
  return fallback;
}

export function normalizeIpWhitelist(input) {
  return parseJsonArray(input);
}

export function normalizeApiKeyScopes(input) {
  const values = parseJsonArray(input);
  const allowed = new Set(EXTERNAL_API_SCOPE_KEYS);
  const scopes = values.filter((scope) => allowed.has(scope));
  return scopes.length ? scopes : ['assets.read', 'employees.read', 'assignments.read'];
}

export async function ensureApiKeysTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id VARCHAR(90) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      key_hash CHAR(64) NOT NULL,
      scopes JSON NOT NULL,
      ip_whitelist JSON NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_by VARCHAR(90) NULL,
      last_used_at DATETIME NULL,
      expires_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_api_keys_prefix (key_prefix),
      INDEX idx_api_keys_status (status)
    )
  `);
}

function mapApiKeyRow(row, { includeSecret = false, rawKey = null } = {}) {
  const data = {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    maskedKey: `${row.key_prefix}…`,
    scopes: parseJsonArray(row.scopes),
    ipWhitelist: parseJsonArray(row.ip_whitelist),
    status: row.status || 'active',
    createdBy: row.created_by || null,
    lastUsedAt: row.last_used_at || null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeSecret && rawKey) {
    data.apiKey = rawKey;
  }
  return data;
}

export async function listApiKeys() {
  const [rows] = await pool.query(
    `SELECT id, name, key_prefix, key_hash, scopes, ip_whitelist, status, created_by, last_used_at, expires_at, created_at, updated_at
     FROM api_keys
     ORDER BY created_at DESC`,
  );
  return rows.map((row) => mapApiKeyRow(row));
}

export async function createApiKey({
  name,
  scopes,
  ipWhitelist,
  createdBy = null,
  expiresAt = null,
}) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    const err = new Error('API key name is required.');
    err.status = 400;
    throw err;
  }

  const normalizedScopes = normalizeApiKeyScopes(scopes);
  const normalizedWhitelist = normalizeIpWhitelist(ipWhitelist);
  if (!normalizedWhitelist.length) {
    const err = new Error('At least one IP address or CIDR range is required for server whitelisting.');
    err.status = 400;
    throw err;
  }

  const rawKey = generateRawApiKey();
  const keyPrefix = rawKey.slice(0, 12);
  const id = generateApiKeyId();

  await pool.query(
    `INSERT INTO api_keys (id, name, key_prefix, key_hash, scopes, ip_whitelist, status, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      id,
      trimmedName,
      keyPrefix,
      hashApiKey(rawKey),
      JSON.stringify(normalizedScopes),
      JSON.stringify(normalizedWhitelist),
      createdBy,
      expiresAt || null,
    ],
  );

  const [[row]] = await pool.query(
    `SELECT id, name, key_prefix, key_hash, scopes, ip_whitelist, status, created_by, last_used_at, expires_at, created_at, updated_at
     FROM api_keys WHERE id = ?`,
    [id],
  );

  return mapApiKeyRow(row, { includeSecret: true, rawKey });
}

export async function updateApiKey(id, { name, scopes, ipWhitelist, status }) {
  const keyId = String(id || '').trim();
  if (!keyId) {
    const err = new Error('API key id is required.');
    err.status = 400;
    throw err;
  }

  const [[existing]] = await pool.query('SELECT id FROM api_keys WHERE id = ?', [keyId]);
  if (!existing) {
    const err = new Error('API key not found.');
    err.status = 404;
    throw err;
  }

  const updates = [];
  const params = [];

  if (name != null) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      const err = new Error('API key name is required.');
      err.status = 400;
      throw err;
    }
    updates.push('name = ?');
    params.push(trimmedName);
  }

  if (scopes != null) {
    updates.push('scopes = ?');
    params.push(JSON.stringify(normalizeApiKeyScopes(scopes)));
  }

  if (ipWhitelist != null) {
    const normalizedWhitelist = normalizeIpWhitelist(ipWhitelist);
    if (!normalizedWhitelist.length) {
      const err = new Error('At least one IP address or CIDR range is required for server whitelisting.');
      err.status = 400;
      throw err;
    }
    updates.push('ip_whitelist = ?');
    params.push(JSON.stringify(normalizedWhitelist));
  }

  if (status != null) {
    const nextStatus = String(status).trim().toLowerCase();
    if (!['active', 'inactive'].includes(nextStatus)) {
      const err = new Error('Status must be active or inactive.');
      err.status = 400;
      throw err;
    }
    updates.push('status = ?');
    params.push(nextStatus);
  }

  if (!updates.length) {
    const err = new Error('No changes provided.');
    err.status = 400;
    throw err;
  }

  params.push(keyId);
  await pool.query(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`, params);

  const [[row]] = await pool.query(
    `SELECT id, name, key_prefix, key_hash, scopes, ip_whitelist, status, created_by, last_used_at, expires_at, created_at, updated_at
     FROM api_keys WHERE id = ?`,
    [keyId],
  );
  return mapApiKeyRow(row);
}

export async function deleteApiKey(id) {
  const keyId = String(id || '').trim();
  if (!keyId) {
    const err = new Error('API key id is required.');
    err.status = 400;
    throw err;
  }

  const [result] = await pool.query('DELETE FROM api_keys WHERE id = ?', [keyId]);
  if (!result.affectedRows) {
    const err = new Error('API key not found.');
    err.status = 404;
    throw err;
  }
}

export async function findApiKeyByRawKey(rawKey) {
  const token = String(rawKey || '').trim();
  if (!token.startsWith('gfl_') || token.length < 16) return null;

  const prefix = token.slice(0, 12);
  const [[row]] = await pool.query(
    `SELECT id, name, key_prefix, key_hash, scopes, ip_whitelist, status, created_by, last_used_at, expires_at, created_at, updated_at
     FROM api_keys
     WHERE key_prefix = ? AND status = 'active'
     LIMIT 1`,
    [prefix],
  );
  if (!row) return null;

  const expectedHash = hashApiKey(token);
  if (!timingSafeCompare(expectedHash, row.key_hash)) return null;

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;

  return mapApiKeyRow(row);
}

export async function touchApiKeyLastUsed(id) {
  if (!id) return;
  await pool.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
}

function ipv4ToInt(ip) {
  const parts = String(ip).trim().split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function matchIpv4Cidr(clientIp, cidr) {
  const [network, bitsRaw] = String(cidr).split('/');
  const bits = bitsRaw == null ? 32 : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipv4ToInt(clientIp);
  const networkInt = ipv4ToInt(network);
  if (ipInt == null || networkInt == null) return false;

  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
  return (ipInt & mask) === (networkInt & mask);
}

function normalizeIpAddress(value) {
  return String(value || '').trim().replace(/^::ffff:/i, '');
}

function isPrivateOrLoopbackIp(ip) {
  const normalized = normalizeIpAddress(ip);
  if (!normalized) return true;
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') return true;

  const parts = normalized.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd');
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function pickForwardedClientIp(headerValue = '') {
  const candidates = String(headerValue || '')
    .split(',')
    .map((part) => normalizeIpAddress(part))
    .filter(Boolean);

  if (!candidates.length) return '';

  const publicCandidate = candidates.find((candidate) => !isPrivateOrLoopbackIp(candidate));
  return publicCandidate || candidates[0];
}

export function getClientIp(req, { trustProxy = false } = {}) {
  if (trustProxy) {
    const trustedHeaders = [
      req.headers['cf-connecting-ip'],
      req.headers['true-client-ip'],
      req.headers['x-real-ip'],
      req.headers['x-client-ip'],
    ];

    for (const headerValue of trustedHeaders) {
      const candidate = normalizeIpAddress(headerValue);
      if (candidate) return candidate;
    }

    const forwardedIp = pickForwardedClientIp(req.headers['x-forwarded-for']);
    if (forwardedIp) return forwardedIp;
  }

  return normalizeIpAddress(req.ip || req.socket?.remoteAddress || '');
}

export function isIpAllowed(clientIp, whitelist = []) {
  const ip = normalizeIpAddress(clientIp);
  const entries = (whitelist || []).map((value) => normalizeIpAddress(value)).filter(Boolean);
  if (!entries.length) return false;
  if (!ip) return false;

  for (const entry of entries) {
    if (entry.includes('/')) {
      if (matchIpv4Cidr(ip, entry)) return true;
      continue;
    }
    if (entry === ip) return true;
  }

  return false;
}
