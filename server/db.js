import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

function configFromDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '') || undefined,
  };
}

const dbFromUrl = process.env.DATABASE_URL
  ? configFromDatabaseUrl(process.env.DATABASE_URL)
  : null;

export const DB_HOST = dbFromUrl?.host || process.env.DB_HOST || '127.0.0.1';
export const DB_PORT = Number(dbFromUrl?.port || process.env.DB_PORT || 3306);
export const DB_USER = dbFromUrl?.user || process.env.DB_USER || 'root';
export const DB_PASSWORD = dbFromUrl?.password ?? process.env.DB_PASSWORD ?? '';
export const DB_NAME = dbFromUrl?.database || process.env.DB_NAME || 'gfl_inventory';

let pool;

export async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
    });
  }
  return pool;
}

const poolProxy = new Proxy({}, {
  get(_target, prop) {
    const p = getPool();
    const value = p[prop];
    if (typeof value === 'function') return value.bind(p);
    return value;
  },
});

export async function testConnection() {
  const p = getPool();
  const [rows] = await p.query('SELECT DATABASE() AS db, NOW() AS connected_at');
  return rows[0];
}

export default poolProxy;
