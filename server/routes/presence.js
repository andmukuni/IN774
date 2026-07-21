import express from 'express';
import {
  getPresenceDevice,
  getPresenceSummary,
  listPresenceDevices,
} from '../utils/presenceHelpers.js';

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
