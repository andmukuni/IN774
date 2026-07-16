#!/usr/bin/env node
/**
 * Seed catalog/reference data on a remote MySQL database.
 * Skips employees and products — fresh start for staff intake and inventory.
 *
 * Usage:
 *   TARGET_DATABASE_URL="mysql://user:pass@host:port/db" npm run seed:remote
 *
 * Optional: set DEFAULT_ADMIN_* in env before running to control first admin user.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const targetUrl = String(process.env.TARGET_DATABASE_URL || '').trim();
if (!targetUrl) {
  console.error('TARGET_DATABASE_URL is required.');
  console.error('Example: TARGET_DATABASE_URL="mysql://user:pass@host:3306/default" npm run seed:remote');
  process.exit(1);
}

// Point the app pool at the remote database for this process only.
process.env.DATABASE_URL = targetUrl;
delete process.env.DB_HOST;
delete process.env.DB_PORT;
delete process.env.DB_USER;
delete process.env.DB_PASSWORD;
delete process.env.DB_NAME;

// Allow default admin seed unless explicitly production with weak password guard.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const { bootstrapCatalogOnly } = await import('../server/schema.js');
const { testConnection } = await import('../server/db.js');
const pool = (await import('../server/db.js')).default;

console.log('Seeding remote catalog (branches, brands, product types, RBAC, settings)...');
console.log('Skipping: employees, products, product_events\n');

try {
  await bootstrapCatalogOnly();
  const info = await testConnection();
  const [[branches]] = await pool.query('SELECT COUNT(*) AS n FROM branches');
  const [[brands]] = await pool.query('SELECT COUNT(*) AS n FROM brands');
  const [[types]] = await pool.query('SELECT COUNT(*) AS n FROM product_types');
  const [[users]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  const [[employees]] = await pool.query('SELECT COUNT(*) AS n FROM employees');
  const [[products]] = await pool.query('SELECT COUNT(*) AS n FROM products');

  console.log('\nRemote seed complete.');
  console.log(`  Database: ${info.db}`);
  console.log(`  Branches: ${branches.n}`);
  console.log(`  Brands: ${brands.n}`);
  console.log(`  Product types: ${types.n}`);
  console.log(`  Users: ${users.n}`);
  console.log(`  Employees: ${employees.n} (intentionally empty)`);
  console.log(`  Products: ${products.n} (intentionally empty)`);
} catch (err) {
  console.error('\nRemote seed failed:', err.message);
  process.exit(1);
} finally {
  await pool.end?.().catch(() => {});
}

process.exit(0);
