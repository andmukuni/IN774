import crypto from 'crypto';
import pool from '../db.js';
import {
  hasPresenceStreamClients,
  publishPresenceEvent,
  schedulePresenceBroadcast,
  setPresenceBroadcastHandler,
} from './presenceEvents.js';

/** Missed-heartbeat window. Must stay above agent interval (2–5 min) to avoid false offline. */
export const PRESENCE_OFFLINE_THRESHOLD_MINUTES = Number(process.env.PRESENCE_OFFLINE_THRESHOLD_MINUTES || 8);

export function presenceThresholdMinutes() {
  return Math.max(1, Number(PRESENCE_OFFLINE_THRESHOLD_MINUTES) || 8);
}

const PRESENCE_SELECT = `
  dp.id,
  dp.machine_id,
  dp.product_id,
  dp.hostname,
  dp.serial_number,
  dp.os_version,
  dp.logged_in_user,
  dp.local_ip,
  dp.agent_version,
  dp.last_heartbeat_at,
  dp.online_status,
  dp.status_changed_at,
  dp.employee_id,
  dp.branch_id,
  dp.created_at,
  dp.updated_at,
  p.sku AS product_sku,
  p.name AS product_name,
  e.first_name AS employee_first_name,
  e.last_name AS employee_last_name,
  e.employee_code,
  b.name AS branch_name,
  b.code AS branch_code
`;

const PRESENCE_JOIN = `
  FROM device_presence dp
  LEFT JOIN products p ON p.id = dp.product_id
  LEFT JOIN employees e ON e.id = dp.employee_id
  LEFT JOIN branches b ON b.id = dp.branch_id
`;

function generateId(prefix = 'dpr') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function isHeartbeatStale(lastHeartbeatAt) {
  if (!lastHeartbeatAt) return true;
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  if (!Number.isFinite(ageMs)) return true;
  return ageMs > presenceThresholdMinutes() * 60 * 1000;
}

function mapPresenceRow(row) {
  if (!row) return null;
  const employeeName = [row.employee_first_name, row.employee_last_name].filter(Boolean).join(' ').trim();
  const statusChangedAt = row.status_changed_at
    ? new Date(row.status_changed_at).toISOString()
    : null;
  const lastHeartbeatAt = row.last_heartbeat_at
    ? new Date(row.last_heartbeat_at).toISOString()
    : null;
  const storedStatus = String(row.online_status || 'offline').toLowerCase();
  // Force-off / crash: DB may still say online until the sweeper runs — show offline if heartbeat is stale.
  const onlineStatus = storedStatus === 'online' && !isHeartbeatStale(lastHeartbeatAt)
    ? 'online'
    : 'offline';

  // Prefer explicit transition time; fall back for legacy rows.
  const durationSince = onlineStatus === 'offline' && isHeartbeatStale(lastHeartbeatAt) && lastHeartbeatAt
    ? lastHeartbeatAt
    : statusChangedAt
      || (onlineStatus === 'online' ? lastHeartbeatAt : null)
      || (row.updated_at ? new Date(row.updated_at).toISOString() : null);

  return {
    id: row.id,
    machineId: row.machine_id,
    productId: row.product_id || null,
    hostname: row.hostname || '',
    serialNumber: row.serial_number || '',
    osVersion: row.os_version || '',
    loggedInUser: row.logged_in_user || '',
    localIp: row.local_ip || '',
    agentVersion: row.agent_version || '',
    lastHeartbeatAt,
    onlineStatus,
    statusChangedAt,
    durationSince,
    employeeId: row.employee_id || null,
    branchId: row.branch_id || null,
    employeeName: employeeName || null,
    employeeCode: row.employee_code || null,
    branchName: row.branch_name || null,
    branchCode: row.branch_code || null,
    productSku: row.product_sku || null,
    productName: row.product_name || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function ensurePresenceTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_presence (
      id VARCHAR(90) PRIMARY KEY,
      machine_id VARCHAR(90) NOT NULL UNIQUE,
      product_id VARCHAR(90) NULL,
      hostname VARCHAR(255) NOT NULL DEFAULT '',
      serial_number VARCHAR(120) NOT NULL DEFAULT '',
      os_version VARCHAR(255) NOT NULL DEFAULT '',
      logged_in_user VARCHAR(120) NOT NULL DEFAULT '',
      local_ip VARCHAR(45) NOT NULL DEFAULT '',
      agent_version VARCHAR(40) NOT NULL DEFAULT '',
      last_heartbeat_at DATETIME NULL,
      online_status VARCHAR(20) NOT NULL DEFAULT 'offline',
      status_changed_at DATETIME NULL,
      employee_id VARCHAR(90) NULL,
      branch_id VARCHAR(90) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_device_presence_status (online_status),
      INDEX idx_device_presence_last_heartbeat (last_heartbeat_at),
      INDEX idx_device_presence_serial (serial_number),
      INDEX idx_device_presence_hostname (hostname)
    )
  `);

  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM device_presence LIKE 'status_changed_at'`);
    if (!cols.length) {
      await pool.query('ALTER TABLE device_presence ADD COLUMN status_changed_at DATETIME NULL AFTER online_status');
    }
  } catch {
    // ignore if column already exists / race
  }

  // Backfill missing transition timestamps once.
  await pool.query(`
    UPDATE device_presence
    SET status_changed_at = COALESCE(last_heartbeat_at, updated_at, created_at, NOW())
    WHERE status_changed_at IS NULL
  `);
}

