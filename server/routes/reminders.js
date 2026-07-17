import express from 'express';
import {
  createAndSendReminderSession,
  ensureReminderTables,
  fetchReminderSession,
  listReminderDeliveries,
  listReminderSessions,
  previewReminderCount,
} from '../utils/reminderHelpers.js';
import {
  buildExportFilename,
  buildExportSubtitle,
  REMINDER_EXPORT_COLUMNS,
  normalizeReminderExportRow,
  sendTableExport,
} from '../utils/catalogExportHelpers.js';
import { parseTableQuery, buildPaginatedResponse } from '../utils/tableQuery.js';

export function createReminderRouter() {
  const router = express.Router();

  router.get('/preview', async (req, res) => {
    try {
      const branchId = String(req.query.branchId || '').trim();
      const data = await previewReminderCount({ branchId });
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/sessions/export', async (req, res) => {
    try {
      const format = String(req.query.format || 'csv').trim().toLowerCase();
      const filters = {
        name: String(req.query.name || '').trim(),
        branchId: String(req.query.branchId || req.query.branch_id || '').trim(),
        status: String(req.query.status || '').trim(),
        ids: String(req.query.ids || '').trim()
          ? String(req.query.ids).split(',').map((id) => id.trim()).filter(Boolean)
          : [],
      };

      const { data } = await listReminderSessions({
        limit: 10000,
        offset: 0,
        ...filters,
      });

      const title = 'Employee Reminders';
      const subtitle = buildExportSubtitle(filters, data.length);
      const filename = buildExportFilename('employee-reminders', format === 'pdf' ? 'pdf' : 'csv', { suffix: filters.status || '' });

      return sendTableExport(res, {
        format,
        columns: REMINDER_EXPORT_COLUMNS,
        rows: data,
        normalizeRow: normalizeReminderExportRow,
        title,
        subtitle,
        filename,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/sessions', async (req, res) => {
    try {
      const q = parseTableQuery(req.query);
      const { data, total } = await listReminderSessions({
        limit: q.limit,
        offset: q.offset,
        search: q.search,
        name: String(req.query.name || '').trim(),
        branchId: String(req.query.branchId || req.query.branch_id || '').trim(),
        status: String(req.query.status || '').trim(),
      });

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      res.json({ ok: true, data, pagination: { total, page: q.page, limit: q.limit } });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/sessions/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const session = await fetchReminderSession(id);
      if (!session) {
        return res.status(404).json({ ok: false, message: 'Reminder session not found.' });
      }
      res.json({ ok: true, data: session });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get('/sessions/:id/deliveries', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const q = parseTableQuery(req.query);
      const { data, total } = await listReminderDeliveries(id, {
        limit: q.limit,
        offset: q.offset,
        search: q.search,
      });

      if (req.query.draw != null || req.query.start != null) {
        return res.json(buildPaginatedResponse(data, total, q));
      }

      res.json({ ok: true, data, pagination: { total, page: q.page, limit: q.limit } });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.post('/sessions', async (req, res) => {
    try {
      await ensureReminderTables();
      const name = String(req.body?.name || '').trim();
      const branchId = String(req.body?.branchId || '').trim();
      const appUrl = String(req.headers.origin || process.env.APP_URL || '').trim().replace(/\/$/, '');

      const session = await createAndSendReminderSession({
        name,
        branchId,
        createdBy: req.adminClaims?.sub || null,
        appUrl,
      });

      res.status(201).json({ ok: true, data: session });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
