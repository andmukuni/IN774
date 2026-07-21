import crypto from 'crypto';
import pool from '../db.js';

export const MONITOR_TYPES = ['http', 'tcp', 'mysql'];
export const MONITOR_STATUSES = ['unknown', 'up', 'down'];
export const FAILURE_THRESHOLD = 3;
export const CHECK_RETENTION_DAYS = 30;
export const DEFAULT_INTERVAL_SECONDS = 300;
export const DEFAULT_TIMEOUT_MS = 8000;

function generateMonitorId(prefix = 'mon') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return fallback;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function ensureMonitorTables(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS monitor_targets (
      id VARCHAR(90) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      type VARCHAR(20) NOT NULL,
      host_or_url VARCHAR(500) NOT NULL,
      port INT NULL,
      path VARCHAR(255) NOT NULL DEFAULT '',
      expected_status INT NULL,
      interval_seconds INT NOT NULL DEFAULT 300,
      timeout_ms INT NOT NULL DEFAULT 8000,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      allow_private_network TINYINT(1) NOT NULL DEFAULT 0,
      db_name VARCHAR(120) NULL,
      db_user VARCHAR(120) NULL,
      db_password TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'unknown',
      consecutive_failures INT NOT NULL DEFAULT 0,
      last_checked_at DATETIME NULL,
      last_latency_ms INT NULL,
      last_error TEXT NULL,
      notify_email VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_monitor_targets_enabled (enabled),
      INDEX idx_monitor_targets_status (status),
      INDEX idx_monitor_targets_type (type)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS monitor_check_results (
      id VARCHAR(90) PRIMARY KEY,
      target_id VARCHAR(90) NOT NULL,
      ok TINYINT(1) NOT NULL,
      latency_ms INT NULL,
      error TEXT NULL,
      checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_monitor_checks_target_time (target_id, checked_at),
      CONSTRAINT fk_monitor_checks_target
        FOREIGN KEY (target_id) REFERENCES monitor_targets(id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS monitor_incidents (
      id VARCHAR(90) PRIMARY KEY,
      target_id VARCHAR(90) NOT NULL,
      started_at DATETIME NOT NULL,
      ended_at DATETIME NULL,
      last_error TEXT NULL,
      INDEX idx_monitor_incidents_target (target_id, started_at),
      INDEX idx_monitor_incidents_open (target_id, ended_at),
      CONSTRAINT fk_monitor_incidents_target
        FOREIGN KEY (target_id) REFERENCES monitor_targets(id) ON DELETE CASCADE
    )
  `);
}

function mapTargetRow(row, { includeSecrets = false } = {}) {
  if (!row) return null;
  const data = {
    id: row.id,
    name: row.name,
    type: row.type,
    hostOrUrl: row.host_or_url,
    port: row.port == null ? null : Number(row.port),
    path: row.path || '',
    expectedStatus: row.expected_status == null ? null : Number(row.expected_status),
    intervalSeconds: Number(row.interval_seconds) || DEFAULT_INTERVAL_SECONDS,
    timeoutMs: Number(row.timeout_ms) || DEFAULT_TIMEOUT_MS,
    enabled: Boolean(row.enabled),
    allowPrivateNetwork: Boolean(row.allow_private_network),
    dbName: row.db_name || null,
    dbUser: row.db_user || null,
    dbPasswordConfigured: Boolean(row.db_password),
    status: row.status || 'unknown',
    consecutiveFailures: Number(row.consecutive_failures) || 0,
    lastCheckedAt: row.last_checked_at || null,
    lastLatencyMs: row.last_latency_ms == null ? null : Number(row.last_latency_ms),
    lastError: row.last_error || null,
    notifyEmail: row.notify_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeSecrets) {
    data.dbPassword = row.db_password || null;
  }
  return data;
}

function normalizeType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!MONITOR_TYPES.includes(t)) {
    throw httpError('Type must be http, tcp, or mysql.');
  }
  return t;
}

function normalizeInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 60) {
    throw httpError('Interval must be at least 60 seconds.');
  }
  if (n > 86400) {
    throw httpError('Interval cannot exceed 24 hours.');
  }
  return Math.round(n);
}

function normalizeTimeout(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1000) {
    throw httpError('Timeout must be at least 1000 ms.');
  }
  if (n > 60000) {
    throw httpError('Timeout cannot exceed 60000 ms.');
  }
  return Math.round(n);
}

function normalizePort(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError('Port is required.');
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw httpError('Port must be between 1 and 65535.');
  }
  return n;
}

function validateTargetInput(body, { isUpdate = false, existing = null } = {}) {
  const type = normalizeType(isUpdate && body.type == null ? existing.type : body.type);
  const name = String(body.name ?? existing?.name ?? '').trim();
  if (!name) throw httpError('Name is required.');

  let hostOrUrl = String(body.hostOrUrl ?? body.host_or_url ?? existing?.hostOrUrl ?? '').trim();
  if (!hostOrUrl) throw httpError('Host or URL is required.');

  let port = body.port !== undefined ? normalizePort(body.port, { required: type !== 'http' }) : existing?.port;
  if (type === 'http') {
    try {
      const url = new URL(hostOrUrl.includes('://') ? hostOrUrl : `https://${hostOrUrl}`);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw httpError('HTTP targets must use http or https.');
      }
      hostOrUrl = url.toString();
      if (body.port === undefined || body.port === null || body.port === '') {
        port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
      }
    } catch (err) {
      if (err.status) throw err;
      throw httpError('Invalid URL.');
    }
  } else if (type === 'tcp') {
    port = normalizePort(port ?? body.port, { required: true });
  } else if (type === 'mysql') {
    port = normalizePort(port ?? body.port ?? 3306, { required: true });
  }

  const path = String(body.path ?? existing?.path ?? '').trim();
  let expectedStatus = body.expectedStatus ?? body.expected_status;
  if (expectedStatus === undefined || expectedStatus === null || expectedStatus === '') {
    expectedStatus = existing?.expectedStatus ?? null;
  } else {
    expectedStatus = Number(expectedStatus);
    if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
      throw httpError('Expected status must be a valid HTTP status code.');
    }
  }

  const intervalSeconds = normalizeInterval(
    body.intervalSeconds ?? body.interval_seconds ?? existing?.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS,
  );
  const timeoutMs = normalizeTimeout(
    body.timeoutMs ?? body.timeout_ms ?? existing?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const enabled = toBool(body.enabled ?? existing?.enabled ?? true, true);
  const allowPrivateNetwork = toBool(
    body.allowPrivateNetwork ?? body.allow_private_network ?? existing?.allowPrivateNetwork ?? false,
    false,
  );

  let dbName = body.dbName ?? body.db_name;
  let dbUser = body.dbUser ?? body.db_user;
  let dbPassword = body.dbPassword ?? body.db_password;
  if (type === 'mysql') {
    dbName = String(dbName ?? existing?.dbName ?? '').trim();
    dbUser = String(dbUser ?? existing?.dbUser ?? '').trim();
    if (!dbName) throw httpError('Database name is required for MySQL targets.');
    if (!dbUser) throw httpError('Database user is required for MySQL targets.');
    if (!isUpdate && !String(dbPassword || '').trim()) {
      throw httpError('Database password is required for MySQL targets.');
    }
    if (dbPassword !== undefined && dbPassword !== null && String(dbPassword).trim() === '' && isUpdate) {
      dbPassword = undefined; // keep existing
    }
  } else {
    dbName = null;
    dbUser = null;
    dbPassword = null;
  }

  const notifyEmailRaw = body.notifyEmail ?? body.notify_email;
  let notifyEmail = notifyEmailRaw === undefined
    ? (existing?.notifyEmail ?? null)
    : String(notifyEmailRaw || '').trim() || null;

  return {
    name,
    type,
    hostOrUrl,
    port,
    path,
    expectedStatus: type === 'http' ? expectedStatus : null,
    intervalSeconds,
    timeoutMs,
    enabled,
    allowPrivateNetwork,
    dbName,
    dbUser,
    dbPassword,
    notifyEmail,
  };
}

