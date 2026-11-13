import express from 'express';
import pool from '../db.js';
import { rateLimitByKey } from '../securityHelpers.js';
import { parseTableQuery, buildPaginatedResponse } from '../utils/tableQuery.js';
import { createExternalApiAuth, createExternalIpCheckHandler } from '../middleware/externalApiAuth.js';
import {
  mapExternalAsset,
  mapExternalAssignment,
  mapExternalEmployee,
  mapExternalMonitorTarget,
  PRODUCT_JOIN_SQL,
  PRODUCT_SELECT_FIELDS,
} from '../utils/externalApiHelpers.js';
import { upsertHeartbeat } from '../utils/presenceHelpers.js';
import {
  enrollPresenceDevice,
  listSetupBranches,
  lookupSetupEmployee,
} from '../utils/presenceEnrollHelpers.js';
import {
  getMonitorTarget,
  listMonitorTargetsWithTelemetry,
} from '../utils/monitorHelpers.js';

function parseListQuery(query) {
  const q = parseTableQuery(query, { defaultLimit: 50, maxLimit: 200 });
  const branchId = String(query.branchId || query.branch_id || '').trim();
  const employeeId = String(query.employeeId || query.employee_id || '').trim();
  const status = String(query.status || '').trim();
  return { ...q, branchId, employeeId, status };
}

