#!/usr/bin/env node
/**
 * Create (or reuse) an API key for the GFL Presence Windows agent.
 *
 * Usage:
 *   npm run seed:presence-key
 *
 * Prints the raw key once — store it in agent config.json on each PC.
 * Heartbeat key uses 0.0.0.0/0 so office PCs with dynamic IPs can report in.
 * Create a separate presence.enroll key with office CIDRs for the installer.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const KEY_NAME = 'GFL Presence Agent';

const { ensureApiKeysTable, createApiKey, listApiKeys } = await import('../server/utils/apiKeyHelpers.js');

await ensureApiKeysTable();

const REQUIRED_SCOPES = ['presence.report'];

const existing = (await listApiKeys()).find(
  (key) => (
    key.name === KEY_NAME
    && key.status === 'active'
    && REQUIRED_SCOPES.every((scope) => key.scopes.includes(scope))
  ),
);

if (existing) {
  console.log('An active presence API key already exists:');
  console.log(`  Name:   ${existing.name}`);
  console.log(`  Prefix: ${existing.keyPrefix}…`);
  console.log(`  Scopes: ${existing.scopes.join(', ')}`);
  console.log('\nCreate a new key in Admin → Developer if you need a fresh secret.');
  process.exit(0);
}

const data = await createApiKey({
  name: KEY_NAME,
  scopes: REQUIRED_SCOPES,
  ipWhitelist: ['*'],
  createdBy: 'seed-presence-key',
});

console.log('Created GFL Presence API key:\n');
console.log(`  Name:   ${data.name}`);
console.log(`  Scopes: ${data.scopes.join(', ')}`);
console.log(`  Key:    ${data.apiKey}`);
console.log('\nThis key is heartbeat-only (presence.report). Create a separate');
console.log('presence.enroll key with office CIDRs in Admin → Developer for installers.');
console.log('\nAdd to agent config.json:');
console.log(JSON.stringify({
  apiUrl: 'https://your-formgfl-domain.com/api/v1/presence/heartbeat',
  apiKey: data.apiKey,
  intervalSeconds: 300,
}, null, 2));