export async function listMonitorTargets() {
  const [rows] = await pool.query(
    `SELECT * FROM monitor_targets ORDER BY name ASC, created_at DESC`,
  );
  return rows.map((row) => mapTargetRow(row));
}

export async function getMonitorTarget(id, { includeSecrets = false } = {}) {
  const [[row]] = await pool.query('SELECT * FROM monitor_targets WHERE id = ? LIMIT 1', [id]);
  if (!row) {
    throw httpError('Monitor target not found.', 404);
  }
  return mapTargetRow(row, { includeSecrets });
}

export async function createMonitorTarget(body) {
  const input = validateTargetInput(body);
  const id = generateMonitorId('mon');
  await pool.query(
    `INSERT INTO monitor_targets (
      id, name, type, host_or_url, port, path, expected_status,
      interval_seconds, timeout_ms, enabled, allow_private_network,
      db_name, db_user, db_password, notify_email, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown')`,
    [
      id,
      input.name,
      input.type,
      input.hostOrUrl,
      input.port,
      input.path,
      input.expectedStatus,
      input.intervalSeconds,
      input.timeoutMs,
      input.enabled ? 1 : 0,
      input.allowPrivateNetwork ? 1 : 0,
      input.dbName,
      input.dbUser,
      input.dbPassword ? String(input.dbPassword) : null,
      input.notifyEmail,
    ],
  );
  return getMonitorTarget(id);
}

