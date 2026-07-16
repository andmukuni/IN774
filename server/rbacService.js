import {
  ADMIN_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  DEFAULT_ADMIN_ROLES,
  RBAC_SUPER_ADMIN_SLUG,
  permissionMatches,
} from '../shared/rbacPermissions.js';

export {
  ADMIN_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  RBAC_SUPER_ADMIN_SLUG,
  permissionMatches,
};

export async function ensureRbacTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_permissions (
      id VARCHAR(90) PRIMARY KEY,
      perm_key VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      perm_group VARCHAR(60) DEFAULT 'General',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id VARCHAR(90) PRIMARY KEY,
      slug VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      is_system TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_role_permissions (
      role_id VARCHAR(90) NOT NULL,
      permission_key VARCHAR(80) NOT NULL,
      PRIMARY KEY (role_id, permission_key),
      INDEX idx_admin_role_permissions_perm (permission_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_admin_roles (
      user_id VARCHAR(90) NOT NULL,
      role_id VARCHAR(90) NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id),
      INDEX idx_user_admin_roles_role (role_id)
    )
  `);
}

function generateRbacId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function seedRbac(pool) {
  await ensureRbacTables(pool);

  for (const perm of ADMIN_PERMISSIONS) {
    await pool.query(
      `INSERT INTO admin_permissions (id, perm_key, name, perm_group, description)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), perm_group = VALUES(perm_group)`,
      [generateRbacId('perm'), perm.key, perm.name, perm.group || 'General', perm.description || ''],
    );
  }

  for (const roleDef of DEFAULT_ADMIN_ROLES) {
    const roleId = generateRbacId('role');
    await pool.query(
      `INSERT INTO admin_roles (id, slug, name, description, is_system)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_system = VALUES(is_system)`,
      [roleId, roleDef.slug, roleDef.name, roleDef.description || '', roleDef.is_system ? 1 : 0],
    );

    const [[roleRow]] = await pool.query('SELECT id FROM admin_roles WHERE slug = ? LIMIT 1', [roleDef.slug]);
    if (!roleRow?.id) continue;

    for (const permKey of roleDef.permissions) {
      await pool.query(
        'INSERT IGNORE INTO admin_role_permissions (role_id, permission_key) VALUES (?, ?)',
        [roleRow.id, permKey],
      );
    }
  }

  const [[superRole]] = await pool.query(
    'SELECT id FROM admin_roles WHERE slug = ? LIMIT 1',
    [RBAC_SUPER_ADMIN_SLUG],
  );
  if (superRole?.id) {
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await pool.query(
        'INSERT IGNORE INTO user_admin_roles (user_id, role_id) VALUES (?, ?)',
        [admin.id, superRole.id],
      );
    }
  }

  return { ok: true };
}

export async function loadUserAdminPermissions(pool, userId, { legacyRole = '' } = {}) {
  const uid = String(userId || '').trim();
  if (!uid) return [];

  const [rows] = await pool.query(
    `SELECT DISTINCT arp.permission_key
     FROM user_admin_roles uar
     INNER JOIN admin_role_permissions arp ON arp.role_id = uar.role_id
     WHERE uar.user_id = ?`,
    [uid],
  );

  const keys = rows.map((r) => String(r.permission_key || '').trim()).filter(Boolean);

  if (keys.length === 0 && String(legacyRole || '').toLowerCase() === 'admin') {
    return [...ALL_PERMISSION_KEYS];
  }

  return keys;
}

export function userCanAccessAdmin(legacyRole, permissions = []) {
  if (String(legacyRole || '').toLowerCase() === 'admin') return true;
  return Array.isArray(permissions) && permissions.length > 0;
}

export function resolveRouteAdminPermission(req) {
  const path = String(req.path || '');
  const method = String(req.method || '').toUpperCase();

  if (path.startsWith('/api/admin/rbac')) return 'rbac.manage';
  if (path.startsWith('/api/admin/settings')) return 'settings.manage';
  if (path.startsWith('/api/settings')) return 'settings.manage';
  if (path.startsWith('/api/admin/users')) return method === 'GET' ? 'users.view' : 'users.manage';
  if (path.startsWith('/api/admin/items')) return method === 'GET' ? 'items.view' : 'items.manage';
  if (path.startsWith('/api/admin/branches')) return method === 'GET' ? 'branches.view' : 'branches.manage';
  if (path.startsWith('/api/admin/brands')) return 'items.view';
  if (path.startsWith('/api/admin/product-types')) return method === 'GET' ? 'items.view' : 'items.manage';
  if (path.startsWith('/api/admin/employees')) return method === 'GET' ? 'employees.view' : 'employees.manage';
  if (path === '/api/admin/dashboard/stats') return 'dashboard.view';

  return 'dashboard.view';
}
