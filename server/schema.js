import crypto from 'crypto';
import { ensureDatabase } from './db.js';
import pool from './db.js';
import { hashPassword } from './auth.js';
import { ensureRbacTables, seedRbac } from './rbacService.js';
import { computeProductStatus } from './utils/inventoryHelpers.js';
import { ensureProductEventsTable, backfillProductEvents } from './utils/productEventHelpers.js';
import { ensureSystemSettingsTable, seedSystemSettings } from './utils/systemSettingsHelpers.js';
import { ensureApiKeysTable } from './utils/apiKeyHelpers.js';
import { ensureApiKeysTable } from './utils/apiKeyHelpers.js';
import { GOODFELLOW_BRANCHES } from './seed/goodfellowBranches.js';
import { COMPUTER_BRANDS } from './seed/computerBrands.js';
import { PRODUCT_TYPES } from './seed/productTypes.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SEED_PRODUCTS = [
  { sku: 'GFL-001', name: 'Industrial Bolt Kit', category: 'Hardware', quantity: 240, reorder_level: 50, unit_price: 12.50, employee_code: 'EMP-001' },
  { sku: 'GFL-002', name: 'Safety Gloves (Box)', category: 'Consumables', quantity: 18, reorder_level: 25, unit_price: 8.99, employee_code: 'EMP-002' },
  { sku: 'GFL-003', name: 'Hydraulic Fluid 5L', category: 'Consumables', quantity: 64, reorder_level: 20, unit_price: 24.00, employee_code: 'EMP-003' },
  { sku: 'GFL-004', name: 'Steel Shelving Unit', category: 'Hardware', quantity: 0, reorder_level: 5, unit_price: 189.00, employee_code: 'EMP-001' },
  { sku: 'GFL-005', name: 'Barcode Scanner', category: 'Equipment', quantity: 12, reorder_level: 4, unit_price: 145.00, employee_code: 'EMP-004' },
  { sku: 'GFL-006', name: 'Pallet Wrap Roll', category: 'Consumables', quantity: 95, reorder_level: 30, unit_price: 6.75, employee_code: 'EMP-005' },
  { sku: 'GFL-007', name: 'Forklift Battery', category: 'Equipment', quantity: 3, reorder_level: 2, unit_price: 890.00, employee_code: 'EMP-006' },
  { sku: 'GFL-008', name: 'LED Warehouse Light', category: 'Hardware', quantity: 0, reorder_level: 10, unit_price: 42.50, employee_code: 'EMP-007' },
  { sku: 'GFL-009', name: 'Inventory Labels (1000)', category: 'Consumables', quantity: 42, reorder_level: 15, unit_price: 11.25, employee_code: 'EMP-008' },
  { sku: 'GFL-010', name: 'Legacy Scanner v1', category: 'Equipment', quantity: 2, reorder_level: 0, unit_price: 75.00, status: 'discontinued', employee_code: 'EMP-004' },
];

async function ensureColumn(table, column, definition) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!cols.length) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(90) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(60),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(30) DEFAULT 'user',
      email_verified TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(90) PRIMARY KEY,
      sku VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'General',
      quantity INT NOT NULL DEFAULT 0,
      reorder_level INT NOT NULL DEFAULT 0,
      unit_price DECIMAL(10,2) NULL DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'in_stock',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id VARCHAR(90) PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      city VARCHAR(100) NOT NULL DEFAULT '',
      address VARCHAR(500) NOT NULL DEFAULT '',
      phone VARCHAR(60) NOT NULL DEFAULT '',
      manager_name VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(90) PRIMARY KEY,
      employee_code VARCHAR(30) NOT NULL UNIQUE,
      first_name VARCHAR(120) NOT NULL,
      last_name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(60) NOT NULL DEFAULT '',
      job_title VARCHAR(120) NOT NULL DEFAULT '',
      branch_id VARCHAR(90) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_employees_branch (branch_id),
      INDEX idx_employees_status (status)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id VARCHAR(90) PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_types (
      id VARCHAR(90) PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('products', 'employee_id', 'employee_id VARCHAR(90) NULL AFTER status');
  await ensureColumn('products', 'brand_id', 'brand_id VARCHAR(90) NULL AFTER category');
  await ensureColumn('products', 'branch_id', 'branch_id VARCHAR(90) NULL AFTER employee_id');
  await ensureNullableUnitPrice();

  await ensureProductEventsTable(pool);

  await ensureSystemSettingsTable(pool);

  await ensureRbacTables(pool);
  await ensureApiKeysTable();
}

async function ensureNullableUnitPrice() {
  const [cols] = await pool.query(`SHOW COLUMNS FROM products LIKE 'unit_price'`);
  if (cols.length && cols[0].Null === 'NO') {
    await pool.query('ALTER TABLE products MODIFY COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL');
  }
}