export async function updateMonitorTarget(id, body) {
  const existing = await getMonitorTarget(id, { includeSecrets: true });
  const input = validateTargetInput(body, { isUpdate: true, existing });

  let nextPassword = existing.dbPassword;
  if (input.type === 'mysql') {
    if (input.dbPassword !== undefined && input.dbPassword !== null && String(input.dbPassword).length) {
      nextPassword = String(input.dbPassword);
    }
  } else {
    nextPassword = null;
  }

  await pool.query(
    `UPDATE monitor_targets SET
      name = ?, type = ?, host_or_url = ?, port = ?, path = ?, expected_status = ?,
      interval_seconds = ?, timeout_ms = ?, enabled = ?, allow_private_network = ?,
      db_name = ?, db_user = ?, db_password = ?, notify_email = ?
     WHERE id = ?`,
    [
      input.name,
      input.type,
      input.hostOrUrl,
      input.port,
      input.path,
      input.expectedStatus,
      input.intervalSeconds,
      input.timeoutMs,
      input.enabled ? 1 : 0,
      input.allowPrivateNetwork ? 1 : 0,
      input.dbName,
      input.dbUser,
      nextPassword,
      input.notifyEmail,
      id,
    ],
  );
  return getMonitorTarget(id);
}

export async function deleteMonitorTarget(id) {
  await getMonitorTarget(id);
  await pool.query('DELETE FROM monitor_targets WHERE id = ?', [id]);
}

export async function listDueMonitorTargets({ limit = 20 } = {}) {
  const [rows] = await pool.query(
    `SELECT * FROM monitor_targets
     WHERE enabled = 1
       AND (
         last_checked_at IS NULL
         OR last_checked_at <= DATE_SUB(NOW(), INTERVAL interval_seconds SECOND)
       )
     ORDER BY last_checked_at IS NULL DESC, last_checked_at ASC
     LIMIT ?`,
    [limit],
  );
  return rows.map((row) => mapTargetRow(row, { includeSecrets: true }));
}

export async function recordCheckResult(targetId, { ok, latencyMs = null, error = null }) {
  const id = generateMonitorId('mcr');
  await pool.query(
    `INSERT INTO monitor_check_results (id, target_id, ok, latency_ms, error, checked_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [id, targetId, ok ? 1 : 0, latencyMs, error ? String(error).slice(0, 2000) : null],
  );
  return id;
}

export async function getOpenIncident(targetId) {
  const [[row]] = await pool.query(
    `SELECT * FROM monitor_incidents
     WHERE target_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [targetId],
  );
  return row || null;
}

export async function openIncident(targetId, lastError = null) {
  const existing = await getOpenIncident(targetId);
  if (existing) {
    await pool.query(
      'UPDATE monitor_incidents SET last_error = ? WHERE id = ?',
      [lastError ? String(lastError).slice(0, 2000) : null, existing.id],
    );
    return existing.id;
  }
  const id = generateMonitorId('min');
  await pool.query(
    `INSERT INTO monitor_incidents (id, target_id, started_at, last_error)
     VALUES (?, ?, NOW(), ?)`,
    [id, targetId, lastError ? String(lastError).slice(0, 2000) : null],
  );
  return id;
}

export async function closeOpenIncident(targetId) {
  const existing = await getOpenIncident(targetId);
  if (!existing) return null;
  await pool.query(
    'UPDATE monitor_incidents SET ended_at = NOW() WHERE id = ?',
    [existing.id],
  );
  return existing.id;
}

