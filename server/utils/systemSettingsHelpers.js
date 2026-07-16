import pool, { testConnection } from '../db.js';

export const SETTING_KEYS = {
  COMPANY_NAME: 'company_name',
  SUPPORT_EMAIL: 'support_email',
  SUPPORT_PHONE: 'support_phone',
  INTAKE_ENABLED: 'intake_enabled',
  INTAKE_INTRO_TEXT: 'intake_intro_text',
};

const DEFAULT_SETTINGS = {
  [SETTING_KEYS.COMPANY_NAME]: String(process.env.VITE_COMPANY_NAME || 'Goodfellow Inventory').trim(),
  [SETTING_KEYS.SUPPORT_EMAIL]: '',
  [SETTING_KEYS.SUPPORT_PHONE]: '',
  [SETTING_KEYS.INTAKE_ENABLED]: 'true',
  [SETTING_KEYS.INTAKE_INTRO_TEXT]:
    'Select your branch to report computers and printers in use at your location.',
};

const EDITABLE_KEYS = Object.values(SETTING_KEYS);

export async function ensureSystemSettingsTable(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(60) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function seedSystemSettings(db = pool) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, String(value)],
    );
  }
}

function parseBool(value, fallback = true) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function mapSettingsRow(rows = []) {
  const map = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    companyName: map[SETTING_KEYS.COMPANY_NAME] || DEFAULT_SETTINGS[SETTING_KEYS.COMPANY_NAME],
    supportEmail: map[SETTING_KEYS.SUPPORT_EMAIL] || '',
    supportPhone: map[SETTING_KEYS.SUPPORT_PHONE] || '',
    intakeEnabled: parseBool(map[SETTING_KEYS.INTAKE_ENABLED], true),
    intakeIntroText: map[SETTING_KEYS.INTAKE_INTRO_TEXT] || DEFAULT_SETTINGS[SETTING_KEYS.INTAKE_INTRO_TEXT],
  };
}

export async function getAllSettings(db = pool) {
  const [rows] = await db.query(
    'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?)',
    [EDITABLE_KEYS],
  );
  return mapSettingsRow(rows);
}

export async function getPublicSettings(db = pool) {
  const settings = await getAllSettings(db);
  return {
    companyName: settings.companyName,
    intakeEnabled: settings.intakeEnabled,
    intakeIntroText: settings.intakeIntroText,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
  };
}

export async function updateSettings(patch = {}, db = pool) {
  const allowed = {
    companyName: SETTING_KEYS.COMPANY_NAME,
    supportEmail: SETTING_KEYS.SUPPORT_EMAIL,
    supportPhone: SETTING_KEYS.SUPPORT_PHONE,
    intakeEnabled: SETTING_KEYS.INTAKE_ENABLED,
    intakeIntroText: SETTING_KEYS.INTAKE_INTRO_TEXT,
  };

  for (const [field, key] of Object.entries(allowed)) {
    if (!(field in patch)) continue;
    let value = patch[field];
    if (field === 'intakeEnabled') value = value ? 'true' : 'false';
    await db.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, String(value ?? '').trim()],
    );
  }

  return getAllSettings(db);
}

async function fetchInventoryStats(db = pool) {
  const [[totals]] = await db.query(`
    SELECT
      COUNT(*) AS totalProducts,
      COALESCE(SUM(quantity), 0) AS totalUnits,
      COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS inventoryValue,
      COUNT(DISTINCT category) AS categoryCount
    FROM products
    WHERE status != 'discontinued'
  `);

  const [[stockCounts]] = await db.query(`
    SELECT
      SUM(CASE WHEN quantity = 0 AND status != 'discontinued' THEN 1 ELSE 0 END) AS outOfStockCount,
      SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level AND status != 'discontinued' THEN 1 ELSE 0 END) AS lowStockCount
    FROM products
  `);

  return {
    totalProducts: Number(totals?.totalProducts || 0),
    totalUnits: Number(totals?.totalUnits || 0),
    inventoryValue: Number(totals?.inventoryValue || 0),
    categoryCount: Number(totals?.categoryCount || 0),
    lowStockCount: Number(stockCounts?.lowStockCount || 0),
    outOfStockCount: Number(stockCounts?.outOfStockCount || 0),
  };
}

async function fetchEntityCounts(db = pool) {
  const [[branches]] = await db.query("SELECT COUNT(*) AS count FROM branches WHERE status = 'active'");
  const [[employees]] = await db.query("SELECT COUNT(*) AS count FROM employees WHERE status = 'active'");
  const [[products]] = await db.query("SELECT COUNT(*) AS count FROM products");
  const [[brands]] = await db.query("SELECT COUNT(*) AS count FROM brands WHERE status = 'active'");
  const [[productTypes]] = await db.query("SELECT COUNT(*) AS count FROM product_types WHERE status = 'active'");
  const [[users]] = await db.query('SELECT COUNT(*) AS count FROM users');

  return {
    branches: Number(branches?.count || 0),
    employees: Number(employees?.count || 0),
    products: Number(products?.count || 0),
    brands: Number(brands?.count || 0),
    productTypes: Number(productTypes?.count || 0),
    users: Number(users?.count || 0),
  };
}

export function buildSystemArchitecture(counts = {}) {
  return {
    nodes: [
      { id: 'intake', label: 'Branch intake', subtitle: 'Public form /intake' },
      { id: 'api', label: 'Node API', subtitle: 'Express REST' },
      { id: 'db', label: 'MySQL', subtitle: 'Inventory database' },
      { id: 'branches', label: 'Branches', subtitle: `${counts.branches ?? 0} locations` },
      { id: 'employees', label: 'Employees', subtitle: `${counts.employees ?? 0} staff` },
      { id: 'products', label: 'Products', subtitle: `${counts.products ?? 0} items` },
    ],
    connections: [
      { from: 'intake', to: 'api', label: 'POST' },
      { from: 'api', to: 'db', label: 'SQL' },
      { from: 'branches', to: 'employees', label: 'Staff' },
      { from: 'employees', to: 'products', label: 'Assigned' },
      { from: 'branches', to: 'products', label: 'Printers' },
    ],
  };
}

export async function fetchSystemOverview({ appUrl = '' } = {}) {
  let dbOk = false;
  try {
    await testConnection();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const corsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const [settings, counts, inventory] = await Promise.all([
    getAllSettings(),
    fetchEntityCounts(),
    fetchInventoryStats(),
  ]);

  return {
    health: {
      apiOk: true,
      dbOk,
      version: String(process.env.npm_package_version || '1.0.0'),
    },
    architecture: buildSystemArchitecture(counts),
    counts,
    inventory,
    settings,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      dbName: process.env.DB_NAME || 'gfl_inventory',
      appUrl: appUrl || String(process.env.APP_URL || '').trim() || '',
      corsOriginCount: corsOrigins.length,
    },
  };
}
