/**
 * Admin RBAC permission catalog — shared by API and admin UI.
 */

export const RBAC_SUPER_ADMIN_SLUG = 'super_admin';

export const ADMIN_PERMISSIONS = [
  { key: 'dashboard.view', name: 'View dashboard', group: 'General' },
  { key: 'items.view', name: 'View products', group: 'Inventory' },
  { key: 'items.manage', name: 'Manage products', group: 'Inventory' },
  { key: 'branches.view', name: 'View branches', group: 'Inventory' },
  { key: 'branches.manage', name: 'Manage branches', group: 'Inventory' },
  { key: 'employees.view', name: 'View employees', group: 'Inventory' },
  { key: 'employees.manage', name: 'Manage employees', group: 'Inventory' },
  { key: 'users.view', name: 'View users', group: 'Users' },
  { key: 'users.manage', name: 'Manage users', group: 'Users' },
  { key: 'settings.manage', name: 'Manage system settings', group: 'System' },
  { key: 'rbac.manage', name: 'Manage roles & permissions', group: 'System' },
  { key: 'monitor.view', name: 'View servers & DB monitor', group: 'System' },
  { key: 'monitor.manage', name: 'Manage servers & DB monitor', group: 'System' },
  { key: 'presence.view', name: 'View PC presence', group: 'System' },
  { key: 'developer.view', name: 'View developer tools', group: 'Developer' },
  { key: 'developer.manage', name: 'Manage external API keys', group: 'Developer' },
];

export const ALL_PERMISSION_KEYS = ADMIN_PERMISSIONS.map((p) => p.key);

export const DEFAULT_ADMIN_ROLES = [
  {
    slug: RBAC_SUPER_ADMIN_SLUG,
    name: 'Super Admin',
    description: 'Full access to all admin features.',
    is_system: true,
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    slug: 'content_manager',
    name: 'Inventory Manager',
    description: 'Dashboard and product management.',
    is_system: true,
    permissions: ['dashboard.view', 'items.view', 'items.manage', 'branches.view', 'branches.manage', 'employees.view', 'employees.manage'],
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only access.',
    is_system: true,
    permissions: ALL_PERMISSION_KEYS.filter((k) => k.endsWith('.view') || k === 'dashboard.view'),
  },
];

export const NAV_PERMISSION_MAP = {
  dashboard: 'dashboard.view',
  items: 'items.view',
  'items-low-stock': 'items.view',
  'items-create': 'items.manage',
  categories: 'items.view',
  'categories-create': 'items.manage',
  brands: 'items.view',
  'brands-create': 'items.manage',
  intake: 'items.view',
  branches: 'branches.view',
  'branches-create': 'branches.manage',
  employees: 'employees.view',
  'employee-reminders': 'employees.view',
  'employees-create': 'employees.manage',
  users: 'users.view',
  settings: 'settings.manage',
  monitor: 'monitor.view',
  'monitor-create': 'monitor.manage',
  presence: 'presence.view',
  'access-control': 'rbac.manage',
  developer: 'developer.view',
  'developer-api': 'developer.manage',
};

export function permissionMatches(have = [], need = '') {
  const required = String(need || '').trim();
  if (!required) return true;
  const set = new Set((have || []).map((p) => String(p).trim()));
  if (set.has(RBAC_SUPER_ADMIN_SLUG)) return true;
  if (set.has('*')) return true;
  return set.has(required);
}

export function hasAnyPermission(have = [], needs = []) {
  const list = Array.isArray(needs) ? needs : [needs];
  return list.some((n) => permissionMatches(have, n));
}
