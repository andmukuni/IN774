import express from 'express';
import {
  createMonitorTarget,
  deleteMonitorTarget,
  getMonitorTarget,
  getUptimeReport,
  broadcastMonitorSnapshot,
  listIncidents,
  listMonitorTargetsWithTelemetry,
  listRecentChecks,
  updateMonitorTarget,
} from '../utils/monitorHelpers.js';
import { addMonitorStreamClient, sendMonitorStreamEvent } from '../utils/monitorEvents.js';
import { executeTargetCheck } from '../utils/monitorScheduler.js';

export function createMonitorRouter() {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const data = await listMonitorTargetsWithTelemetry();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const remove = addMonitorStreamClient(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      remove();
    };

    req.on('close', cleanup);

    try {
      const targets = await listMonitorTargetsWithTelemetry();
      sendMonitorStreamEvent(res, 'snapshot', {
        targets,
        at: new Date().toISOString(),
      });
    } catch (error) {
      sendMonitorStreamEvent(res, 'error', { message: error.message });
      cleanup();
      res.end();
    }
  });

  router.post('/', async (req, res) => {
    try {
      const data = await createMonitorTarget(req.body || {});
      await broadcastMonitorSnapshot();
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
      await broadcastMonitorSnapshot();
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
      await broadcastMonitorSnapshot();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await deleteMonitorTarget(req.params.id);
      await broadcastMonitorSnapshot();
      res.json({ ok: true });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
