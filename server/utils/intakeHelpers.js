import crypto from 'crypto';
import pool from '../db.js';
import { mapBranchRow } from './branchHelpers.js';
import { mapEmployeeRow } from './employeeHelpers.js';
import {
  mapProductRow,
  PRODUCT_JOIN_SQL,
  PRODUCT_SELECT_FIELDS,
} from './inventoryHelpers.js';

export const INTAKE_EMPLOYEE_DEVICE_TYPES = [
  'Monitor',
  'Desktop',
  'Laptop',
  'All-in-One',
  'Tablet',
  'Phone',
  'TV',
];
export const INTAKE_BRANCH_DEVICE_TYPES = ['Printer'];

export function normalizeIntakeEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  return `${raw}@goodfellow.co.zm`;
}

export function normalizeIntakePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  let local = digits;
  if (local.startsWith('260')) local = local.slice(3);
  local = local.replace(/^0+/, '');
  return local ? `+260${local}` : '';
}

export async function findEmployeeByContact(branchId, { email, phone } = {}) {
  const normalizedEmail = normalizeIntakeEmail(email);
  const normalizedPhone = normalizeIntakePhone(phone);
  if (!normalizedEmail && !normalizedPhone) return null;

  const [rows] = await pool.query(
    `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
            b.code AS branch_code, b.name AS branch_name
     FROM employees e
     LEFT JOIN branches b ON b.id = e.branch_id
     WHERE e.branch_id = ? AND e.status = 'active'`,
    [branchId],
  );

  const emailMatch = normalizedEmail
    ? rows.find((row) => normalizeIntakeEmail(row.email) === normalizedEmail)
    : null;
  const phoneMatch = normalizedPhone
    ? rows.find((row) => normalizeIntakePhone(row.phone) === normalizedPhone)
    : null;

  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    const err = new Error(
      'The email and phone number match different employee records. Please contact your branch manager.',
    );
    err.status = 409;
    throw err;
  }

  const match = emailMatch || phoneMatch || null;
  return match ? mapEmployeeRow(match) : null;
}

export async function fetchEmployeeIntakeDevices(employeeId) {
  if (!employeeId) return [];

  const placeholders = INTAKE_EMPLOYEE_DEVICE_TYPES.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT ${PRODUCT_SELECT_FIELDS}
     FROM products p ${PRODUCT_JOIN_SQL}
     WHERE p.employee_id = ? AND p.status != 'discontinued'
       AND p.category IN (${placeholders})
     ORDER BY p.category ASC, p.name ASC`,
    [employeeId, ...INTAKE_EMPLOYEE_DEVICE_TYPES],
  );

  return rows.map(mapProductRow);
}

export async function resolveProductSn(sku, { productId = null } = {}) {
  const trimmed = String(sku || '').trim();
  if (trimmed) return trimmed;

  if (productId) {
    const [[existing]] = await pool.query(
      'SELECT sku FROM products WHERE id = ? LIMIT 1',
      [productId],
    );
    if (existing?.sku) return existing.sku;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `GFL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const [[dup]] = await pool.query(
      'SELECT id FROM products WHERE sku = ? LIMIT 1',
      [code],
    );
    if (!dup) return code;
  }

  return `GFL-${Date.now().toString(36).toUpperCase()}`;
}

export async function resolveEmployeeCode(employeeCode, { employeeId = null } = {}) {
  const trimmed = String(employeeCode || '').trim();
  if (trimmed) return trimmed;

  if (employeeId) {
    const [[existing]] = await pool.query(
      'SELECT employee_code FROM employees WHERE id = ? LIMIT 1',
      [employeeId],
    );
    if (existing?.employee_code) return existing.employee_code;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `EMP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const [[dup]] = await pool.query(
      'SELECT id FROM employees WHERE employee_code = ? LIMIT 1',
      [code],
    );
    if (!dup) return code;
  }

  return `EMP-${Date.now().toString(36).toUpperCase()}`;
}

export async function resolveBrandId(brandId) {
  const resolved = brandId ? String(brandId).trim() : null;
  if (!resolved) return null;
  const [[brand]] = await pool.query('SELECT id FROM brands WHERE id = ? LIMIT 1', [resolved]);
  if (!brand) {
    const err = new Error('Selected brand was not found.');
    err.status = 400;
    throw err;
  }
  return brand.id;
}

export function buildDeviceName({ type, brandName, model = '' }) {
  const parts = [brandName, model, type].map((s) => String(s || '').trim()).filter(Boolean);
  return parts.join(' ') || type || 'Device';
}

function slugifyBranchCode(name) {
  const slug = String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return slug || 'BRANCH';
}

async function generateUniqueBranchCode(name) {
  const base = slugifyBranchCode(name);
  let code = `GFL-${base}`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = attempt === 0 ? code : `${code}-${attempt + 1}`;
    const [[dup]] = await pool.query('SELECT id FROM branches WHERE code = ? LIMIT 1', [candidate]);
    if (!dup) return candidate;
  }

  return `GFL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function resolveBranchByName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    const err = new Error('Branch name is required.');
    err.status = 400;
    throw err;
  }

  const [[existing]] = await pool.query(
    `SELECT id, code, name, city, address, phone, manager_name, status, updated_at
     FROM branches
     WHERE status = 'active' AND LOWER(name) = LOWER(?)
     LIMIT 1`,
    [trimmed],
  );
  if (existing) return mapBranchRow(existing);

  const code = await generateUniqueBranchCode(trimmed);
  const id = `brn-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  await pool.query(
    `INSERT INTO branches (id, code, name, city, address, phone, manager_name, status)
     VALUES (?, ?, ?, '', '', '', '', 'active')`,
    [id, code, trimmed],
  );

  const [[row]] = await pool.query(
    'SELECT id, code, name, city, address, phone, manager_name, status, updated_at FROM branches WHERE id = ?',
    [id],
  );
  return mapBranchRow(row);
}
