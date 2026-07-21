import express from 'express';
import {
  getPresenceDevice,
  getPresenceSummary,
  listPresenceDevices,
} from '../utils/presenceHelpers.js';
import { addPresenceStreamClient, sendPresenceStreamEvent } from '../utils/presenceEvents.js';

function parseListQuery(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const status = String(query.status || '').trim();
  const search = String(query.search || query.q || '').trim();
  return { limit, offset, status, search };
}

export function createPresenceRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const q = parseListQuery(req.query);
      const result = await listPresenceDevices(q);
      res.json({
        ok: true,
        data: result.data,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/summary', async (_req, res) => {
    try {
      const data = await getPresenceSummary();
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

    const remove = addPresenceStreamClient(res);
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
      const [result, summary] = await Promise.all([
        listPresenceDevices({ limit: 200, offset: 0 }),
        getPresenceSummary(),
      ]);
      sendPresenceStreamEvent(res, 'snapshot', {
        devices: result.data,
        summary,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
        at: new Date().toISOString(),
      });
    } catch (error) {
      sendPresenceStreamEvent(res, 'error', { message: error.message });
      cleanup();
      res.end();
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const data = await getPresenceDevice(req.params.id);
      if (!data) {
        return res.status(404).json({ ok: false, message: 'Device not found.' });
      }
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
