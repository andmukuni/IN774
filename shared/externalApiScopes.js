export const EXTERNAL_API_SCOPES = [
  {
    key: 'assets.read',
    name: 'Read assets',
    description: 'List and view inventory assets (products/equipment).',
  },
  {
    key: 'employees.read',
    name: 'Read employees',
    description: 'List and view employees and assets assigned to them.',
  },
  {
    key: 'assignments.read',
    name: 'Read assignments',
    description: 'View asset-to-employee assignment links.',
  },
  {
    key: 'presence.report',
    name: 'Report PC presence',
    description: 'Send heartbeat POSTs from Windows agents to report machine online status.',
  },
];

export const EXTERNAL_API_SCOPE_KEYS = EXTERNAL_API_SCOPES.map((s) => s.key);

export function hasExternalScope(scopes = [], required = '') {
  const set = new Set((scopes || []).map((s) => String(s).trim()).filter(Boolean));
  if (set.has('*')) return true;
  return set.has(String(required || '').trim());
}