export function createExternalRouter() {
  const router = express.Router();

  router.use(rateLimitByKey({
    windowMs: 60_000,
    max: 120,
    routeKey: 'external-api',
    getKey: (req) => req.externalApiKey?.id || req.ip || 'unknown',
  }));

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'gfl-external-api', version: 'v1' });
  });

  router.get('/ip-check', createExternalIpCheckHandler());

  router.get('/assets', createExternalApiAuth('assets.read'), async (req, res) => {
    try {
      const q = parseListQuery(req.query);
      const clauses = ["p.status != 'discontinued'"];
      const params = [];

      if (q.search) {
        clauses.push('(p.sku LIKE ? OR p.name LIKE ? OR p.category LIKE ? OR br.name LIKE ? OR e.employee_code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)');
        const term = `%${q.search}%`;
        params.push(term, term, term, term, term, term, term);
      }
      if (q.branchId) {
        clauses.push('(p.branch_id = ? OR e.branch_id = ?)');
        params.push(q.branchId, q.branchId);
      }
      if (q.employeeId) {
        clauses.push('p.employee_id = ?');
        params.push(q.employeeId);
      }
      if (q.status) {
        clauses.push('p.status = ?');
        params.push(q.status);
      }

      const where = `WHERE ${clauses.join(' AND ')}`;
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM products p ${PRODUCT_JOIN_SQL}
         ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const [rows] = await pool.query(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p ${PRODUCT_JOIN_SQL}
         ${where}
         ORDER BY p.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      res.json(buildPaginatedResponse(rows.map(mapExternalAsset), total, q));
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/assets/:id', createExternalApiAuth('assets.read'), async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const [[row]] = await pool.query(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p ${PRODUCT_JOIN_SQL}
         WHERE p.id = ? AND p.status != 'discontinued'
         LIMIT 1`,
        [id],
      );
      if (!row) {
        return res.status(404).json({ ok: false, message: 'Asset not found.' });
      }
      res.json({ ok: true, data: mapExternalAsset(row) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/employees', createExternalApiAuth('employees.read'), async (req, res) => {
    try {
      const q = parseListQuery(req.query);
      const clauses = [];
      const params = [];

      if (q.search) {
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
        const term = `%${q.search}%`;
        params.push(term, term, term, term, term, term, term, term, term);
      }
      if (q.branchId) {
        clauses.push('e.branch_id = ?');
        params.push(q.branchId);
      }
      if (q.status) {
        clauses.push('e.status = ?');
        params.push(q.status);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const [rows] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name,
                (SELECT COUNT(*) FROM products p WHERE p.employee_id = e.id AND p.status != 'discontinued') AS asset_count
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         ${where}
         ORDER BY e.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      const data = rows.map((row) => mapExternalEmployee(row, { assetCount: row.asset_count }));
      res.json(buildPaginatedResponse(data, total, q));
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/employees/:id', createExternalApiAuth('employees.read'), async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const [[row]] = await pool.query(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.job_title, e.branch_id, e.status, e.updated_at,
                b.code AS branch_code, b.name AS branch_name,
                (SELECT COUNT(*) FROM products p WHERE p.employee_id = e.id AND p.status != 'discontinued') AS asset_count
         FROM employees e
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE e.id = ?
         LIMIT 1`,
        [id],
      );
      if (!row) {
        return res.status(404).json({ ok: false, message: 'Employee not found.' });
      }
      res.json({ ok: true, data: mapExternalEmployee(row, { assetCount: row.asset_count }) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/employees/:id/assets', createExternalApiAuth('employees.read'), async (req, res) => {
    try {
      const employeeId = String(req.params.id || '').trim();
      const [[employee]] = await pool.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [employeeId]);
      if (!employee) {
        return res.status(404).json({ ok: false, message: 'Employee not found.' });
      }

      const q = parseListQuery(req.query);
      const params = [employeeId];
      let searchClause = '';
      if (q.search) {
        searchClause = ' AND (p.sku LIKE ? OR p.name LIKE ? OR p.category LIKE ?)';
        const term = `%${q.search}%`;
        params.push(term, term, term);
      }

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM products p
         WHERE p.employee_id = ? AND p.status != 'discontinued'${searchClause}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const [rows] = await pool.query(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p ${PRODUCT_JOIN_SQL}
         WHERE p.employee_id = ? AND p.status != 'discontinued'${searchClause}
         ORDER BY p.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      res.json(buildPaginatedResponse(rows.map(mapExternalAsset), total, q));
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/presence/heartbeat', createExternalApiAuth('presence.report'), async (req, res) => {
    try {
      const data = await upsertHeartbeat(req.body || {});
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/presence/setup/branches', createExternalApiAuth('presence.enroll'), async (_req, res) => {
    try {
      const data = await listSetupBranches();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.post('/presence/setup/lookup', createExternalApiAuth('presence.enroll'), async (req, res) => {
    try {
      const data = await lookupSetupEmployee(req.body || {});
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.post('/presence/setup/enroll', createExternalApiAuth('presence.enroll'), async (req, res) => {
    try {
      const data = await enrollPresenceDevice(req.body || {});
      res.status(data.created ? 201 : 200).json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/assignments', createExternalApiAuth('assignments.read'), async (req, res) => {
    try {
      const q = parseListQuery(req.query);
      const clauses = ["p.status != 'discontinued'", 'p.employee_id IS NOT NULL', "p.employee_id != ''"];
      const params = [];

      if (q.search) {
        clauses.push('(p.sku LIKE ? OR p.name LIKE ? OR e.employee_code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)');
        const term = `%${q.search}%`;
        params.push(term, term, term, term, term);
      }
      if (q.branchId) {
        clauses.push('(p.branch_id = ? OR e.branch_id = ?)');
        params.push(q.branchId, q.branchId);
      }
      if (q.employeeId) {
        clauses.push('p.employee_id = ?');
        params.push(q.employeeId);
      }

      const where = `WHERE ${clauses.join(' AND ')}`;
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM products p ${PRODUCT_JOIN_SQL}
         ${where}`,
        params,
      );
      const total = Number(countRow?.total || 0);

      const [rows] = await pool.query(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p ${PRODUCT_JOIN_SQL}
         ${where}
         ORDER BY p.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, q.limit, q.offset],
      );

      res.json(buildPaginatedResponse(rows.map(mapExternalAssignment), total, q));
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/monitor', createExternalApiAuth('monitor.read'), async (req, res) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const type = String(req.query.type || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim().toLowerCase();
      const enabledRaw = String(req.query.enabled ?? '').trim().toLowerCase();

      let targets = await listMonitorTargetsWithTelemetry();

      if (search) {
        targets = targets.filter((t) => {
          const haystack = `${t.name || ''} ${t.hostOrUrl || ''} ${t.type || ''}`.toLowerCase();
          return haystack.includes(search);
        });
      }
      if (type) {
        targets = targets.filter((t) => String(t.type || '').toLowerCase() === type);
      }
      if (status) {
        targets = targets.filter((t) => String(t.status || '').toLowerCase() === status);
      }
      if (enabledRaw === 'true' || enabledRaw === '1') {
        targets = targets.filter((t) => t.enabled);
      } else if (enabledRaw === 'false' || enabledRaw === '0') {
        targets = targets.filter((t) => !t.enabled);
      }

      res.json({ ok: true, data: targets.map(mapExternalMonitorTarget) });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/monitor/:id', createExternalApiAuth('monitor.read'), async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const target = await getMonitorTarget(id);
      const [withTelemetry] = (await listMonitorTargetsWithTelemetry())
        .filter((t) => t.id === id);
      res.json({ ok: true, data: mapExternalMonitorTarget(withTelemetry || target) });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
