import crypto from 'crypto';
import pool from '../db.js';

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