async function findProductBySerial(serialNumber) {
  const serial = String(serialNumber || '').trim();
  if (!serial) return null;
  const [[row]] = await pool.query(
    `SELECT p.id, p.employee_id, p.sku, p.name,
            COALESCE(p.branch_id, e.branch_id) AS branch_id
     FROM products p
     LEFT JOIN employees e ON e.id = p.employee_id
     WHERE p.sku = ? AND p.status != 'discontinued'
     LIMIT 1`,
    [serial],
  );
  return row || null;
}

export async function upsertHeartbeat(payload = {}) {
  const machineId = String(payload.machineId || payload.machine_id || '').trim();
  if (!machineId) {
    const error = new Error('machineId is required.');
    error.status = 400;
    throw error;
  }

  const hostname = String(payload.hostname || '').trim().slice(0, 255);
  const serialNumber = String(payload.serialNumber || payload.serial_number || '').trim().slice(0, 120);
  const osVersion = String(payload.osVersion || payload.os_version || '').trim().slice(0, 255);
  const loggedInUser = String(payload.loggedInUser || payload.logged_in_user || '').trim().slice(0, 120);
  const localIp = String(payload.localIp || payload.local_ip || '').trim().slice(0, 45);
  const agentVersion = String(payload.agentVersion || payload.agent_version || '').trim().slice(0, 40);
  const requestedStatus = String(payload.status || payload.online_status || '').trim().toLowerCase();
  const markOffline = requestedStatus === 'offline'
    || payload.online === false
    || payload.online === 'false'
    || payload.online === 0;

  const product = await findProductBySerial(serialNumber);
  const productId = product?.id || null;
  const employeeId = product?.employee_id || null;
  const branchId = product?.branch_id || null;
  const nextStatus = markOffline ? 'offline' : 'online';

  const [[existing]] = await pool.query(
    'SELECT id, online_status FROM device_presence WHERE machine_id = ? LIMIT 1',
    [machineId],
  );

  if (existing?.id) {
    const statusChanged = existing.online_status !== nextStatus;
    await pool.query(
      `UPDATE device_presence
       SET product_id = ?,
           hostname = ?,
           serial_number = ?,
           os_version = ?,
           logged_in_user = ?,
           local_ip = ?,
           agent_version = ?,
           last_heartbeat_at = NOW(),
           online_status = ?,
           status_changed_at = CASE
             WHEN online_status != ? OR status_changed_at IS NULL THEN NOW()
             ELSE status_changed_at
           END,
           employee_id = ?,
           branch_id = ?
       WHERE machine_id = ?`,
      [
        productId, hostname, serialNumber, osVersion, loggedInUser, localIp, agentVersion,
        nextStatus, nextStatus, employeeId, branchId, machineId,
      ],
    );
    if (statusChanged) {
      schedulePresenceBroadcast({ immediate: true });
    } else if (!markOffline) {
      schedulePresenceBroadcast({ delayMs: 1500 });
    }
  } else {
    const id = generateId();
    await pool.query(
      `INSERT INTO device_presence (
         id, machine_id, product_id, hostname, serial_number, os_version,
         logged_in_user, local_ip, agent_version, last_heartbeat_at, online_status,
         status_changed_at, employee_id, branch_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?, ?)`,
      [id, machineId, productId, hostname, serialNumber, osVersion, loggedInUser, localIp, agentVersion, nextStatus, employeeId, branchId],
    );
    schedulePresenceBroadcast({ immediate: true });
  }

  const [[row]] = await pool.query(
    `SELECT ${PRESENCE_SELECT} ${PRESENCE_JOIN} WHERE dp.machine_id = ? LIMIT 1`,
    [machineId],
  );
  return mapPresenceRow(row);
}

