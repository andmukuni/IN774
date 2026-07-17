import express from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { hashPassword } from '../auth.js';
import { loadUserAdminPermissions } from '../rbacService.js';
import { parseTableQuery, buildOrderClause, buildPaginatedResponse } from '../utils/tableQuery.js';
import { computeProductStatus, mapProductRow, PRODUCT_JOIN_SQL, PRODUCT_SELECT_FIELDS } from '../utils/inventoryHelpers.js';
import { mapBranchRow } from '../utils/branchHelpers.js';
import { mapEmployeeRow } from '../utils/employeeHelpers.js';
import {
  buildEmployeesCsv,
  buildEmployeesExportFilename,
  buildEmployeesPdfBuffer,
} from '../utils/employeeExportHelpers.js';
import { mapBrandRow } from '../utils/brandHelpers.js';
import { mapProductTypeRow } from '../utils/productTypeHelpers.js';
import {
  backfillProductEvents,
  buildProductArchitecture,
  fetchProductEvents,
  logProductAssignmentChange,
  logProductRegistration,
} from '../utils/productEventHelpers.js';
import {
  fetchSystemOverview,
  getPublicSettings,
  updateSettings,
} from '../utils/systemSettingsHelpers.js';
import { createReminderRouter } from './reminders.js';

const BRAND_SORT_COLUMN_MAP = {
  code: 'code',
  name: 'name',
  status: 'status',
  updated_at: 'updated_at',
};

const PRODUCT_TYPE_SORT_COLUMN_MAP = {
  code: 'code',
  name: 'name',
  status: 'status',
  updated_at: 'updated_at',
};

const SORT_COLUMN_MAP = {
  sku: 'p.sku',
  name: 'p.name',
  category: 'p.category',
  quantity: 'p.quantity',
  status: 'p.status',
  updated_at: 'p.updated_at',
  employee_name: 'e.last_name',
  branch_name: 'b.name',
};

const BRANCH_SORT_COLUMN_MAP = {
  code: 'code',
  city: 'city',
  address: 'address',
  phone: 'phone',
  assets_count: 'assets_count',
  status: 'status',
  updated_at: 'updated_at',
};

const EMPLOYEE_SORT_COLUMN_MAP = {
  employee_code: 'e.employee_code',
  full_name: 'e.last_name',
  job_title: 'e.job_title',
  branch_name: 'b.name',
  email: 'e.email',
  assets_count: 'assets_count',
  status: 'e.status',
  updated_at: 'e.updated_at',
};

function parseEmployeeIdList(value) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

function parseEmployeeFilters(query = {}) {
  return {
    code: String(query.code || '').trim(),
    name: String(query.name || '').trim(),
    role: String(query.role || '').trim(),
    branchId: String(query.branchId || query.branch_id || '').trim(),
    status: String(query.status || '').trim(),
    search: String(query.search || query.q || '').trim(),
    ids: parseEmployeeIdList(query.ids),
  };
}

