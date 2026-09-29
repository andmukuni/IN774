#!/usr/bin/env node
import { enquireUser } from './airtel.js';
import { getConfig } from './config.js';

const msisdn = process.argv.slice(2).join(' ').trim();
if (!msisdn) {
  console.error('Usage: npm run check -- 0971234567');
  process.exit(1);
}

try {
  const config = getConfig();
  const result = await enquireUser(msisdn, { config });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === 'error' ? 2 : 0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
