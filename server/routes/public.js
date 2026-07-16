import express from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { rateLimitByKey } from '../securityHelpers.js';
import { mapBranchRow } from '../utils/branchHelpers.js';
import { mapEmployeeRow } from '../utils/employeeHelpers.js';
import { mapBrandRow } from '../utils/brandHelpers.js';
import { mapProductTypeRow } from '../utils/productTypeHelpers.js';
import { mapProductRow, PRODUCT_JOIN_SQL, PRODUCT_SELECT_FIELDS, computeProductStatus } from '../utils/inventoryHelpers.js';
import {
  INTAKE_BRANCH_DEVICE_TYPES,
  INTAKE_EMPLOYEE_DEVICE_TYPES,
  buildDeviceName,
  resolveBrandId,
  resolveEmployeeCode,
  resolveProductSn,
  resolveBranchByName,
} from '../utils/intakeHelpers.js';
import { logProductRegistration, PRODUCT_EVENT_TYPES } from '../utils/productEventHelpers.js';
import { getPublicSettings } from '../utils/systemSettingsHelpers.js';

const intakeRateLimit = rateLimitByKey({
  windowMs: 60_000,
  max: 8,
  routeKey: 'public-intake',
  getKey: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
});

export function createPublicRouter() {
  const router = express.Router();

  router.get('/settings', async (_req, res) => {
    try {
      const data = await getPublicSettings();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/branches', async (req, res) => {
    try {
      const search = String(req.query.search || '').trim();
      const clauses = ["status = 'active'"];
      const params = [];

      if (search) {
        clauses.push('(code LIKE ? OR name LIKE ? OR city LIKE ?)');
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      const where = `WHERE ${clauses.join(' AND ')}`;
      const [rows] = await pool.query(
        `SELECT id, code, name, city, address, phone, manager_name, status, updated_at
         FROM branches ${where}
         ORDER BY name ASC
         LIMIT 100`,
        params,
      );

      res.json({ ok: true, data: rows.map(mapBranchRow) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/branches/resolve', intakeRateLimit, async (req, res) => {
    try {
      const publicSettings = await getPublicSettings();
      if (!publicSettings.intakeEnabled) {
        return res.status(403).json({
          ok: false,
          message: 'Branch equipment reporting is temporarily disabled. Please contact your administrator.',
        });
      }

      const name = String(req.body?.name || '').trim();
      if (!name) {
        return res.status(400).json({ ok: false, message: 'Branch name is required.' });
      }

      const branch = await resolveBranchByName(name);
      res.status(201).json({ ok: true, data: branch });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A branch with this code already exists.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/branches/:code', async (req, res) => {
    try {
      const code = String(req.params.code || '').trim();
      if (!code) {
        return res.status(400).json({ ok: false, message: 'Branch code is required.' });
      }

      const [[row]] = await pool.query(
        `SELECT id, code, name, city, address, phone, manager_name, status, updated_at
         FROM branches WHERE code = ? AND status = 'active' LIMIT 1`,
        [code],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      res.json({ ok: true, data: mapBranchRow(row) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/branches/:code/employees', async (req, res) => {
    try {
      const code = String(req.params.code || '').trim();
      const [[branch]] = await pool.query(
        'SELECT id FROM branches WHERE code = ? AND status = \'active\' LIMIT 1',
        [code],
      );
      if (!branch) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      const [rows] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE e.branch_id = ? AND e.status = 'active'
         ORDER BY e.first_name ASC, e.last_name ASC`,
        [branch.id],
      );

      res.json({ ok: true, data: rows.map(mapEmployeeRow) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/branches/:code/equipment', async (req, res) => {
    try {
      const code = String(req.params.code || '').trim();
      const [[branch]] = await pool.query(
        'SELECT id FROM branches WHERE code = ? AND status = \'active\' LIMIT 1',
        [code],
      );
      if (!branch) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      const [rows] = await pool.query(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p ${PRODUCT_JOIN_SQL}
         WHERE (p.branch_id = ? OR e.branch_id = ?) AND p.status != 'discontinued'
         ORDER BY p.category ASC, p.name ASC
         LIMIT 200`,
        [branch.id, branch.id],
      );

      const data = rows.map(mapProductRow);
      const employeeDevices = data.filter((d) => INTAKE_EMPLOYEE_DEVICE_TYPES.includes(d.category));
      const branchPrinters = data.filter((d) => d.category === 'Printer');

      res.json({
        ok: true,
        data: {
          employeeDevices,
          branchPrinters,
          all: data,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/catalog', async (req, res) => {
    try {
      const [brandRows] = await pool.query(
        `SELECT id, code, name, status, updated_at FROM brands WHERE status = 'active' ORDER BY name ASC`,
      );
      const [typeRows] = await pool.query(
        `SELECT id, code, name, description, status, updated_at FROM product_types WHERE status = 'active' ORDER BY name ASC`,
      );

      const employeeTypes = typeRows
        .map(mapProductTypeRow)
        .filter((t) => INTAKE_EMPLOYEE_DEVICE_TYPES.includes(t.name));
      const branchTypes = typeRows
        .map(mapProductTypeRow)
        .filter((t) => INTAKE_BRANCH_DEVICE_TYPES.includes(t.name));

      res.json({
        ok: true,
        data: {
          brands: brandRows.map(mapBrandRow),
          employeeDeviceTypes: employeeTypes,
          branchDeviceTypes: branchTypes,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/intake', intakeRateLimit, async (req, res) => {
    try {
      const publicSettings = await getPublicSettings();
      if (!publicSettings.intakeEnabled) {
        return res.status(403).json({
          ok: false,
          message: 'Branch equipment reporting is temporarily disabled. Please contact your administrator.',
        });
      }

      const {
        branchId,
        employeeId,
        newEmployee,
        devices = [],
        printers = [],
      } = req.body || {};

      const resolvedBranchId = String(branchId || '').trim();
      if (!resolvedBranchId) {
        return res.status(400).json({ ok: false, message: 'Branch is required.' });
      }

      const [[branch]] = await pool.query(
        'SELECT id, code, name FROM branches WHERE id = ? AND status = \'active\' LIMIT 1',
        [resolvedBranchId],
      );
      if (!branch) {
        return res.status(400).json({ ok: false, message: 'Branch not found.' });
      }

      let resolvedEmployeeId = String(employeeId || '').trim() || null;

      if (!resolvedEmployeeId) {
        const emp = newEmployee || {};
        const firstName = String(emp.firstName || '').trim();
        const lastName = String(emp.lastName || '').trim();
        if (!firstName || !lastName) {
          return res.status(400).json({ ok: false, message: 'First and last name are required.' });
        }

        const code = await resolveEmployeeCode(emp.employeeCode);
        resolvedEmployeeId = `emp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        await pool.query(
          `INSERT INTO employees (id, employee_code, first_name, last_name, email, phone, job_title, branch_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            resolvedEmployeeId,
            code,
            firstName,
            lastName,
            String(emp.email || '').trim(),
            String(emp.phone || '').trim(),
            String(emp.jobTitle || '').trim(),
            branch.id,
          ],
        );
      } else {
        const [[employee]] = await pool.query(
          'SELECT id, branch_id FROM employees WHERE id = ? AND status = \'active\' LIMIT 1',
          [resolvedEmployeeId],
        );
        if (!employee || employee.branch_id !== branch.id) {
          return res.status(400).json({ ok: false, message: 'Selected employee does not belong to this branch.' });
        }
      }

      const brandNameById = new Map();
      const [brandRows] = await pool.query('SELECT id, name FROM brands WHERE status = \'active\'');
      for (const b of brandRows) brandNameById.set(b.id, b.name);

      const created = { employeeDevices: [], branchPrinters: [] };

      for (const device of devices) {
        const type = String(device.type || '').trim();
        if (!INTAKE_EMPLOYEE_DEVICE_TYPES.includes(type)) continue;

        let brandId = null;
        try {
          brandId = await resolveBrandId(device.brandId);
        } catch (err) {
          return res.status(err.status || 400).json({ ok: false, message: err.message });
        }

        const brandName = brandId ? brandNameById.get(brandId) : '';
        const name = String(device.name || '').trim() || buildDeviceName({
          type,
          brandName,
          model: device.model,
        });
        const sku = await resolveProductSn(device.serialNumber || device.sku);
        const productId = `prd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        await pool.query(
          `INSERT INTO products (id, sku, name, category, brand_id, branch_id, quantity, reorder_level, unit_price, status, employee_id)
           VALUES (?, ?, ?, ?, ?, NULL, 1, 0, NULL, 'in_stock', ?)`,
          [productId, sku, name, type, brandId, resolvedEmployeeId],
        );

        await logProductRegistration(pool, {
          productId,
          employeeId: resolvedEmployeeId,
          branchId: branch.id,
          actor: 'branch-intake',
          eventType: PRODUCT_EVENT_TYPES.INTAKE,
          summary: `Reported via branch intake at ${branch.name}`,
        });

        created.employeeDevices.push({ id: productId, sku, name, category: type });
      }

      for (const printer of printers) {
        let brandId = null;
        try {
          brandId = await resolveBrandId(printer.brandId);
        } catch (err) {
          return res.status(err.status || 400).json({ ok: false, message: err.message });
        }

        const brandName = brandId ? brandNameById.get(brandId) : '';
        const name = String(printer.name || '').trim() || buildDeviceName({
          type: 'Printer',
          brandName,
          model: printer.model,
        });
        const sku = await resolveProductSn(printer.serialNumber || printer.sku);
        const productId = `prd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        await pool.query(
          `INSERT INTO products (id, sku, name, category, brand_id, branch_id, quantity, reorder_level, unit_price, status, employee_id)
           VALUES (?, ?, ?, 'Printer', ?, ?, 1, 0, NULL, 'in_stock', NULL)`,
          [productId, sku, name, brandId, branch.id],
        );

        await logProductRegistration(pool, {
          productId,
          branchId: branch.id,
          actor: 'branch-intake',
          eventType: PRODUCT_EVENT_TYPES.INTAKE,
          summary: `Branch printer reported via intake at ${branch.name}`,
        });

        created.branchPrinters.push({ id: productId, sku, name, category: 'Printer' });
      }

      if (!created.employeeDevices.length && !created.branchPrinters.length) {
        return res.status(400).json({ ok: false, message: 'Add at least one device or printer.' });
      }

      res.status(201).json({
        ok: true,
        data: {
          branch: mapBranchRow(branch),
          employeeId: resolvedEmployeeId,
          created,
        },
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A duplicate serial number or employee code was detected.' });
      }
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