export async function applyCheckOutcome(target, result) {
  const ok = Boolean(result?.ok);
  const latencyMs = result?.latencyMs == null ? null : Number(result.latencyMs);
  const error = result?.error ? String(result.error).slice(0, 2000) : null;
  const prevStatus = target.status || 'unknown';
  let consecutiveFailures = Number(target.consecutiveFailures) || 0;
  let nextStatus = prevStatus;
  let transition = null;

  await recordCheckResult(target.id, { ok, latencyMs, error });

  if (ok) {
    consecutiveFailures = 0;
    if (prevStatus === 'down') {
      await closeOpenIncident(target.id);
      nextStatus = 'up';
      transition = { from: 'down', to: 'up' };
    } else {
      nextStatus = 'up';
    }
  } else {
    consecutiveFailures += 1;
    if (prevStatus !== 'down' && consecutiveFailures >= FAILURE_THRESHOLD) {
      await openIncident(target.id, error);
      nextStatus = 'down';
      transition = { from: prevStatus, to: 'down' };
    } else if (prevStatus === 'down') {
      await openIncident(target.id, error);
      nextStatus = 'down';
    } else if (prevStatus === 'unknown') {
      nextStatus = 'unknown';
    }
  }

  await pool.query(
    `UPDATE monitor_targets SET
      status = ?,
      consecutive_failures = ?,
      last_checked_at = NOW(),
      last_latency_ms = ?,
      last_error = ?
     WHERE id = ?`,
    [nextStatus, consecutiveFailures, latencyMs, error, target.id],
  );

  const updated = await getMonitorTarget(target.id);
  return { target: updated, transition, ok, error };
}

export async function listRecentChecks(targetId, { limit = 50 } = {}) {
  const [rows] = await pool.query(
    `SELECT id, target_id, ok, latency_ms, error, checked_at
     FROM monitor_check_results
     WHERE target_id = ?
     ORDER BY checked_at DESC
     LIMIT ?`,
    [targetId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    targetId: row.target_id,
    ok: Boolean(row.ok),
    latencyMs: row.latency_ms == null ? null : Number(row.latency_ms),
    error: row.error || null,
    checkedAt: row.checked_at,
  }));
}

export async function listIncidents(targetId, { from = null, to = null, limit = 100 } = {}) {
  const params = [targetId];
  let sql = `
    SELECT id, target_id, started_at, ended_at, last_error
    FROM monitor_incidents
    WHERE target_id = ?
  `;
  if (from) {
    sql += ' AND (ended_at IS NULL OR ended_at >= ?)';
    params.push(from);
  }
  if (to) {
    sql += ' AND started_at <= ?';
    params.push(to);
  }
  sql += ' ORDER BY started_at DESC LIMIT ?';
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows.map((row) => ({
    id: row.id,
    targetId: row.target_id,
    startedAt: row.started_at,
    endedAt: row.ended_at || null,
    lastError: row.last_error || null,
    open: !row.ended_at,
  }));
}

function toDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function getUptimeReport(targetId, { from = null, to = null } = {}) {
  const end = toDate(to, new Date());
  const start = toDate(from, new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000));
  if (start >= end) {
    throw httpError('Report "from" must be before "to".');
  }

  const incidents = await listIncidents(targetId, {
    from: start.toISOString().slice(0, 19).replace('T', ' '),
    to: end.toISOString().slice(0, 19).replace('T', ' '),
    limit: 500,
  });

  const windowMs = end.getTime() - start.getTime();
  let downtimeMs = 0;
  for (const incident of incidents) {
    const iStart = Math.max(new Date(incident.startedAt).getTime(), start.getTime());
    const iEnd = Math.min(
      incident.endedAt ? new Date(incident.endedAt).getTime() : end.getTime(),
      end.getTime(),
    );
    if (iEnd > iStart) downtimeMs += iEnd - iStart;
  }

  const uptimeRatio = windowMs > 0 ? Math.max(0, Math.min(1, 1 - downtimeMs / windowMs)) : 1;
  const target = await getMonitorTarget(targetId);

  return {
    targetId,
    targetName: target.name,
    status: target.status,
    from: start.toISOString(),
    to: end.toISOString(),
    windowMs,
    downtimeMs,
    uptimePercent: Math.round(uptimeRatio * 10000) / 100,
    incidentCount: incidents.length,
    openIncidentCount: incidents.filter((i) => i.open).length,
    incidents,
  };
}

export async function pruneOldCheckResults() {
  await pool.query(
    `DELETE FROM monitor_check_results
     WHERE checked_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [CHECK_RETENTION_DAYS],
  );
}
