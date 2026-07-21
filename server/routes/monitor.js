import express from 'express';
import {
  createMonitorTarget,
  deleteMonitorTarget,
  getMonitorTarget,
  getUptimeReport,
  listIncidents,
  listMonitorTargets,
  listRecentChecks,
  updateMonitorTarget,
} from '../utils/monitorHelpers.js';
import { executeTargetCheck } from '../utils/monitorScheduler.js';

export function createMonitorRouter() {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const data = await listMonitorTargets();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const data = await createMonitorTarget(req.body || {});
      res.status(201).json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/:id/report', async (req, res) => {
    try {
      const { from, to } = req.query || {};
      const data = await getUptimeReport(req.params.id, { from, to });
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.post('/:id/check', async (req, res) => {
    try {
      const target = await getMonitorTarget(req.params.id, { includeSecrets: true });
      const outcome = await executeTargetCheck(target);
      res.json({ ok: true, data: outcome });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const target = await getMonitorTarget(req.params.id);
      const checks = await listRecentChecks(req.params.id, { limit: 50 });
      const incidents = await listIncidents(req.params.id, { limit: 50 });
      const report = await getUptimeReport(req.params.id);
      res.json({
        ok: true,
        data: {
          target,
          checks,
          incidents,
          report,
        },
      });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const data = await updateMonitorTarget(req.params.id, req.body || {});
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await deleteMonitorTarget(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
