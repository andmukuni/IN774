import express from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { clipString, limitJsonBody, rateLimitByKey, sendRouteError } from '../securityHelpers.js';
import { mapPublicBranchRow } from '../utils/branchHelpers.js';
import { mapPublicEmployeeRow, toPublicEmployee } from '../utils/employeeHelpers.js';
import { mapBrandRow } from '../utils/brandHelpers.js';
import { mapProductTypeRow } from '../utils/productTypeHelpers.js';
import { mapProductRow, PRODUCT_JOIN_SQL, PRODUCT_SELECT_FIELDS, computeProductStatus } from '../utils/inventoryHelpers.js';
import {
  INTAKE_BRANCH_DEVICE_TYPES,
  INTAKE_EMPLOYEE_DEVICE_TYPES,
  buildDeviceName,
  resolveBrandId,
  findActiveBranchByName,
  findEmployeeByContact,
  fetchEmployeeIntakeDevices,
} from '../utils/intakeHelpers.js';
import { logProductRegistration, PRODUCT_EVENT_TYPES } from '../utils/productEventHelpers.js';
import { getPublicSettings } from '../utils/systemSettingsHelpers.js';
import {
  assertIntakeWriteToken,
  ensureReminderTables,
  markReminderSubmitted,
  resolveReminderToken,
} from '../utils/reminderHelpers.js';

const intakeRateLimit = rateLimitByKey({
  windowMs: 60_000,
  max: 8,
  routeKey: 'public-intake',
  getKey: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
});

const MAX_INTAKE_DEVICES = 25;
const MAX_INTAKE_PRINTERS = 10;

