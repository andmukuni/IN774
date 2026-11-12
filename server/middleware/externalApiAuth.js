import {
  findApiKeyByRawKey,
  getClientIp,
  isIpAllowed,
  isUnrestrictedIpWhitelist,
  touchApiKeyLastUsed,
} from '../utils/apiKeyHelpers.js';
import { hasExternalScope } from '../../shared/externalApiScopes.js';
import { sendRouteError } from '../securityHelpers.js';

const TRUST_PROXY = process.env.TRUST_PROXY === '1';

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

      const clientIp = getClientIp(req, { trustProxy: TRUST_PROXY });
      const scope = String(requiredScope || '');
      // Heartbeats come from roaming office PCs; enrollment must be IP-bound.
      const skipIpWhitelist = scope === 'presence.report';
      if (!skipIpWhitelist && !isIpAllowed(clientIp, apiKey.ipWhitelist)) {
        return res.status(403).json({
          ok: false,
          message: `Request IP is not whitelisted for this API key. Detected IP: ${clientIp || 'unknown'}. Add this IP (or its CIDR range) to the key whitelist in Admin → Developer.`,
        });
      }
      if (scope === 'presence.enroll' && isUnrestrictedIpWhitelist(apiKey.ipWhitelist)) {
        return res.status(403).json({
          ok: false,
          message: 'Presence enrollment keys must use a specific IP allowlist (not * or 0.0.0.0/0). Heartbeat keys may allow any IP.',
        });
      }

      if (requiredScope && !hasExternalScope(apiKey.scopes, requiredScope)) {
        return res.status(403).json({ ok: false, message: `Missing required scope: ${requiredScope}` });
      }

      req.externalApiKey = apiKey;
      req.clientIp = clientIp;
      await touchApiKeyLastUsed(apiKey.id);
      return next();
    } catch (error) {
      return sendRouteError(res, error);
    }
  };
}

export function createExternalIpCheckHandler() {
  return async (req, res) => {
    try {
      const rawKey = extractApiKey(req);
      if (!rawKey) {
        return res.status(401).json({ ok: false, message: 'API key required. Use Authorization: Bearer <key> or X-Api-Key.' });
      }

      const apiKey = await findApiKeyByRawKey(rawKey);
      if (!apiKey) {
        return res.status(401).json({ ok: false, message: 'Invalid or expired API key.' });
      }

      const clientIp = getClientIp(req, { trustProxy: TRUST_PROXY });
      const whitelisted = isIpAllowed(clientIp, apiKey.ipWhitelist);

      return res.json({
        ok: true,
        data: {
          clientIp: clientIp || null,
          whitelisted,
          keyPrefix: apiKey.keyPrefix,
          whitelist: apiKey.ipWhitelist,
        },
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  };
}
