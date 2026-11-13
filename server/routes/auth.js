import express from 'express';
import pool from '../db.js';
import { hashPassword, verifyPassword } from '../auth.js';
import { rateLimitByKey } from '../securityHelpers.js';
import {
  loadUserAdminPermissions,
  userCanAccessAdmin,
} from '../rbacService.js';

function mapAuthSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role || 'user',
    email_verified: Boolean(user.email_verified),
  };
}

export function createAuthRouter({ authService }) {
  const router = express.Router();

  const rateLimitAuth = rateLimitByKey({
    windowMs: 15 * 60 * 1000,
    max: 10,
    routeKey: 'auth',
    getKey: (req) => req.ip || 'unknown',
  });

  router.post('/login', rateLimitAuth, async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ ok: false, message: 'Email and password are required.' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

      const verification = user ? verifyPassword(password, user.password_hash) : { valid: false, needsUpgrade: false };
      if (!user || !verification.valid) {
        return res.status(401).json({ ok: false, message: 'Invalid email or password.' });
      }

      if (verification.needsUpgrade) {
        try {
          await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), user.id]);
        } catch (upgradeErr) {
          console.warn('[auth/login] Could not upgrade legacy password hash:', upgradeErr.message);
        }
      }

      if (!user.email_verified) {
        return res.status(403).json({
          ok: false,
          message: 'Please verify your email address before logging in.',
          unverified: true,
        });
      }

      const adminPermissions = await loadUserAdminPermissions(pool, user.id, { legacyRole: user.role });
      const canAccessAdmin = userCanAccessAdmin(user.role, adminPermissions);
      const sessionUser = {
        ...mapAuthSessionUser(user),
        admin_permissions: canAccessAdmin ? adminPermissions : [],
        admin_access: canAccessAdmin,
      };

      const token = authService.signUserToken(user, {
        adminPermissions,
        canAccessAdmin,
      });

      return res.json({ ok: true, data: sessionUser, token });
    } catch (error) {
      console.error('[auth/login]', error.message);
      return res.status(500).json({ ok: false, message: 'Login failed. Please try again.' });
    }
  });

  return router;
}