export function createPublicRouter() {
  const router = express.Router();
  router.use(limitJsonBody(64 * 1024));

  router.get('/settings', async (_req, res) => {
    try {
      const data = await getPublicSettings();
      res.json({ ok: true, data });
    } catch (error) {
      return sendRouteError(res, error);
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
        `SELECT id, code, name, city, status
         FROM branches ${where}
         ORDER BY name ASC
         LIMIT 100`,
        params,
      );

      res.json({ ok: true, data: rows.map(mapPublicBranchRow) });
    } catch (error) {
      return sendRouteError(res, error);
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

      const name = clipString(req.body?.name, 120);
      if (!name) {
        return res.status(400).json({ ok: false, message: 'Branch name is required.' });
      }

      const intakeAuth = await assertIntakeWriteToken(
        clipString(req.body?.reminderToken || req.body?.token, 200),
      );
      const branch = await findActiveBranchByName(name);
      if (intakeAuth.branchId !== branch.id) {
        return res.status(403).json({
          ok: false,
          message: 'This reminder link is for a different branch.',
        });
      }
      res.json({ ok: true, data: mapPublicBranchRow({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        city: branch.city,
        status: branch.status,
      }) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A branch with this code already exists.' });
      }
      return sendRouteError(res, error);
    }
  });

  router.get('/branches/:code', async (req, res) => {
    try {
      const code = String(req.params.code || '').trim();
      if (!code) {
        return res.status(400).json({ ok: false, message: 'Branch code is required.' });
      }

      const [[row]] = await pool.query(
        `SELECT id, code, name, city, status
         FROM branches WHERE code = ? AND status = 'active' LIMIT 1`,
        [code],
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      res.json({ ok: true, data: mapPublicBranchRow(row) });
    } catch (error) {
      return sendRouteError(res, error);
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
        `SELECT e.id, e.first_name, e.last_name, e.job_title, e.branch_id, e.status,
                b.name AS branch_name
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE e.branch_id = ? AND e.status = 'active'
         ORDER BY e.first_name ASC, e.last_name ASC`,
        [branch.id],
      );

      res.json({ ok: true, data: rows.map(mapPublicEmployeeRow) });
    } catch (error) {
      return sendRouteError(res, error);
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
      return sendRouteError(res, error);
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
      return sendRouteError(res, error);
    }
  });

  router.get('/reminders/resolve', intakeRateLimit, async (req, res) => {
    try {
      await ensureReminderTables();
      const token = String(req.query.t || req.query.token || '').trim();
      if (!token) {
        return res.status(400).json({ ok: false, message: 'Reminder token is required.' });
      }

      const data = await resolveReminderToken(token, {
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
      });

      res.json({ ok: true, data });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  router.post('/employees/lookup', intakeRateLimit, async (req, res) => {
    try {
      const publicSettings = await getPublicSettings();
      if (!publicSettings.intakeEnabled) {
        return res.status(403).json({
          ok: false,
          message: 'Branch equipment reporting is temporarily disabled. Please contact your administrator.',
        });
      }

      const branchId = String(req.body?.branchId || '').trim();
      const email = String(req.body?.email || '').trim();
      const phone = String(req.body?.phone || '').trim();

      if (!branchId) {
        return res.status(400).json({ ok: false, message: 'Branch is required.' });
      }
      if (!email && !phone) {
        return res.status(400).json({ ok: false, message: 'Email or phone is required to look up your profile.' });
      }

      const [[branch]] = await pool.query(
        'SELECT id FROM branches WHERE id = ? AND status = \'active\' LIMIT 1',
        [branchId],
      );
      if (!branch) {
        return res.status(404).json({ ok: false, message: 'Branch not found.' });
      }

      const employee = await findEmployeeByContact(branch.id, { email, phone });
      const devices = employee ? await fetchEmployeeIntakeDevices(employee.id) : [];
      const publicEmployee = employee
        ? {
            ...toPublicEmployee(employee),
            email: employee.email || '',
            phone: employee.phone || '',
          }
        : null;

      res.json({
        ok: true,
        data: {
          employee: publicEmployee,
          devices,
        },
      });
    } catch (error) {
      return sendRouteError(res, error);
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
        reminderToken = '',
      } = req.body || {};

      const intakeAuth = await assertIntakeWriteToken(clipString(reminderToken, 200));

      if (!Array.isArray(devices) || !Array.isArray(printers)) {
        return res.status(400).json({ ok: false, message: 'Devices and printers must be arrays.' });
      }
      if (devices.length > MAX_INTAKE_DEVICES || printers.length > MAX_INTAKE_PRINTERS) {
        return res.status(400).json({
          ok: false,
          message: `Too many devices. Maximum is ${MAX_INTAKE_DEVICES} employee devices and ${MAX_INTAKE_PRINTERS} printers.`,
        });
      }

      const resolvedBranchId = clipString(branchId, 90);
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

      if (intakeAuth.branchId !== branch.id) {
        return res.status(403).json({
          ok: false,
          message: 'This reminder link is for a different branch.',
        });
      }

      const requestedEmployeeId = clipString(employeeId, 90);
      if (requestedEmployeeId && requestedEmployeeId !== intakeAuth.employeeId) {
        return res.status(403).json({
          ok: false,
          message: 'This reminder link does not match the selected employee.',
        });
      }

      const resolvedEmployeeId = intakeAuth.employeeId;
      const [[employee]] = await pool.query(
        'SELECT id, branch_id FROM employees WHERE id = ? AND status = \'active\' LIMIT 1',
        [resolvedEmployeeId],
      );
      if (!employee || employee.branch_id !== branch.id) {
        return res.status(400).json({ ok: false, message: 'Selected employee does not belong to this branch.' });
      }

      const emp = newEmployee || {};
      const nextPhone = clipString(emp.phone, 60);
      const nextEmail = clipString(emp.email, 255);
      const nextJobTitle = clipString(emp.jobTitle, 120);
      if (nextPhone || nextEmail || nextJobTitle) {
        await pool.query(
          `UPDATE employees
           SET phone = CASE WHEN ? != '' THEN ? ELSE phone END,
               email = CASE WHEN ? != '' THEN ? ELSE email END,
               job_title = CASE WHEN ? != '' THEN ? ELSE job_title END
           WHERE id = ?`,
          [nextPhone, nextPhone, nextEmail, nextEmail, nextJobTitle, nextJobTitle, resolvedEmployeeId],
        );
      }

      const brandNameById = new Map();
      const [brandRows] = await pool.query('SELECT id, name FROM brands WHERE status = \'active\'');
      for (const b of brandRows) brandNameById.set(b.id, b.name);

      const created = { employeeDevices: [], branchPrinters: [] };

      for (const device of devices) {
        const type = clipString(device.type, 40);
        if (!INTAKE_EMPLOYEE_DEVICE_TYPES.includes(type)) continue;

        let brandId = null;
        try {
          brandId = await resolveBrandId(device.brandId);
        } catch (err) {
          return res.status(err.status || 400).json({ ok: false, message: err.message });
        }

        const brandName = brandId ? brandNameById.get(brandId) : '';
        const name = clipString(device.name, 255) || buildDeviceName({
          type,
          brandName,
          model: clipString(device.model, 120),
        });
        const sku = clipString(device.serialNumber || device.sku, 80);
        if (!sku) {
          return res.status(400).json({ ok: false, message: 'Serial number (S/N) is required for each device.' });
        }
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
        const name = clipString(printer.name, 255) || buildDeviceName({
          type: 'Printer',
          brandName,
          model: clipString(printer.model, 120),
        });
        const sku = clipString(printer.serialNumber || printer.sku, 80);
        if (!sku) {
          return res.status(400).json({ ok: false, message: 'Serial number (S/N) is required for each printer.' });
        }
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

      const token = String(reminderToken || '').trim();
      if (token) {
        await ensureReminderTables();
        await markReminderSubmitted(token);
      }

      res.status(201).json({
        ok: true,
        data: {
          branch: mapPublicBranchRow(branch),
          employeeId: resolvedEmployeeId,
          created,
        },
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, message: 'A duplicate serial number or employee code was detected.' });
      }
      return sendRouteError(res, error);
    }
  });

  return router;
}
