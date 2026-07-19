import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { createAuthService } from './auth.js';
import { bootstrapDatabase } from './schema.js';
import { evaluateCorsOrigin } from './securityHelpers.js';
import {
  ALL_PERMISSION_KEYS,
  permissionMatches,
} from '../shared/rbacPermissions.js';
import pool from './db.js';
import { loadUserAdminPermissions, resolveRouteAdminPermission } from './rbacService.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createAdminRouter } from './routes/admin.js';
import { createPublicRouter } from './routes/public.js';
import { createExternalRouter } from './routes/external.js';
import { createDeveloperRouter } from './routes/developer.js';
import { loadBrandedIndexHtml } from './utils/htmlMetaHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);
const DEFAULT_AUTH_TOKEN_SECRET = 'dev-only-auth-secret';
const AUTH_TOKEN_SECRET_SOURCE = String(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
const AUTH_TOKEN_SECRET = AUTH_TOKEN_SECRET_SOURCE || DEFAULT_AUTH_TOKEN_SECRET;
const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY || '').trim();

if (IS_PRODUCTION && (!AUTH_TOKEN_SECRET_SOURCE || AUTH_TOKEN_SECRET === DEFAULT_AUTH_TOKEN_SECRET)) {
  throw new Error('AUTH_TOKEN_SECRET or JWT_SECRET must be set to a strong value in production.');
}

const coolifyServiceUrl = String(
  process.env.SERVICE_URL_GFL_INVENTORY || process.env.SERVICE_URL || '',
).trim().replace(/\/$/, '');
const corsOrigins = String(process.env.CORS_ORIGINS || coolifyServiceUrl || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const appUrl = String(process.env.APP_URL || coolifyServiceUrl || '').trim().replace(/\/$/, '');
const serverOrigin = appUrl || undefined;

const app = express();

if (process.env.TRUST_PROXY === '1' || IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

const authService = createAuthService({
  secret: AUTH_TOKEN_SECRET,
  adminApiKey: ADMIN_API_KEY,
  allPermissionKeys: ALL_PERMISSION_KEYS,
});

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use('/api', cors({
  origin(origin, callback) {
    const result = evaluateCorsOrigin(origin, {
      corsOrigins,
      serverOrigin,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
    if (result.allowed) return callback(null, true);
    return callback(new Error(result.reason || 'CORS blocked'));
  },
  credentials: false,
}));

app.use(express.json({ limit: '2mb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function isAdminProtectedRoute(req) {
  const method = String(req.method || '').toUpperCase();
  const routePath = String(req.path || '');

  if (routePath.startsWith('/auth/')) return false;
  if (routePath === '/health' || routePath === '/db-test') return false;
  if (routePath.startsWith('/public/')) return false;
  if (routePath.startsWith('/v1/')) return false;

  if (routePath.startsWith('/admin/')) return true;
  return false;
}

app.use('/api', async (req, res, next) => {
  if (!isAdminProtectedRoute(req)) return next();

  const auth = authService.getAdminAuth(req);
  if (!auth.ok) return authService.sendAuthFailure(res, auth);

  let perms = Array.isArray(auth.claims.permissions) ? auth.claims.permissions : [];

  if (auth.source === 'jwt' && auth.claims?.sub) {
    try {
      const [[userRow]] = await pool.query(
        'SELECT role FROM users WHERE id = ? LIMIT 1',
        [auth.claims.sub],
      );
      perms = await loadUserAdminPermissions(pool, auth.claims.sub, {
        legacyRole: userRow?.role || auth.claims.role,
      });
      auth.claims.permissions = perms;
    } catch (error) {
      console.warn('[auth] Failed to refresh admin permissions:', error.message);
    }
  }

  const requiredPerm = resolveRouteAdminPermission(req);
  const isLegacyAdmin = auth.claims.role === 'admin' && perms.length === 0;

  if (!isLegacyAdmin && !permissionMatches(perms, requiredPerm)) {
    return res.status(403).json({ ok: false, message: 'Insufficient permissions for this action.' });
  }

  req.adminClaims = auth.claims;
  return next();
});

app.use('/api', createHealthRouter());
app.use('/api/auth', createAuthRouter({ authService }));
app.use('/api/v1', createExternalRouter());
app.use('/api/admin/developer', createDeveloperRouter());
app.use('/api/admin', createAdminRouter());
app.use('/api/public', createPublicRouter());

const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

async function startHttpServer() {
  await fs.mkdir(uploadsDir, { recursive: true });

  const distDir = path.join(__dirname, '..', 'dist');
  if (IS_PRODUCTION) {
    try {
      await fs.access(distDir);
      app.use(express.static(distDir, { index: false }));
      app.get(/^(?!\/api|\/uploads).*/, async (_req, res, next) => {
        try {
          const html = await loadBrandedIndexHtml(distDir);
          res.type('html').send(html);
        } catch (error) {
          next(error);
        }
      });
    } catch {
      console.warn('[server] dist/ not found — API-only mode');
    }
  }

  const listenTarget = process.env.PASSENGER === '1' ? 'passenger' : '0.0.0.0';
  app.listen(listenTarget === 'passenger' ? PORT : PORT, listenTarget === 'passenger' ? undefined : '0.0.0.0', () => {
    console.log(`[server] GFL Inventory API listening on port ${PORT}`);
  });
}

async function main() {
  await bootstrapDatabase();
  await startHttpServer();
}

main().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});

export default app;