function buildEmployeeWhere(filters = {}) {
  const {
    code = '',
    name = '',
    role = '',
    branchId = '',
    status = '',
    search = '',
    ids = [],
  } = filters;

  const clauses = [];
  const params = [];

  if (ids.length) {
    clauses.push(`e.id IN (${ids.map(() => '?').join(', ')})`);
    params.push(...ids);
  }

  if (code) {
    clauses.push('e.employee_code LIKE ?');
    params.push(`%${code}%`);
  }

  if (name) {
    clauses.push(`(
      e.first_name LIKE ?
      OR e.last_name LIKE ?
      OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
    )`);
    const term = `%${name}%`;
    params.push(term, term, term);
  }

  if (role) {
    clauses.push('e.job_title LIKE ?');
    params.push(`%${role}%`);
  }

  if (branchId) {
    clauses.push('e.branch_id = ?');
    params.push(branchId);
  }

  if (status) {
    clauses.push('e.status = ?');
    params.push(status);
  }

  if (search) {
    clauses.push(`(
      e.employee_code LIKE ?
      OR e.first_name LIKE ?
      OR e.last_name LIKE ?
      OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
      OR e.email LIKE ?
      OR e.phone LIKE ?
      OR e.job_title LIKE ?
      OR b.name LIKE ?
      OR b.code LIKE ?
    )`);
    const term = `%${search}%`;
    params.push(term, term, term, term, term, term, term, term, term);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function buildEmployeeExportSubtitle(filters = {}, count = 0) {
  const parts = [];
  if (filters.ids?.length) parts.push(`${filters.ids.length} selected`);
  if (filters.code) parts.push(`Code: ${filters.code}`);
  if (filters.name) parts.push(`Name: ${filters.name}`);
  if (filters.role) parts.push(`Role: ${filters.role}`);
  if (filters.branchId) parts.push(`Branch: ${filters.branchId}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.search) parts.push(`Search: ${filters.search}`);
  parts.push(`${count} record(s)`);
  return parts.join(' · ');
}

function buildBranchWhere(search, statusFilter) {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(code LIKE ? OR name LIKE ? OR city LIKE ? OR manager_name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (statusFilter) {
    clauses.push('status = ?');
    params.push(statusFilter);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function buildProductWhere(search, statusFilter, employeeId = '', branchId = '', category = '', brandId = '') {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(p.sku LIKE ? OR p.name LIKE ? OR p.category LIKE ? OR br.name LIKE ? OR br.code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR b.name LIKE ? OR b.code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term, term, term, term, term);
  }

  if (category) {
    clauses.push('p.category = ?');
    params.push(category);
  }

  if (brandId) {
    clauses.push('p.brand_id = ?');
    params.push(brandId);
  }

  if (employeeId) {
    clauses.push('p.employee_id = ?');
    params.push(employeeId);
  }

  if (branchId) {
    clauses.push('(p.branch_id = ? OR e.branch_id = ?)');
    params.push(branchId, branchId);
  }

  if (statusFilter) {
    if (statusFilter === 'low_stock') {
      clauses.push('p.quantity > 0 AND p.quantity <= p.reorder_level AND p.status != ?');
      params.push('discontinued');
    } else if (statusFilter === 'out_of_stock') {
      clauses.push('(p.quantity = 0 AND p.status != ?)');
      params.push('discontinued');
    } else {
      clauses.push('p.status = ?');
      params.push(statusFilter);
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function buildBrandWhere(search, statusFilter) {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(code LIKE ? OR name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (statusFilter) {
    clauses.push('status = ?');
    params.push(statusFilter);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function buildProductTypeWhere(search, statusFilter) {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(code LIKE ? OR name LIKE ? OR description LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (statusFilter) {
    clauses.push('status = ?');
    params.push(statusFilter);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function parseOptionalUnitPrice(value) {
  if (value === '' || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

async function fetchProductResponse(id, { includeContext = false } = {}) {
  const [[row]] = await pool.query(
    `SELECT ${PRODUCT_SELECT_FIELDS}
     FROM products p ${PRODUCT_JOIN_SQL}
     WHERE p.id = ?`,
    [id],
  );
  if (!row) return null;

  const product = mapProductRow(row);
  if (!includeContext) return product;

  const [[eventCount]] = await pool.query(
    'SELECT COUNT(*) AS total FROM product_events WHERE product_id = ?',
    [id],
  );
  if (Number(eventCount?.total || 0) === 0) {
    await backfillProductEvents(pool);
  }

  const history = await fetchProductEvents(pool, id);
  return {
    ...product,
    architecture: buildProductArchitecture(product),
    history,
  };
}

async function resolveEmployeeId(employeeId) {
  const resolved = employeeId ? String(employeeId).trim() : null;
  if (!resolved) return null;
  const [[employee]] = await pool.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [resolved]);
  if (!employee) {
    const err = new Error('Selected employee was not found.');
    err.status = 400;
    throw err;
  }
  return employee.id;
}

async function resolveBrandId(brandId) {
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

async function resolveBranchIdForProduct(branchId) {
  const resolved = branchId ? String(branchId).trim() : null;
  if (!resolved) return null;
  const [[branch]] = await pool.query('SELECT id FROM branches WHERE id = ? LIMIT 1', [resolved]);
  if (!branch) {
    const err = new Error('Selected branch was not found.');
    err.status = 400;
    throw err;
  }
  return branch.id;
}

async function resolveEmployeeCode(employeeCode, { employeeId = null } = {}) {
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

async function fetchInventoryStats() {
  const [[totals]] = await pool.query(`
    SELECT
      COUNT(*) AS totalProducts,
      COALESCE(SUM(quantity), 0) AS totalUnits,
      COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS inventoryValue,
      COUNT(DISTINCT category) AS categoryCount
    FROM products
    WHERE status != 'discontinued'
  `);

  const [[stockCounts]] = await pool.query(`
    SELECT
      SUM(CASE WHEN quantity = 0 AND status != 'discontinued' THEN 1 ELSE 0 END) AS outOfStockCount,
      SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level AND status != 'discontinued' THEN 1 ELSE 0 END) AS lowStockCount
    FROM products
  `);

  const [statusRows] = await pool.query(`
    SELECT
      CASE
        WHEN status = 'discontinued' THEN 'discontinued'
        WHEN quantity = 0 THEN 'out_of_stock'
        WHEN quantity <= reorder_level THEN 'low_stock'
        ELSE 'in_stock'
      END AS status_key,
      COUNT(*) AS count
    FROM products
    GROUP BY status_key
  `);

  const byStatus = {};
  for (const row of statusRows) {
    byStatus[row.status_key] = Number(row.count || 0);
  }

  return {
    totalProducts: Number(totals?.totalProducts || 0),
    totalUnits: Number(totals?.totalUnits || 0),
    inventoryValue: Number(totals?.inventoryValue || 0),
    categoryCount: Number(totals?.categoryCount || 0),
    lowStockCount: Number(stockCounts?.lowStockCount || 0),
    outOfStockCount: Number(stockCounts?.outOfStockCount || 0),
    byStatus,
  };
}

export function createAdminRouter() {
  const router = express.Router();

  router.get('/dashboard/stats', async (_req, res) => {
    try {
      const data = await fetchInventoryStats();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/settings', async (req, res) => {
    try {
      const appUrl = String(req.headers.origin || process.env.APP_URL || '').trim().replace(/\/$/, '');
      const data = await fetchSystemOverview({ appUrl });
      res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/settings', async (req, res) => {
    try {
      const body = req.body || {};
      const patch = {};
      if ('companyName' in body) patch.companyName = body.companyName;
      if ('supportEmail' in body) patch.supportEmail = body.supportEmail;
      if ('supportPhone' in body) patch.supportPhone = body.supportPhone;
      if ('intakeEnabled' in body) patch.intakeEnabled = body.intakeEnabled;
      if ('intakeIntroText' in body) patch.intakeIntroText = body.intakeIntroText;
      if ('smtpEnabled' in body) patch.smtpEnabled = body.smtpEnabled;
      if ('smtpHost' in body) patch.smtpHost = body.smtpHost;
      if ('smtpPort' in body) patch.smtpPort = body.smtpPort;
      if ('smtpSecure' in body) patch.smtpSecure = body.smtpSecure;
      if ('smtpUser' in body) patch.smtpUser = body.smtpUser;
      if ('smtpPassword' in body) patch.smtpPassword = body.smtpPassword;
      if ('smtpFromEmail' in body) patch.smtpFromEmail = body.smtpFromEmail;
      if ('smtpFromName' in body) patch.smtpFromName = body.smtpFromName;

      const settings = await updateSettings(patch);
      const appUrl = String(req.headers.origin || process.env.APP_URL || '').trim().replace(/\/$/, '');
      const overview = await fetchSystemOverview({ appUrl });
      res.json({ ok: true, data: { ...overview, settings } });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/products/counts', async (_req, res) => {
    try {
      const stats = await fetchInventoryStats();
      res.json({
        ok: true,
        data: {
          lowStock: stats.lowStockCount,
          outOfStock: stats.outOfStockCount,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/items', async (req, res) => {
    try {
      const q = parseTableQuery(req.query);
      const statusFilter = String(req.query.status || '').trim();
      const employeeId = String(req.query.employeeId || '').trim();
      const branchId = String(req.query.branchId || '').trim();
      const category = String(req.query.category || '').trim();
      const brandId = String(req.query.brandId || '').trim();
      const { where, params } = buildProductWhere(q.search, statusFilter, employeeId, branchId, category, brandId);

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM products p ${PRODUCT_JOIN_SQL} ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const orderClause = buildOrderClause(q.sortColumn, q.sortDir, SORT_COLUMN_MAP, 'updated_at');

      const [rows] = await pool.query(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p ${PRODUCT_JOIN_SQL} ${where} ${orderClause} LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      const data = rows.map(mapProductRow);

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      return res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/items/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Product id is required.' });
      }

      const data = await fetchProductResponse(id, { includeContext: true });
      if (!data) {
        return res.status(404).json({ ok: false, message: 'Product not found.' });
      }

      res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/items', async (req, res) => {
    try {
      const {
        sku,
        name,
        category = 'General',
        quantity = 0,
        reorderLevel = 0,
        unitPrice,
        status: bodyStatus,
        employeeId,
        brandId,
        branchId,
      } = req.body || {};

      if (!name) {
        return res.status(400).json({ ok: false, message: 'Product name is required.' });
      }
      if (!String(sku || '').trim()) {
        return res.status(400).json({ ok: false, message: 'Product S/N is required.' });
      }

      const resolvedUnitPrice = parseOptionalUnitPrice(unitPrice);

      let resolvedEmployeeId = null;
      let resolvedBrandId = null;
      let resolvedBranchId = null;
      try {
        resolvedEmployeeId = await resolveEmployeeId(employeeId);
        resolvedBrandId = await resolveBrandId(brandId);
        resolvedBranchId = await resolveBranchIdForProduct(branchId);
      } catch (err) {
        return res.status(err.status || 400).json({ ok: false, message: err.message });
      }

      const id = `prd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const resolvedSku = String(sku).trim();
      const status = bodyStatus || computeProductStatus(quantity, reorderLevel);

      await pool.query(
        `INSERT INTO products (id, sku, name, category, brand_id, branch_id, quantity, reorder_level, unit_price, status, employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, resolvedSku, String(name).trim(), String(category).trim(), resolvedBrandId, resolvedBranchId, Number(quantity), Number(reorderLevel), resolvedUnitPrice, status, resolvedEmployeeId],
      );

      await logProductRegistration(pool, {
        productId: id,
        branchId: resolvedBranchId,
        employeeId: resolvedEmployeeId,
        actor: 'admin',
      });

      const data = await fetchProductResponse(id, { includeContext: true });
      res.status(201).json({ ok: true, data });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A product with this S/N already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/items/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Product id is required.' });
      }

      const [[existing]] = await pool.query(
        'SELECT id, status, employee_id, branch_id FROM products WHERE id = ?',
        [id],
      );
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Product not found.' });
      }

      const {
        sku,
        name,
        category = 'General',
        quantity = 0,
        reorderLevel = 0,
        unitPrice,
        status: bodyStatus,
        employeeId,
        brandId,
        branchId,
      } = req.body || {};

      if (!name) {
        return res.status(400).json({ ok: false, message: 'Product name is required.' });
      }
      if (!String(sku || '').trim()) {
        return res.status(400).json({ ok: false, message: 'Product S/N is required.' });
      }

      const resolvedUnitPrice = parseOptionalUnitPrice(unitPrice);

      let resolvedEmployeeId = null;
      let resolvedBrandId = null;
      let resolvedBranchId = null;
      try {
        resolvedEmployeeId = await resolveEmployeeId(employeeId);
        resolvedBrandId = await resolveBrandId(brandId);
        resolvedBranchId = await resolveBranchIdForProduct(branchId);
      } catch (err) {
        return res.status(err.status || 400).json({ ok: false, message: err.message });
      }

      const resolvedSku = String(sku).trim();
      const status = bodyStatus === 'discontinued'
        ? 'discontinued'
        : computeProductStatus(quantity, reorderLevel, existing.status);

      await pool.query(
        `UPDATE products
         SET sku = ?, name = ?, category = ?, brand_id = ?, branch_id = ?, quantity = ?, reorder_level = ?, unit_price = ?, status = ?, employee_id = ?
         WHERE id = ?`,
        [
          resolvedSku,
          String(name).trim(),
          String(category).trim(),
          resolvedBrandId,
          resolvedBranchId,
          Number(quantity),
          Number(reorderLevel),
          resolvedUnitPrice,
          status,
          resolvedEmployeeId,
          id,
        ],
      );

      await logProductAssignmentChange(pool, {
        productId: id,
        previous: {
          employeeId: existing.employee_id || null,
          branchId: existing.branch_id || null,
        },
        next: {
          employeeId: resolvedEmployeeId,
          branchId: resolvedBranchId,
        },
        actor: 'admin',
      });

      const data = await fetchProductResponse(id, { includeContext: true });
      res.json({ ok: true, data });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A product with this S/N already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/items/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Product id is required.' });
      }

      const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
      if (!result.affectedRows) {
        return res.status(404).json({ ok: false, message: 'Product not found.' });
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/branches', async (req, res) => {
    try {
      const q = parseTableQuery(req.query);
      const statusFilter = String(req.query.status || '').trim();
      const { where, params } = buildBranchWhere(q.search, statusFilter);

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM branches ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const orderClause = buildOrderClause(q.sortColumn, q.sortDir, BRANCH_SORT_COLUMN_MAP, 'updated_at');

      const [rows] = await pool.query(
        `SELECT
           id, code, name, city, address, phone, manager_name, status, updated_at,
           (
             SELECT COUNT(*)
             FROM products p
             LEFT JOIN employees e ON e.id = p.employee_id
             WHERE p.branch_id = branches.id OR e.branch_id = branches.id
           ) AS assets_count
         FROM branches ${where} ${orderClause} LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      const data = rows.map(mapBranchRow);

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      return res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/branches/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Branch id is required.' });
      }

      const [[row]] = await pool.query(
        'SELECT id, code, name, city, address, phone, manager_name, status, updated_at FROM branches WHERE id = ?',
        [id],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      res.json({ ok: true, data: mapBranchRow(row) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/branches', async (req, res) => {
    try {
      const {
        code,
        name,
        city = '',
        address = '',
        phone = '',
        managerName = '',
        status = 'active',
      } = req.body || {};

      if (!code || !name) {
        return res.status(400).json({ ok: false, message: 'Branch code and name are required.' });
      }

      const id = `brn-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await pool.query(
        `INSERT INTO branches (id, code, name, city, address, phone, manager_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          String(code).trim(),
          String(name).trim(),
          String(city).trim(),
          String(address).trim(),
          String(phone).trim(),
          String(managerName).trim(),
          String(status).trim() || 'active',
        ],
      );

      const [[row]] = await pool.query('SELECT * FROM branches WHERE id = ?', [id]);
      res.status(201).json({ ok: true, data: mapBranchRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A branch with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/branches/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Branch id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id FROM branches WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      const {
        code,
        name,
        city = '',
        address = '',
        phone = '',
        managerName = '',
        status = 'active',
      } = req.body || {};

      if (!code || !name) {
        return res.status(400).json({ ok: false, message: 'Branch code and name are required.' });
      }

      await pool.query(
        `UPDATE branches
         SET code = ?, name = ?, city = ?, address = ?, phone = ?, manager_name = ?, status = ?
         WHERE id = ?`,
        [
          String(code).trim(),
          String(name).trim(),
          String(city).trim(),
          String(address).trim(),
          String(phone).trim(),
          String(managerName).trim(),
          String(status).trim() || 'active',
          id,
        ],
      );

      const [[row]] = await pool.query(
        'SELECT id, code, name, city, address, phone, manager_name, status, updated_at FROM branches WHERE id = ?',
        [id],
      );
      res.json({ ok: true, data: mapBranchRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A branch with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/branches/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Branch id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id FROM branches WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      const [[empCount]] = await pool.query(
        'SELECT COUNT(*) AS count FROM employees WHERE branch_id = ?',
        [id],
      );
      if (Number(empCount?.count || 0) > 0) {
        return res.status(409).json({
          ok: false,
          message: 'Cannot delete a branch that still has employees assigned.',
        });
      }

      await pool.query('DELETE FROM branches WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/brands', async (req, res) => {
    try {
      const q = parseTableQuery(req.query);
      const statusFilter = String(req.query.status || '').trim();
      const { where, params } = buildBrandWhere(q.search, statusFilter);

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM brands ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const orderClause = buildOrderClause(q.sortColumn, q.sortDir, BRAND_SORT_COLUMN_MAP, 'name');

      const [rows] = await pool.query(
        `SELECT id, code, name, status, updated_at
         FROM brands ${where} ${orderClause} LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      const data = rows.map(mapBrandRow);

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      return res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/brands/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Brand id is required.' });
      }

      const [[row]] = await pool.query(
        'SELECT id, code, name, status, updated_at FROM brands WHERE id = ?',
        [id],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'Brand not found.' });
      }

      return res.json({ ok: true, data: mapBrandRow(row) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/brands', async (req, res) => {
    try {
      const {
        code,
        name,
        status = 'active',
      } = req.body || {};

      if (!code || !name) {
        return res.status(400).json({ ok: false, message: 'Brand code and name are required.' });
      }

      const id = `brd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await pool.query(
        `INSERT INTO brands (id, code, name, status)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          String(code).trim(),
          String(name).trim(),
          String(status).trim() || 'active',
        ],
      );

      const [[row]] = await pool.query(
        'SELECT id, code, name, status, updated_at FROM brands WHERE id = ?',
        [id],
      );
      res.status(201).json({ ok: true, data: mapBrandRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A brand with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/brands/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Brand id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id FROM brands WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Brand not found.' });
      }

      const {
        code,
        name,
        status = 'active',
      } = req.body || {};

      if (!code || !name) {
        return res.status(400).json({ ok: false, message: 'Brand code and name are required.' });
      }

      await pool.query(
        `UPDATE brands SET code = ?, name = ?, status = ? WHERE id = ?`,
        [
          String(code).trim(),
          String(name).trim(),
          String(status).trim() || 'active',
          id,
        ],
      );

      const [[row]] = await pool.query(
        'SELECT id, code, name, status, updated_at FROM brands WHERE id = ?',
        [id],
      );
      res.json({ ok: true, data: mapBrandRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A brand with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/brands/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Brand id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id FROM brands WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Brand not found.' });
      }

      const [[productCount]] = await pool.query(
        'SELECT COUNT(*) AS total FROM products WHERE brand_id = ?',
        [id],
      );
      if (Number(productCount?.total || 0) > 0) {
        return res.status(409).json({
          ok: false,
          message: 'Cannot delete a brand that is assigned to inventory items.',
        });
      }

      await pool.query('DELETE FROM brands WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/product-types', async (req, res) => {
    try {
      const q = parseTableQuery(req.query);
      const statusFilter = String(req.query.status || '').trim();
      const { where, params } = buildProductTypeWhere(q.search, statusFilter);

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM product_types ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const orderClause = buildOrderClause(q.sortColumn, q.sortDir, PRODUCT_TYPE_SORT_COLUMN_MAP, 'name');

      const [rows] = await pool.query(
        `SELECT id, code, name, description, status, updated_at
         FROM product_types ${where} ${orderClause} LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      const data = rows.map(mapProductTypeRow);

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      return res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/product-types/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Product type id is required.' });
      }

      const [[row]] = await pool.query(
        'SELECT id, code, name, description, status, updated_at FROM product_types WHERE id = ?',
        [id],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'Product type not found.' });
      }

      return res.json({ ok: true, data: mapProductTypeRow(row) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/product-types', async (req, res) => {
    try {
      const {
        code,
        name,
        description = '',
        status = 'active',
      } = req.body || {};

      if (!code || !name) {
        return res.status(400).json({ ok: false, message: 'Product type code and name are required.' });
      }

      const id = `typ-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await pool.query(
        `INSERT INTO product_types (id, code, name, description, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          String(code).trim(),
          String(name).trim(),
          String(description).trim(),
          String(status).trim() || 'active',
        ],
      );

      const [[row]] = await pool.query(
        'SELECT id, code, name, description, status, updated_at FROM product_types WHERE id = ?',
        [id],
      );
      res.status(201).json({ ok: true, data: mapProductTypeRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A product type with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/product-types/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Product type id is required.' });
      }

      const [[existing]] = await pool.query(
        'SELECT id, name FROM product_types WHERE id = ?',
        [id],
      );
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Product type not found.' });
      }

      const {
        code,
        name,
        description = '',
        status = 'active',
      } = req.body || {};

      if (!code || !name) {
        return res.status(400).json({ ok: false, message: 'Product type code and name are required.' });
      }

      const trimmedName = String(name).trim();
      const oldName = String(existing.name || '').trim();

      await pool.query(
        `UPDATE product_types
         SET code = ?, name = ?, description = ?, status = ?
         WHERE id = ?`,
        [
          String(code).trim(),
          trimmedName,
          String(description).trim(),
          String(status).trim() || 'active',
          id,
        ],
      );

      if (oldName && trimmedName !== oldName) {
        await pool.query(
          'UPDATE products SET category = ? WHERE category = ?',
          [trimmedName, oldName],
        );
      }

      const [[row]] = await pool.query(
        'SELECT id, code, name, description, status, updated_at FROM product_types WHERE id = ?',
        [id],
      );
      res.json({ ok: true, data: mapProductTypeRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A product type with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/product-types/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Product type id is required.' });
      }

      const [[existing]] = await pool.query(
        'SELECT id, name FROM product_types WHERE id = ?',
        [id],
      );
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Product type not found.' });
      }

      const [[productCount]] = await pool.query(
        'SELECT COUNT(*) AS total FROM products WHERE category = ?',
        [String(existing.name || '').trim()],
      );
      if (Number(productCount?.total || 0) > 0) {
        return res.status(409).json({
          ok: false,
          message: 'Cannot delete a product type that is assigned to inventory items.',
        });
      }

      await pool.query('DELETE FROM product_types WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/employees/export', async (req, res) => {
    try {
      const format = String(req.query.format || 'csv').trim().toLowerCase();
      const filters = parseEmployeeFilters(req.query);
      const { where, params } = buildEmployeeWhere(filters);

      const [rows] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name,
                (
                  SELECT COUNT(*)
                  FROM products p
                  WHERE p.employee_id = e.id
                ) AS assets_count
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         ${where}
         ORDER BY e.last_name ASC, e.first_name ASC, e.employee_code ASC
         LIMIT 10000`,
        params,
      );

      const data = rows.map(mapEmployeeRow);
      const title = filters.status === 'inactive'
        ? 'Inactive Employees'
        : filters.status === 'active'
          ? 'Active Employees'
          : 'Employees';
      const subtitle = buildEmployeeExportSubtitle(filters, data.length);
      const filename = buildEmployeesExportFilename(format === 'pdf' ? 'pdf' : 'csv', { status: filters.status });

      if (format === 'pdf') {
        const pdfBuffer = await buildEmployeesPdfBuffer(data, { title, subtitle });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(pdfBuffer);
      }

      if (format !== 'csv') {
        return res.status(400).json({ ok: false, message: 'Supported export formats are csv and pdf.' });
      }

      const csv = buildEmployeesCsv(data, { title });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(`\uFEFF${csv}`);
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/employees', async (req, res) => {
    try {
      const q = parseTableQuery(req.query);
      const filters = parseEmployeeFilters(req.query);
      if (!filters.search && q.search) filters.search = q.search;
      const { where, params } = buildEmployeeWhere(filters);

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM employees e LEFT JOIN branches b ON b.id = e.branch_id ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const orderClause = buildOrderClause(q.sortColumn, q.sortDir, EMPLOYEE_SORT_COLUMN_MAP, 'updated_at');

      const [rows] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name,
                (
                  SELECT COUNT(*)
                  FROM products p
                  WHERE p.employee_id = e.id
                ) AS assets_count
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         ${where} ${orderClause} LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      const data = rows.map(mapEmployeeRow);

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      return res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/employees/bulk-delete', async (req, res) => {
    try {
      const ids = parseEmployeeIdList(req.body?.ids);
      if (!ids.length) {
        return res.status(400).json({ ok: false, message: 'Select at least one employee to delete.' });
      }

      const placeholders = ids.map(() => '?').join(', ');
      const [existingRows] = await pool.query(
        `SELECT id FROM employees WHERE id IN (${placeholders})`,
        ids,
      );
      const existingIds = existingRows.map((row) => row.id);
      if (!existingIds.length) {
        return res.status(404).json({ ok: false, message: 'No matching employees were found.' });
      }

      const updatePlaceholders = existingIds.map(() => '?').join(', ');
      await pool.query(`UPDATE products SET employee_id = NULL WHERE employee_id IN (${updatePlaceholders})`, existingIds);
      await pool.query(`DELETE FROM employees WHERE id IN (${updatePlaceholders})`, existingIds);

      res.json({ ok: true, deleted: existingIds.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/employees/bulk-status', async (req, res) => {
    try {
      const ids = parseEmployeeIdList(req.body?.ids);
      const status = String(req.body?.status || '').trim().toLowerCase();

      if (!ids.length) {
        return res.status(400).json({ ok: false, message: 'Select at least one employee to update.' });
      }
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ ok: false, message: 'Status must be active or inactive.' });
      }

      const placeholders = ids.map(() => '?').join(', ');
      const [result] = await pool.query(
        `UPDATE employees SET status = ? WHERE id IN (${placeholders})`,
        [status, ...ids],
      );

      res.json({ ok: true, updated: Number(result?.affectedRows || 0), status });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/employees/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Employee id is required.' });
      }

      const [[row]] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE e.id = ?`,
        [id],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'Employee not found.' });
      }

      const employee = mapEmployeeRow(row);

      let branch = null;
      if (row.branch_id) {
        const [[branchRow]] = await pool.query(
          'SELECT id, code, name, city, address, phone, manager_name, status, updated_at FROM branches WHERE id = ?',
          [row.branch_id],
        );
        branch = branchRow ? mapBranchRow(branchRow) : null;
      }

      const [[itemStats]] = await pool.query(
        `SELECT COUNT(*) AS assignedItems, COALESCE(SUM(quantity), 0) AS totalUnits
         FROM products WHERE employee_id = ?`,
        [id],
      );

      res.json({
        ok: true,
        data: {
          ...employee,
          branch,
          stats: {
            assignedItems: Number(itemStats?.assignedItems || 0),
            totalUnits: Number(itemStats?.totalUnits || 0),
          },
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/employees', async (req, res) => {
    try {
      const {
        employeeCode,
        firstName,
        lastName,
        email = '',
        phone = '',
        jobTitle = '',
        branchId,
        status = 'active',
      } = req.body || {};

      if (!firstName || !lastName || !branchId) {
        return res.status(400).json({ ok: false, message: 'First name, last name, and branch are required.' });
      }

      const [[branch]] = await pool.query('SELECT id FROM branches WHERE id = ? LIMIT 1', [String(branchId).trim()]);
      if (!branch) {
        return res.status(400).json({ ok: false, message: 'Selected branch was not found.' });
      }

      const id = `emp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const resolvedCode = await resolveEmployeeCode(employeeCode);

      await pool.query(
        `INSERT INTO employees (id, employee_code, first_name, last_name, email, phone, job_title, branch_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          resolvedCode,
          String(firstName).trim(),
          String(lastName).trim(),
          String(email).trim(),
          String(phone).trim(),
          String(jobTitle).trim(),
          branch.id,
          String(status).trim() || 'active',
        ],
      );

      const [[row]] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE e.id = ?`,
        [id],
      );
      res.status(201).json({ ok: true, data: mapEmployeeRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'An employee with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/employees/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Employee id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id, employee_code FROM employees WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Employee not found.' });
      }

      const {
        employeeCode,
        firstName,
        lastName,
        email = '',
        phone = '',
        jobTitle = '',
        branchId,
        status = 'active',
      } = req.body || {};

      if (!firstName || !lastName || !branchId) {
        return res.status(400).json({ ok: false, message: 'First name, last name, and branch are required.' });
      }

      const [[branch]] = await pool.query('SELECT id FROM branches WHERE id = ? LIMIT 1', [String(branchId).trim()]);
      if (!branch) {
        return res.status(400).json({ ok: false, message: 'Selected branch was not found.' });
      }

      const resolvedCode = await resolveEmployeeCode(employeeCode, { employeeId: id });

      await pool.query(
        `UPDATE employees
         SET employee_code = ?, first_name = ?, last_name = ?, email = ?, phone = ?, job_title = ?, branch_id = ?, status = ?
         WHERE id = ?`,
        [
          resolvedCode,
          String(firstName).trim(),
          String(lastName).trim(),
          String(email).trim(),
          String(phone).trim(),
          String(jobTitle).trim(),
          branch.id,
          String(status).trim() || 'active',
          id,
        ],
      );

      const [[row]] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE e.id = ?`,
        [id],
      );
      res.json({ ok: true, data: mapEmployeeRow(row) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'An employee with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/employees/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'Employee id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id FROM employees WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'Employee not found.' });
      }

      await pool.query('UPDATE products SET employee_id = NULL WHERE employee_id = ?', [id]);
      await pool.query('DELETE FROM employees WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/users/count', async (_req, res) => {
    try {
      const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM users');
      res.json({ ok: true, count: Number(row?.count || 0) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/users', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, email, role, email_verified, created_at FROM users ORDER BY created_at DESC',
      );
      res.json({ ok: true, data: rows });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/users/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'User id is required.' });
      }

      const [[row]] = await pool.query(
        'SELECT id, name, email, role, email_verified, created_at FROM users WHERE id = ?',
        [id],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'User not found.' });
      }

      res.json({ ok: true, data: row });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/users', async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role = 'user',
      } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ ok: false, message: 'Name, email, and password are required.' });
      }

      const id = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const passwordHash = hashPassword(String(password));

      await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role, email_verified)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [id, String(name).trim(), String(email).trim().toLowerCase(), passwordHash, String(role).trim() || 'user'],
      );

      const [[row]] = await pool.query(
        'SELECT id, name, email, role, email_verified, created_at FROM users WHERE id = ?',
        [id],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A user with this email already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.put('/users/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'User id is required.' });
      }

      const [[existing]] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ ok: false, message: 'User not found.' });
      }

      const {
        name,
        email,
        role = 'user',
        password,
      } = req.body || {};

      if (!name || !email) {
        return res.status(400).json({ ok: false, message: 'Name and email are required.' });
      }

      if (password) {
        const passwordHash = hashPassword(String(password));
        await pool.query(
          'UPDATE users SET name = ?, email = ?, role = ?, password_hash = ? WHERE id = ?',
          [String(name).trim(), String(email).trim().toLowerCase(), String(role).trim() || 'user', passwordHash, id],
        );
      } else {
        await pool.query(
          'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
          [String(name).trim(), String(email).trim().toLowerCase(), String(role).trim() || 'user', id],
        );
      }

      const [[row]] = await pool.query(
        'SELECT id, name, email, role, email_verified, created_at FROM users WHERE id = ?',
        [id],
      );
      res.json({ ok: true, data: row });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A user with this email already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ ok: false, message: 'User id is required.' });
      }

      if (String(req.adminClaims?.sub || '') === id) {
        return res.status(400).json({ ok: false, message: 'You cannot delete your own account.' });
      }

      const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
      if (!result.affectedRows) {
        return res.status(404).json({ ok: false, message: 'User not found.' });
      }

      await pool.query('DELETE FROM user_admin_roles WHERE user_id = ?', [id]);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/rbac/me', async (req, res) => {
    try {
      const userId = req.adminClaims?.sub;
      if (!userId) {
        return res.status(401).json({ ok: false, message: 'Authentication required.' });
      }
      const [[user]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(404).json({ ok: false, message: 'User not found.' });
      }
      const permissions = await loadUserAdminPermissions(pool, user.id, { legacyRole: user.role });
      res.json({ ok: true, data: { permissions } });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.use('/reminders', createReminderRouter());

  return router;
}
