import crypto from 'crypto';
import pool from '../db.js';
import { mapBranchRow } from './branchHelpers.js';
import {
  INTAKE_EMPLOYEE_DEVICE_TYPES,
  findEmployeeByContact,
  normalizeIntakeEmail,
} from './intakeHelpers.js';
import { upsertHeartbeat } from './presenceHelpers.js';
import {
  PRODUCT_EVENT_TYPES,
  logProductEvent,
  logProductRegistration,
} from './productEventHelpers.js';

const DEFAULT_DEVICE_TYPE = 'Laptop';

function generateProductId() {
  return `prd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function generateMachineId() {
  return crypto.randomUUID();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function listSetupBranches() {
  const [rows] = await pool.query(
    `SELECT id, code, name, city, address, phone, manager_name, status, updated_at
     FROM branches
     WHERE status = 'active'
     ORDER BY name ASC
     LIMIT 100`,
  );
  return rows.map(mapBranchRow);
}

export async function lookupSetupEmployee({ branchId, email } = {}) {
  const resolvedBranchId = String(branchId || '').trim();
  const resolvedEmail = String(email || '').trim();

  if (!resolvedBranchId) {
    throw httpError(400, 'Branch is required.');
  }
  if (!resolvedEmail) {
    throw httpError(400, 'Employee email is required.');
  }

  const [[branch]] = await pool.query(
    `SELECT id, code, name FROM branches WHERE id = ? AND status = 'active' LIMIT 1`,
    [resolvedBranchId],
  );
  if (!branch) {
    throw httpError(404, 'Branch not found.');
  }

  const employee = await findEmployeeByContact(branch.id, { email: resolvedEmail });
  if (!employee) {
    throw httpError(
      404,
      `No active employee found for ${normalizeIntakeEmail(resolvedEmail)} at ${branch.name}.`,
    );
  }

  return { branch: mapBranchRow(branch), employee };
}

async function findProductBySerial(serialNumber) {
  const serial = String(serialNumber || '').trim();
  if (!serial) return null;
  const [[row]] = await pool.query(
    `SELECT id, sku, name, category, employee_id, branch_id, status
     FROM products
     WHERE sku = ? AND status != 'discontinued'
     LIMIT 1`,
    [serial],
  );
  return row || null;
}

function normalizeDeviceType(value) {
  const type = String(value || '').trim() || DEFAULT_DEVICE_TYPE;
  if (!INTAKE_EMPLOYEE_DEVICE_TYPES.includes(type)) {
    throw httpError(
      400,
      `Invalid deviceType. Use one of: ${INTAKE_EMPLOYEE_DEVICE_TYPES.join(', ')}.`,
    );
  }
  return type;
}

function mapProductSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    employeeId: row.employee_id || null,
    branchId: row.branch_id || null,
    status: row.status || 'in_stock',
  };
}

export async function enrollPresenceDevice(payload = {}) {
  const branchId = String(payload.branchId || payload.branch_id || '').trim();
  const email = String(payload.email || '').trim();
  const serialNumber = String(payload.serialNumber || payload.serial_number || '').trim();
  const hostname = String(payload.hostname || '').trim().slice(0, 255);
  const machineId = String(payload.machineId || payload.machine_id || '').trim() || generateMachineId();
  const osVersion = String(payload.osVersion || payload.os_version || '').trim().slice(0, 255);
  const loggedInUser = String(payload.loggedInUser || payload.logged_in_user || '').trim().slice(0, 120);
  const localIp = String(payload.localIp || payload.local_ip || '').trim().slice(0, 45);
  const agentVersion = String(payload.agentVersion || payload.agent_version || '').trim().slice(0, 40) || '1.0.0';
  const deviceType = normalizeDeviceType(payload.deviceType || payload.device_type);

  if (!serialNumber) {
    throw httpError(400, 'Serial number is required.');
  }

  const { branch, employee } = await lookupSetupEmployee({ branchId, email });

  let product = await findProductBySerial(serialNumber);
  let created = false;

  if (!product) {
    const productId = generateProductId();
    const name = hostname
      ? `${hostname} (${deviceType})`
      : `${deviceType} ${serialNumber}`;

    await pool.query(
      `INSERT INTO products (id, sku, name, category, brand_id, branch_id, quantity, reorder_level, unit_price, status, employee_id)
       VALUES (?, ?, ?, ?, NULL, NULL, 1, 0, NULL, 'in_stock', ?)`,
      [productId, serialNumber, name, deviceType, employee.id],
    );

    await logProductRegistration(pool, {
      productId,
      employeeId: employee.id,
      branchId: branch.id,
      actor: 'presence-enroll',
      eventType: PRODUCT_EVENT_TYPES.INTAKE,
      summary: `Enrolled via GFL Presence installer at ${branch.name}`,
    });

    product = await findProductBySerial(serialNumber);
    created = true;
  } else {
    const previousEmployeeId = product.employee_id || null;
    if (previousEmployeeId !== employee.id) {
      await pool.query(
        `UPDATE products SET employee_id = ? WHERE id = ?`,
        [employee.id, product.id],
      );

      await logProductEvent(pool, {
        productId: product.id,
        eventType: previousEmployeeId
          ? PRODUCT_EVENT_TYPES.TRANSFERRED
          : PRODUCT_EVENT_TYPES.ASSIGNED,
        summary: previousEmployeeId
          ? `Reassigned via GFL Presence installer to ${employee.fullName}`
          : `Assigned via GFL Presence installer to ${employee.fullName}`,
        fromEmployeeId: previousEmployeeId,
        toEmployeeId: employee.id,
        toBranchId: branch.id,
        actor: 'presence-enroll',
      });

      product = await findProductBySerial(serialNumber);
    }
  }

  await upsertHeartbeat({
    machineId,
    hostname,
    serialNumber,
    osVersion,
    loggedInUser,
    localIp,
    agentVersion,
  });

  // Employee devices keep branch on the employee record — stamp branch on presence for the dashboard.
  await pool.query(
    `UPDATE device_presence
     SET employee_id = ?, branch_id = ?
     WHERE machine_id = ?`,
    [employee.id, branch.id, machineId],
  );

  const [[presenceRow]] = await pool.query(
    `SELECT
       dp.id, dp.machine_id, dp.product_id, dp.hostname, dp.serial_number, dp.os_version,
       dp.logged_in_user, dp.local_ip, dp.agent_version, dp.last_heartbeat_at, dp.online_status,
       dp.employee_id, dp.branch_id, dp.created_at, dp.updated_at,
       p.sku AS product_sku, p.name AS product_name,
       e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.employee_code,
       b.name AS branch_name, b.code AS branch_code
     FROM device_presence dp
     LEFT JOIN products p ON p.id = dp.product_id
     LEFT JOIN employees e ON e.id = dp.employee_id
     LEFT JOIN branches b ON b.id = dp.branch_id
     WHERE dp.machine_id = ?
     LIMIT 1`,
    [machineId],
  );

  const employeeName = [presenceRow?.employee_first_name, presenceRow?.employee_last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    created,
    machineId,
    branch,
    employee,
    product: mapProductSummary(product),
    presence: {
      id: presenceRow?.id || null,
      machineId,
      productId: presenceRow?.product_id || null,
      hostname: presenceRow?.hostname || hostname,
      serialNumber: presenceRow?.serial_number || serialNumber,
      onlineStatus: presenceRow?.online_status || 'online',
      lastHeartbeatAt: presenceRow?.last_heartbeat_at
        ? new Date(presenceRow.last_heartbeat_at).toISOString()
        : null,
      employeeId: employee.id,
      branchId: branch.id,
      employeeName: employeeName || employee.fullName,
      employeeCode: presenceRow?.employee_code || employee.employeeCode,
      branchName: presenceRow?.branch_name || branch.name,
      branchCode: presenceRow?.branch_code || branch.code,
      productSku: presenceRow?.product_sku || product?.sku || serialNumber,
      productName: presenceRow?.product_name || product?.name || null,
    },
  };
}
