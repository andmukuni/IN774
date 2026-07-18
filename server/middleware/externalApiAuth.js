import { findApiKeyByRawKey, getClientIp, isIpAllowed, touchApiKeyLastUsed } from '../utils/apiKeyHelpers.js';
import { hasExternalScope } from '../../shared/externalApiScopes.js';

function extractApiKey(req) {
  const header = String(req.headers.authorization || '').trim();
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return String(req.headers['x-api-key'] || '').trim();
}

export function createExternalApiAuth(requiredScope) {
  return async (req, res, next) => {
    try {
      const rawKey = extractApiKey(req);
      if (!rawKey) {
        return res.status(401).json({ ok: false, message: 'API key required. Use Authorization: Bearer <key> or X-Api-Key.' });
      }

      const apiKey = await findApiKeyByRawKey(rawKey);
      if (!apiKey) {
        return res.status(401).json({ ok: false, message: 'Invalid or expired API key.' });
      }

      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp, apiKey.ipWhitelist)) {
        return res.status(403).json({ ok: false, message: 'Request IP is not whitelisted for this API key.' });
      }

      if (requiredScope && !hasExternalScope(apiKey.scopes, requiredScope)) {
        return res.status(403).json({ ok: false, message: `Missing required scope: ${requiredScope}` });
      }

      req.externalApiKey = apiKey;
      req.clientIp = clientIp;
      await touchApiKeyLastUsed(apiKey.id);
      return next();
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  };
}
