#!/usr/bin/env node
/**
 * Pre-deploy checks for Coolify — GFL Inventory.
 *
 * Usage:
 *   node scripts/coolify-preflight.mjs
 *   node scripts/coolify-preflight.mjs --test-db
 */

import mysql from 'mysql2/promise';

const testDb = process.argv.includes('--test-db');

const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'AUTH_TOKEN_SECRET',
  'DEFAULT_ADMIN_EMAIL',
  'DEFAULT_ADMIN_PASSWORD',
  'APP_URL',
  'CORS_ORIGINS',
];

const RECOMMENDED = [
  'TRUST_PROXY',
];

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  errors += 1;
}

function warn(msg) {
  console.warn(`  WARN  ${msg}`);
  warnings += 1;
}

function ok(msg) {
  console.log(`  OK    ${msg}`);
}

console.log('Coolify preflight — GFL Inventory\n');

if (process.env.DATABASE_URL) {
  ok('DATABASE_URL is set (overrides DB_* at runtime)');
}

console.log('Required environment variables:');
for (const key of REQUIRED) {
  if (key.startsWith('DB_') && process.env.DATABASE_URL) {
    ok(`${key} optional when DATABASE_URL is set`);
    continue;
  }
  const val = String(process.env[key] || '').trim();
  if (!val) {
    fail(`${key} is not set`);
    continue;
  }
  if (key === 'DB_NAME' && val === 'gfl_inventory' && process.env.NODE_ENV === 'production') {
    warn(`${key}=${val} — Coolify MySQL often uses "default" unless you created a custom database`);
  }
  if (key === 'DEFAULT_ADMIN_PASSWORD' && val === 'admin123') {
    fail(`${key} must not be the default "admin123" in production`);
    continue;
  }
  if (key === 'AUTH_TOKEN_SECRET' && val === 'dev-only-auth-secret') {
    fail(`${key} must be a strong random value in production`);
    continue;
  }
  ok(`${key} is set`);
}

console.log('\nRecommended environment variables:');
for (const key of RECOMMENDED) {
  const val = String(process.env[key] || '').trim();
  if (!val) {
    warn(`${key} is not set`);
    continue;
  }
  ok(`${key}=${val}`);
}

const appUrl = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((v) => v.trim().replace(/\/$/, ''))
  .filter(Boolean);
console.log('\nURL alignment:');
if (appUrl && corsOrigins.length && !corsOrigins.includes(appUrl)) {
  warn(`APP_URL (${appUrl}) is not listed in CORS_ORIGINS (${corsOrigins.join(', ')})`);
} else if (appUrl && corsOrigins.length) {
  ok('APP_URL matches CORS_ORIGINS');
}

const dbHost = String(process.env.DB_HOST || '').trim();
if (/^\d{1,3}(\.\d{1,3}){3}$/.test(dbHost)) {
  warn(`DB_HOST is a public IP (${dbHost}) — use Coolify internal MySQL hostname from inside Docker`);
}

if (testDb) {
  console.log('\nMySQL connectivity:');
  let conn;
  try {
    if (process.env.DATABASE_URL) {
      conn = await mysql.createConnection(process.env.DATABASE_URL);
    } else if (!process.env.DB_HOST || !process.env.DB_PASSWORD) {
      fail('Cannot test DB — set DATABASE_URL or DB_HOST + DB_PASSWORD');
      conn = null;
    } else {
      conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'mysql',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'default',
        connectTimeout: 10000,
      });
    }
    if (conn) {
      const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db, NOW() AS now');
      ok(`Connected — MySQL ${rows[0].version}, database "${rows[0].db}"`);
      const [[tables]] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()',
      );
      ok(`Schema has ${tables.n} table(s)`);
    }
  } catch (err) {
    fail(`MySQL connection failed: ${err.message}`);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
} else {
  console.log('\nTip: run with --test-db to verify MySQL connectivity');
}

console.log('');
if (errors > 0) {
  console.error(`Preflight failed — ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}
console.log(`Preflight passed — ${warnings} warning(s)`);
process.exit(0);