export async function seedDefaultAdmin() {
  const ADMIN_EMAIL = String(process.env.DEFAULT_ADMIN_EMAIL || 'admin@template.dev').trim().toLowerCase();
  const ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123').trim();
  const ADMIN_NAME = String(process.env.DEFAULT_ADMIN_NAME || 'GFL Admin').trim();

  const [[existing]] = await pool.query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
  if (existing) {
    console.log('[auth] Admin user already exists, skipping seed.');
    return;
  }

  if (IS_PRODUCTION && (!process.env.DEFAULT_ADMIN_EMAIL || !process.env.DEFAULT_ADMIN_PASSWORD || ADMIN_PASSWORD === 'admin123')) {
    throw new Error('DEFAULT_ADMIN_EMAIL and a non-default DEFAULT_ADMIN_PASSWORD are required before seeding the first production admin.');
  }

  const id = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const passwordHash = hashPassword(ADMIN_PASSWORD);

  await pool.query(
    `INSERT INTO users (id, name, email, phone, password_hash, role, email_verified)
     VALUES (?, ?, ?, '', ?, 'admin', 1)`,
    [id, ADMIN_NAME, ADMIN_EMAIL, passwordHash],
  );
  console.log(`[auth] Default admin user seeded: ${ADMIN_EMAIL}`);
}

export async function seedInventoryProducts() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM products');
  const isFresh = Number(row?.count || 0) === 0;

  const [employees] = await pool.query('SELECT id, employee_code FROM employees');
  const employeeByCode = new Map(employees.map((e) => [e.employee_code, e.id]));

  if (isFresh) {
    for (const product of SEED_PRODUCTS) {
      const id = `prd-${crypto.randomBytes(4).toString('hex')}`;
      const status = product.status || computeProductStatus(product.quantity, product.reorder_level);
      const employeeId = product.employee_code ? employeeByCode.get(product.employee_code) || null : null;
      await pool.query(
        `INSERT INTO products (id, sku, name, category, quantity, reorder_level, unit_price, status, employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, product.sku, product.name, product.category, product.quantity, product.reorder_level, product.unit_price, status, employeeId],
      );
    }
    console.log(`[inventory] Seeded ${SEED_PRODUCTS.length} products.`);
    return;
  }

  console.log('[inventory] Products already seeded, linking employees where missing.');
  for (const product of SEED_PRODUCTS) {
    if (!product.employee_code) continue;
    const employeeId = employeeByCode.get(product.employee_code);
    if (!employeeId) continue;
    await pool.query(
      'UPDATE products SET employee_id = ? WHERE sku = ? AND (employee_id IS NULL OR employee_id = \'\')',
      [employeeId, product.sku],
    );
  }
}

export async function seedBranches() {
  const canonicalCodes = new Set(GOODFELLOW_BRANCHES.map((b) => b.code));
  let inserted = 0;
  let updated = 0;

  for (const branch of GOODFELLOW_BRANCHES) {
    const [[existing]] = await pool.query('SELECT id FROM branches WHERE code = ? LIMIT 1', [branch.code]);
    if (existing) {
      await pool.query(
        `UPDATE branches
         SET name = ?, city = ?, address = ?, phone = ?, manager_name = ?, status = ?
         WHERE code = ?`,
        [branch.name, branch.city, branch.address, branch.phone, branch.manager_name, branch.status, branch.code],
      );
      updated += 1;
    } else {
      const id = `brn-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO branches (id, code, name, city, address, phone, manager_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, branch.code, branch.name, branch.city, branch.address, branch.phone, branch.manager_name, branch.status],
      );
      inserted += 1;
    }
  }

  const [staleRows] = await pool.query(
    `SELECT b.id, b.code
     FROM branches b
     LEFT JOIN employees e ON e.branch_id = b.id
     WHERE e.id IS NULL`,
  );
  let removed = 0;
  for (const row of staleRows) {
    if (canonicalCodes.has(row.code)) continue;
    await pool.query('DELETE FROM branches WHERE id = ?', [row.id]);
    removed += 1;
  }

  console.log(`[inventory] Branches synced from Goodfellow: ${inserted} inserted, ${updated} updated, ${removed} demo-only removed.`);
}

