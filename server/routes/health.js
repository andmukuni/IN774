import express from 'express';
import { sendRouteError } from '../securityHelpers.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function createHealthRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'node-template-api',
      version: '1.0.0',
    });
  });

  router.get('/db-test', async (_req, res) => {
    if (IS_PRODUCTION) {
      return res.status(404).json({ ok: false, message: 'Not found.' });
    }
    try {
      const { testConnection } = await import('../db.js');
      const info = await testConnection();
      res.json({ ok: true, data: info });
    } catch (error) {
      return sendRouteError(res, error, 'Database check failed.');
    }
  });

  return router;
}