export async function markStaleDevicesOffline({ notify = true } = {}) {
  const thresholdMinutes = presenceThresholdMinutes();
  const [result] = await pool.query(
    `UPDATE device_presence
     SET online_status = 'offline',
         status_changed_at = NOW()
     WHERE online_status = 'online'
       AND (
         last_heartbeat_at IS NULL
         OR last_heartbeat_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       )`,
    [thresholdMinutes],
  );
  const marked = Number(result?.affectedRows || 0);
  if (marked > 0 && notify) {
    schedulePresenceBroadcast({ immediate: true });
  }
  return marked;
}

export async function listPresenceDevices({
  status = '',
  search = '',
  limit = 50,
  offset = 0,
  sweepNotify = true,
} = {}) {
  // Keep DB in sync so filters/counts match what the UI shows after force shutdowns.
  // When called from the SSE broadcaster, skip notify to avoid re-entrant broadcasts.
  await markStaleDevicesOffline({ notify: sweepNotify });

  const clauses = [];
  const params = [];
  const threshold = presenceThresholdMinutes();

  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'online') {
    clauses.push(`dp.online_status = 'online'
      AND dp.last_heartbeat_at IS NOT NULL
      AND dp.last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`);
    params.push(threshold);
  } else if (normalizedStatus === 'offline') {
    clauses.push(`(
      dp.online_status != 'online'
      OR dp.last_heartbeat_at IS NULL
      OR dp.last_heartbeat_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
    )`);
    params.push(threshold);
  }

  const term = String(search || '').trim();
  if (term) {
    clauses.push(`(
      dp.hostname LIKE ?
      OR dp.serial_number LIKE ?
      OR dp.logged_in_user LIKE ?
      OR dp.local_ip LIKE ?
      OR p.sku LIKE ?
      OR p.name LIKE ?
      OR e.first_name LIKE ?
      OR e.last_name LIKE ?
      OR e.employee_code LIKE ?
      OR b.name LIKE ?
    )`);
    const like = `%${term}%`;
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total ${PRESENCE_JOIN} ${where}`,
    params,
  );
  const total = Number(countRow?.total || 0);

  const [rows] = await pool.query(
    `SELECT ${PRESENCE_SELECT} ${PRESENCE_JOIN}
     ${where}
     ORDER BY dp.last_heartbeat_at DESC, dp.hostname ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset],
  );

  return {
    data: rows.map(mapPresenceRow),
    total,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function getPresenceDevice(id) {
  const deviceId = String(id || '').trim();
  if (!deviceId) return null;
  const [[row]] = await pool.query(
    `SELECT ${PRESENCE_SELECT} ${PRESENCE_JOIN} WHERE dp.id = ? LIMIT 1`,
    [deviceId],
  );
  return mapPresenceRow(row);
}

export async function getPresenceSummary() {
  // Sweep without nested SSE broadcast (caller / scheduler handles notify).
  await markStaleDevicesOffline({ notify: false });
  const threshold = presenceThresholdMinutes();
  const [[row]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE
        WHEN online_status = 'online'
         AND last_heartbeat_at IS NOT NULL
         AND last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        THEN 1 ELSE 0 END) AS online_count,
      SUM(CASE
        WHEN online_status != 'online'
          OR last_heartbeat_at IS NULL
          OR last_heartbeat_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        THEN 1 ELSE 0 END) AS offline_count
    FROM device_presence
    `,
    [threshold, threshold],
  );
  return {
    total: Number(row?.total || 0),
    online: Number(row?.online_count || 0),
    offline: Number(row?.offline_count || 0),
  };
}

export async function broadcastPresenceSnapshot() {
  if (!hasPresenceStreamClients()) return null;
  const result = await listPresenceDevices({ limit: 200, offset: 0, sweepNotify: false });
  const summary = await getPresenceSummary();
  const payload = {
    devices: result.data,
    summary,
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
    at: new Date().toISOString(),
  };
  publishPresenceEvent('snapshot', payload);
  return payload;
}

setPresenceBroadcastHandler(broadcastPresenceSnapshot);
