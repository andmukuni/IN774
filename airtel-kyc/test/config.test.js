import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfig } from '../src/config.js';

test('selects the Zambia staging and production hosts', () => {
  const previousEnv = process.env.AIRTEL_ENV;
  const previousUrl = process.env.AIRTEL_BASE_URL;
  delete process.env.AIRTEL_BASE_URL;
  try {
    process.env.AIRTEL_ENV = 'staging';
    assert.equal(getConfig().baseUrl, 'https://openapiuat.airtel.co.zm');
    process.env.AIRTEL_ENV = 'production';
    assert.equal(getConfig().baseUrl, 'https://openapi.airtel.co.zm');
    assert.equal(getConfig().country, process.env.AIRTEL_COUNTRY || 'ZM');
    assert.equal(getConfig().currency, process.env.AIRTEL_CURRENCY || 'ZMW');
  } finally {
    if (previousEnv === undefined) delete process.env.AIRTEL_ENV;
    else process.env.AIRTEL_ENV = previousEnv;
    if (previousUrl === undefined) delete process.env.AIRTEL_BASE_URL;
    else process.env.AIRTEL_BASE_URL = previousUrl;
  }
});
