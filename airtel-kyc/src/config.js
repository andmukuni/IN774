import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BASE_URLS = {
  staging: 'https://openapiuat.airtel.co.zm',
  production: 'https://openapi.airtel.co.zm',
};

let envLoaded = false;

export function loadEnvFile() {
  if (envLoaded) return;
  envLoaded = true;
  const path = resolve(rootDir, '.env');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function getConfig() {
  loadEnvFile();
  const environment = String(process.env.AIRTEL_ENV || 'staging').trim().toLowerCase();
  const known = BASE_URLS[environment];
  const baseUrl = String(process.env.AIRTEL_BASE_URL || known || BASE_URLS.staging).replace(/\/+$/, '');
  const msisdnFormat = String(process.env.AIRTEL_MSISDN_FORMAT || 'national').trim().toLowerCase();
  const timeoutMs = Number(process.env.AIRTEL_TIMEOUT_MS || 15000);
  return {
    environment: known || process.env.AIRTEL_BASE_URL ? environment : 'staging',
    baseUrl,
    tokenPath: process.env.AIRTEL_TOKEN_PATH || '/auth/oauth2/token',
    userPath: process.env.AIRTEL_USER_PATH || '/standard/v1/users',
    clientId: process.env.AIRTEL_CLIENT_ID || '',
    clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
    grantType: process.env.AIRTEL_GRANT_TYPE || 'client_credentials',
    country: process.env.AIRTEL_COUNTRY || 'ZM',
    currency: process.env.AIRTEL_CURRENCY || 'ZMW',
    accept: process.env.AIRTEL_ACCEPT || '*/*',
    msisdnFormat: ['national', 'local', 'international'].includes(msisdnFormat) ? msisdnFormat : 'national',
    mock: bool(process.env.AIRTEL_MOCK),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
    accessKey: process.env.ACCESS_KEY || '',
    port: Number(process.env.PORT || 8787),
    host: process.env.HOST || '0.0.0.0',
    cookieSecure: bool(process.env.COOKIE_SECURE),
    trustProxy: bool(process.env.TRUST_PROXY),
    dataFile: process.env.DATA_FILE || resolve(rootDir, 'data', 'verifications.json'),
  };
}

export function publicStatus(config = getConfig()) {
  return {
    environment: config.environment,
    baseUrl: config.baseUrl,
    country: config.country,
    currency: config.currency,
    msisdnFormat: config.msisdnFormat,
    credentialsConfigured: Boolean(config.clientId && config.clientSecret),
    mock: config.mock,
    authRequired: Boolean(config.accessKey),
  };
}
