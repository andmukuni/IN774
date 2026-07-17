import crypto from 'crypto';
import pool from '../db.js';
import { mapEmployeeRow } from './employeeHelpers.js';
import { mapBranchRow } from './branchHelpers.js';
import {
  INTAKE_EMPLOYEE_DEVICE_TYPES,
  fetchEmployeeIntakeDevices,
  normalizeIntakeEmail,
  normalizeIntakePhone,
} from './intakeHelpers.js';
import { getAllSettings } from './systemSettingsHelpers.js';
import { sendEmail } from './emailService.js';

const TOKEN_TTL_DAYS = 14;

export async function ensureReminderTables(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS reminder_sessions (
      id VARCHAR(90) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      branch_id VARCHAR(90) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      total_recipients INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      clicked_count INT NOT NULL DEFAULT 0,
      submitted_count INT NOT NULL DEFAULT 0,
      created_by VARCHAR(90) NULL,
      sent_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reminder_sessions_branch (branch_id),
      INDEX idx_reminder_sessions_status (status),
      INDEX idx_reminder_sessions_sent_at (sent_at)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminder_deliveries (
      id VARCHAR(90) PRIMARY KEY,
      session_id VARCHAR(90) NOT NULL,
      employee_id VARCHAR(90) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      token_expires_at DATETIME NOT NULL,
      missing_fields_json TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      sent_at DATETIME NULL,
      clicked_at DATETIME NULL,
      submitted_at DATETIME NULL,
      error_message VARCHAR(500) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reminder_deliveries_session (session_id),
      INDEX idx_reminder_deliveries_employee (employee_id),
      INDEX idx_reminder_deliveries_token (token_hash),
      INDEX idx_reminder_deliveries_status (status)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminder_events (
      id VARCHAR(90) PRIMARY KEY,
      delivery_id VARCHAR(90) NOT NULL,
      event_type VARCHAR(40) NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(500) NULL,
      metadata_json TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reminder_events_delivery (delivery_id),
      INDEX idx_reminder_events_type (event_type)
    )
  `);
}

export function hashReminderToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function generateReminderToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function emailToLocalPart(email) {
  const normalized = normalizeIntakeEmail(email);
  if (!normalized) return '';
  if (normalized.endsWith('@goodfellow.co.zm')) {
    return normalized.slice(0, -'@goodfellow.co.zm'.length);
  }
  const at = normalized.indexOf('@');
  return at > 0 ? normalized.slice(0, at) : normalized;
}

export function phoneToLocalPart(phone) {
  const normalized = normalizeIntakePhone(phone);
  if (!normalized) return '';
  return normalized.replace(/^\+260/, '').replace(/^0+/, '');
}

export async function analyzeEmployeeIncomplete(employeeRow) {
  const employee = mapEmployeeRow(employeeRow);
  const devices = await fetchEmployeeIntakeDevices(employee.id);
  const missing = [];

  if (!String(employee.phone || '').trim()) missing.push('phone');
  if (!devices.length) missing.push('assets');

  return {
    employee,
    devices,
    missing,
    intakeDeviceCount: devices.length,
  };
}

export async function findIncompleteEmployees({ branchId = '' } = {}, db = pool) {
  const clauses = [
    "e.status = 'active'",
    "TRIM(e.email) != ''",
    'b.status = \'active\'',
  ];
  const params = [];

  if (branchId) {
    clauses.push('e.branch_id = ?');
    params.push(branchId);
  }

  const [rows] = await db.query(
    `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title,
            e.branch_id, e.status, e.updated_at, b.code AS branch_code, b.name AS branch_name
     FROM employees e
     INNER JOIN branches b ON b.id = e.branch_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY b.name ASC, e.last_name ASC, e.first_name ASC`,
    params,
  );

  const results = [];
  for (const row of rows) {
    const analysis = await analyzeEmployeeIncomplete(row);
    if (analysis.missing.length) {
      results.push(analysis);
    }
  }
  return results;
}

export function buildReminderLink({ branchCode, token, appUrl }) {
  const base = String(appUrl || '').trim().replace(/\/$/, '') || 'http://localhost:5173';
  return `${base}/intake/${encodeURIComponent(branchCode)}?t=${encodeURIComponent(token)}`;
}

export function buildReminderEmailContent({
  employee,
  branch,
  missing = [],
  link,
  companyName = 'Goodfellow Inventory',
}) {
  const firstName = employee.firstName || 'Colleague';
  const branchName = branch?.name || 'your branch';
  const tasks = [];

  if (missing.includes('phone')) {
    tasks.push('add your mobile phone number');
  }
  if (missing.includes('assets')) {
    tasks.push('report the computers and devices you use for work');
  }

  const taskText = tasks.length === 1
    ? tasks[0]
    : `${tasks.slice(0, -1).join(', ')} and ${tasks[tasks.length - 1]}`;

  const subject = `Reminder: complete your equipment report — ${branchName}`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Our records show your branch equipment report at ${branchName} is incomplete.`,
    tasks.length ? `Please ${taskText}.` : 'Please complete your equipment report.',
    '',
    'Use your personal link below — it will open the form with your details already filled in:',
    link,
    '',
    'This link is unique to you and expires in 14 days.',
    '',
    `Thank you,`,
    companyName,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:560px">
      <p>Hi ${firstName},</p>
      <p>Our records show your branch equipment report at <strong>${branchName}</strong> is incomplete.</p>
      ${tasks.length ? `<p>Please <strong>${taskText}</strong>.</p>` : '<p>Please complete your equipment report.</p>'}
      <p style="margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">
          Complete my equipment report
        </a>
      </p>
      <p style="font-size:13px;color:#475569">Or copy this link:<br><a href="${link}">${link}</a></p>
      <p style="font-size:13px;color:#64748b">This link is unique to you and expires in 14 days.</p>
      <p>Thank you,<br>${companyName}</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function mapSessionRow(row = {}) {
  return {
    id: row.id,
    name: row.name,
    branchId: row.branch_id || null,
    branchCode: row.branch_code || null,
    branchName: row.branch_name || null,
    status: row.status || 'draft',
    totalRecipients: Number(row.total_recipients || 0),
    sentCount: Number(row.sent_count || 0),
    failedCount: Number(row.failed_count || 0),
    clickedCount: Number(row.clicked_count || 0),
    submittedCount: Number(row.submitted_count || 0),
    createdBy: row.created_by || null,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeliveryRow(row = {}) {
  let missingFields = [];
  try {
    missingFields = JSON.parse(row.missing_fields_json || '[]');
  } catch {
    missingFields = [];
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code || null,
    employeeName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
    branchCode: row.branch_code || null,
    branchName: row.branch_name || null,
    recipientEmail: row.recipient_email,
    missingFields,
    status: row.status || 'pending',
    sentAt: row.sent_at,
    clickedAt: row.clicked_at,
    submittedAt: row.submitted_at,
    errorMessage: row.error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function logReminderEvent({
  deliveryId,
  eventType,
  ipAddress = null,
  userAgent = null,
  metadata = null,
}, db = pool) {
  const id = `rev-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  await db.query(
    `INSERT INTO reminder_events (id, delivery_id, event_type, ip_address, user_agent, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      deliveryId,
      eventType,
      ipAddress,
      userAgent,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
  return id;
}

async function refreshSessionCounts(sessionId, db = pool) {
  const [[stats]] = await db.query(
    `SELECT
       COUNT(*) AS total_recipients,
       SUM(CASE WHEN status IN ('sent', 'clicked', 'submitted') THEN 1 ELSE 0 END) AS sent_count,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
       SUM(CASE WHEN status IN ('clicked', 'submitted') THEN 1 ELSE 0 END) AS clicked_count,
       SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_count
     FROM reminder_deliveries
     WHERE session_id = ?`,
    [sessionId],
  );

  await db.query(
    `UPDATE reminder_sessions
     SET total_recipients = ?, sent_count = ?, failed_count = ?, clicked_count = ?, submitted_count = ?
     WHERE id = ?`,
    [
      Number(stats?.total_recipients || 0),
      Number(stats?.sent_count || 0),
      Number(stats?.failed_count || 0),
      Number(stats?.clicked_count || 0),
      Number(stats?.submitted_count || 0),
      sessionId,
    ],
  );
}

export async function createAndSendReminderSession({
  name,
  branchId = '',
  createdBy = '',
  appUrl = '',
}, db = pool) {
  const candidates = await findIncompleteEmployees({ branchId }, db);
  if (!candidates.length) {
    const err = new Error('No incomplete employees found for this reminder.');
    err.status = 400;
    throw err;
  }

  const settings = await getAllSettings(db);
  const sessionId = `rms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const sessionName = String(name || '').trim() || `Employee reminder ${new Date().toLocaleString()}`;

  await db.query(
    `INSERT INTO reminder_sessions (id, name, branch_id, status, created_by)
     VALUES (?, ?, ?, 'sending', ?)`,
    [sessionId, sessionName, branchId || null, createdBy || null],
  );

  let sent = 0;
  let failed = 0;

  for (const { employee, missing } of candidates) {
    const deliveryId = `rmd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const token = generateReminderToken();
    const tokenHash = hashReminderToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const branchCode = employee.branchCode || '';
    const link = buildReminderLink({ branchCode, token, appUrl });

    await db.query(
      `INSERT INTO reminder_deliveries (
         id, session_id, employee_id, recipient_email, token_hash, token_expires_at,
         missing_fields_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        deliveryId,
        sessionId,
        employee.id,
        employee.email,
        tokenHash,
        expiresAt,
        JSON.stringify(missing),
      ],
    );

    try {
      const emailContent = buildReminderEmailContent({
        employee,
        branch: { name: employee.branchName, code: employee.branchCode },
        missing,
        link,
        companyName: settings.companyName,
      });

      await sendEmail({
        to: employee.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      await db.query(
        `UPDATE reminder_deliveries SET status = 'sent', sent_at = NOW(), error_message = NULL WHERE id = ?`,
        [deliveryId],
      );
      sent += 1;
    } catch (error) {
      await db.query(
        `UPDATE reminder_deliveries SET status = 'failed', error_message = ? WHERE id = ?`,
        [String(error?.message || 'Failed to send email').slice(0, 500), deliveryId],
      );
      failed += 1;
    }
  }

  await refreshSessionCounts(sessionId, db);
  await db.query(
    `UPDATE reminder_sessions SET status = ?, sent_at = NOW() WHERE id = ?`,
    [failed && !sent ? 'failed' : 'completed', sessionId],
  );

  return fetchReminderSession(sessionId, db);
}

export async function fetchReminderSession(sessionId, db = pool) {
  const [[row]] = await db.query(
    `SELECT s.*, b.code AS branch_code, b.name AS branch_name
     FROM reminder_sessions s
     LEFT JOIN branches b ON b.id = s.branch_id
     WHERE s.id = ?`,
    [sessionId],
  );
  if (!row) return null;
  return mapSessionRow(row);
}

export async function listReminderSessions({ limit = 25, offset = 0, search = '' } = {}, db = pool) {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(s.name LIKE ? OR b.name LIKE ? OR b.code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM reminder_sessions s
     LEFT JOIN branches b ON b.id = s.branch_id
     ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT s.*, b.code AS branch_code, b.name AS branch_name
     FROM reminder_sessions s
     LEFT JOIN branches b ON b.id = s.branch_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    data: rows.map(mapSessionRow),
    total: Number(countRow?.total || 0),
  };
}

export async function listReminderDeliveries(sessionId, { limit = 25, offset = 0, search = '' } = {}, db = pool) {
  const clauses = ['d.session_id = ?'];
  const params = [sessionId];

  if (search) {
    clauses.push(`(
      e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?
      OR e.employee_code LIKE ? OR d.recipient_email LIKE ?
    )`);
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM reminder_deliveries d
     INNER JOIN employees e ON e.id = d.employee_id
     ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT d.*, e.employee_code, e.first_name, e.last_name, b.code AS branch_code, b.name AS branch_name
     FROM reminder_deliveries d
     INNER JOIN employees e ON e.id = d.employee_id
     LEFT JOIN branches b ON b.id = e.branch_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    data: rows.map(mapDeliveryRow),
    total: Number(countRow?.total || 0),
  };
}

export async function resolveReminderToken(token, { ipAddress = null, userAgent = null } = {}, db = pool) {
  const tokenHash = hashReminderToken(token);
  const [[delivery]] = await db.query(
    `SELECT d.*, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title,
            e.branch_id, e.status AS employee_status, b.code AS branch_code, b.name AS branch_name,
            b.city AS branch_city, b.id AS branch_row_id
     FROM reminder_deliveries d
     INNER JOIN employees e ON e.id = d.employee_id
     INNER JOIN branches b ON b.id = e.branch_id
     WHERE d.token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );

  if (!delivery) {
    const err = new Error('This reminder link is invalid or has expired.');
    err.status = 404;
    throw err;
  }

  if (new Date(delivery.token_expires_at).getTime() < Date.now()) {
    await logReminderEvent({
      deliveryId: delivery.id,
      eventType: 'token_expired',
      ipAddress,
      userAgent,
    }, db);
    const err = new Error('This reminder link has expired. Please contact your branch manager for a new link.');
    err.status = 410;
    throw err;
  }

  if (delivery.status === 'failed') {
    const err = new Error('This reminder could not be delivered. Please use the standard intake form or contact support.');
    err.status = 400;
    throw err;
  }

  const shouldMarkClicked = delivery.status === 'sent';
  if (shouldMarkClicked) {
    await db.query(
      `UPDATE reminder_deliveries SET status = 'clicked', clicked_at = NOW() WHERE id = ?`,
      [delivery.id],
    );
    await refreshSessionCounts(delivery.session_id, db);
  }

  await logReminderEvent({
    deliveryId: delivery.id,
    eventType: shouldMarkClicked ? 'link_clicked' : 'link_reopened',
    ipAddress,
    userAgent,
  }, db);

  const employee = mapEmployeeRow(delivery);
  const branch = mapBranchRow({
    id: delivery.branch_row_id,
    code: delivery.branch_code,
    name: delivery.branch_name,
    city: delivery.branch_city,
    address: '',
    phone: '',
    manager_name: '',
    status: 'active',
    updated_at: null,
  });
  const devices = await fetchEmployeeIntakeDevices(employee.id);

  let missingFields = [];
  try {
    missingFields = JSON.parse(delivery.missing_fields_json || '[]');
  } catch {
    missingFields = [];
  }

  const freshMissing = [];
  if (!String(employee.phone || '').trim()) freshMissing.push('phone');
  if (!devices.length) freshMissing.push('assets');

  return {
    deliveryId: delivery.id,
    sessionId: delivery.session_id,
    token,
    branch,
    employee: {
      ...employee,
      emailLocal: emailToLocalPart(employee.email),
      phoneLocal: phoneToLocalPart(employee.phone),
    },
    devices,
    missingFields: freshMissing.length ? freshMissing : missingFields,
    profileComplete: Boolean(employee.firstName && employee.lastName && (employee.email || employee.phone)),
  };
}

export async function markReminderSubmitted(token, db = pool) {
  const tokenHash = hashReminderToken(token);
  const [[delivery]] = await db.query(
    `SELECT id, session_id, status FROM reminder_deliveries WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );
  if (!delivery) return false;
  if (delivery.status === 'submitted') return true;

  await db.query(
    `UPDATE reminder_deliveries SET status = 'submitted', submitted_at = NOW() WHERE id = ?`,
    [delivery.id],
  );
  await logReminderEvent({
    deliveryId: delivery.id,
    eventType: 'submitted',
  }, db);
  await refreshSessionCounts(delivery.session_id, db);
  return true;
}

export async function previewReminderCount({ branchId = '' } = {}, db = pool) {
  const candidates = await findIncompleteEmployees({ branchId }, db);
  return {
    count: candidates.length,
    sample: candidates.slice(0, 5).map(({ employee, missing }) => ({
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      branchName: employee.branchName,
      missing,
    })),
  };
}
