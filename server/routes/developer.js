import express from 'express';
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  updateApiKey,
} from '../utils/apiKeyHelpers.js';
import { EXTERNAL_API_SCOPES } from '../../shared/externalApiScopes.js';
import { sendRouteError } from '../securityHelpers.js';

export function createDeveloperRouter() {
  const router = express.Router();

  router.get('/meta', async (_req, res) => {
    try {
      const baseUrl = String(process.env.APP_URL || process.env.SERVICE_URL_GFL_INVENTORY || '').trim().replace(/\/$/, '');
      res.json({
        ok: true,
        data: {
          apiBasePath: '/api/v1',
          apiBaseUrl: baseUrl ? `${baseUrl}/api/v1` : '/api/v1',
          scopes: EXTERNAL_API_SCOPES,
          authHeaders: [
            'Authorization: Bearer <api-key>',
            'X-Api-Key: <api-key>',
          ],
        },
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  router.get('/api-keys', async (_req, res) => {
    try {
      const data = await listApiKeys();
      res.json({ ok: true, data });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  router.post('/api-keys', async (req, res) => {
    try {
      const { name, scopes, ipWhitelist, expiresAt } = req.body || {};
      const data = await createApiKey({
        name,
        scopes,
        ipWhitelist,
        expiresAt: expiresAt || null,
        createdBy: req.adminClaims?.sub || null,
      });
      res.status(201).json({ ok: true, data });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  router.put('/api-keys/:id', async (req, res) => {
    try {
      const data = await updateApiKey(req.params.id, req.body || {});
      res.json({ ok: true, data });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  router.delete('/api-keys/:id', async (req, res) => {
    try {
      await deleteApiKey(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  return router;
}
