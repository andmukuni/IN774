import express from 'express';

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
    try {
      const { testConnection } = await import('../db.js');
      const info = await testConnection();
      res.json({ ok: true, data: info });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