const SEED_EMPLOYEES = [
  { employee_code: 'EMP-001', first_name: 'Grace', last_name: 'Mwamba', email: 'grace.mwamba@gfl.local', phone: '+260 97 100 001', job_title: 'Warehouse Lead', branch_code: 'GFL-LUS-01' },
  { employee_code: 'EMP-002', first_name: 'Peter', last_name: 'Banda', email: 'peter.banda@gfl.local', phone: '+260 96 200 002', job_title: 'Inventory Clerk', branch_code: 'GFL-NDL-01' },
  { employee_code: 'EMP-003', first_name: 'Chanda', last_name: 'Lungu', email: 'chanda.lungu@gfl.local', phone: '+260 95 300 003', job_title: 'Stock Controller', branch_code: 'GFL-KIT-01' },
  { employee_code: 'EMP-004', first_name: 'Mercy', last_name: 'Zulu', email: 'mercy.zulu@gfl.local', phone: '+260 97 400 004', job_title: 'Equipment Officer', branch_code: 'GFL-LIV-01' },
  { employee_code: 'EMP-005', first_name: 'James', last_name: 'Phiri', email: 'james.phiri@gfl.local', phone: '+260 96 500 005', job_title: 'Receiving Clerk', branch_code: 'GFL-KAB-01' },
  { employee_code: 'EMP-006', first_name: 'Ruth', last_name: 'Mbewe', email: 'ruth.mbewe@gfl.local', phone: '+260 95 600 006', job_title: 'Branch Assistant', branch_code: 'GFL-SOL-01' },
  { employee_code: 'EMP-007', first_name: 'David', last_name: 'Muleya', email: 'david.muleya@gfl.local', phone: '+260 97 700 007', job_title: 'Depot Supervisor', branch_code: 'GFL-SOL-01' },
  { employee_code: 'EMP-008', first_name: 'Naomi', last_name: 'Sakala', email: 'naomi.sakala@gfl.local', phone: '+260 96 800 008', job_title: 'Labels Coordinator', branch_code: 'GFL-LUS-01' },
];

export async function seedEmployees() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM employees');
  if (Number(row?.count || 0) > 0) {
    console.log('[inventory] Employees already seeded, skipping.');
    return;
  }

  const [branches] = await pool.query('SELECT id, code FROM branches');
  const branchByCode = new Map(branches.map((b) => [b.code, b.id]));

  for (const emp of SEED_EMPLOYEES) {
    const branchId = branchByCode.get(emp.branch_code);
    if (!branchId) continue;
    const id = `emp-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO employees (id, employee_code, first_name, last_name, email, phone, job_title, branch_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, emp.employee_code, emp.first_name, emp.last_name, emp.email, emp.phone, emp.job_title, branchId],
    );
  }
  console.log(`[inventory] Seeded ${SEED_EMPLOYEES.length} employees.`);
}

export async function seedBrands() {
  let inserted = 0;
  let updated = 0;

  for (const brand of COMPUTER_BRANDS) {
    const [[existing]] = await pool.query('SELECT id FROM brands WHERE code = ? LIMIT 1', [brand.code]);
    if (existing) {
      await pool.query(
        'UPDATE brands SET name = ?, status = ? WHERE code = ?',
        [brand.name, 'active', brand.code],
      );
      updated += 1;
    } else {
      const id = `brd-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        'INSERT INTO brands (id, code, name, status) VALUES (?, ?, ?, ?)',
        [id, brand.code, brand.name, 'active'],
      );
      inserted += 1;
    }
  }

  console.log(`[inventory] Brands synced: ${inserted} inserted, ${updated} updated.`);
}

export async function seedProductTypes() {
  let inserted = 0;
  let updated = 0;

  for (const type of PRODUCT_TYPES) {
    const [[existing]] = await pool.query('SELECT id FROM product_types WHERE code = ? LIMIT 1', [type.code]);
    if (existing) {
      await pool.query(
        'UPDATE product_types SET name = ?, description = ?, status = ? WHERE code = ?',
        [type.name, type.description, 'active', type.code],
      );
      updated += 1;
    } else {
      const id = `typ-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        'INSERT INTO product_types (id, code, name, description, status) VALUES (?, ?, ?, ?, ?)',
        [id, type.code, type.name, type.description, 'active'],
      );
      inserted += 1;
    }
  }

  console.log(`[inventory] Product types synced: ${inserted} inserted, ${updated} updated.`);
}

export async function bootstrapCatalogOnly() {
  await ensureDatabase();
  await ensureSchema();
  await seedDefaultAdmin();
  await seedRbac(pool);
  await seedBranches();
  await seedBrands();
  await seedProductTypes();
  await seedSystemSettings(pool);
}

export async function bootstrapDatabase() {
  await ensureDatabase();
  await ensureSchema();
  await seedDefaultAdmin();
  await seedRbac(pool);
  await seedBranches();
  await seedBrands();
  await seedProductTypes();
  await seedEmployees();
  await seedInventoryProducts();
  await backfillProductEvents(pool);
  await seedSystemSettings(pool);
}
