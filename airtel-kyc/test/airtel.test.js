import assert from 'node:assert/strict';
import test from 'node:test';
import { clearTokenCache, enquireUser, KycError } from '../src/airtel.js';

const config = {
  baseUrl: 'https://openapiuat.airtel.co.zm',
  tokenPath: '/auth/oauth2/token',
  userPath: '/standard/v1/users',
  clientId: 'consumer-key',
  clientSecret: 'consumer-secret',
  grantType: 'client_credentials',
  country: 'ZM',
  currency: 'ZMW',
  accept: '*/*',
  msisdnFormat: 'national',
  timeoutMs: 5000,
  mock: false,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('requests an OAuth token and then the user enquiry', async () => {
  clearTokenCache();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/oauth2/token')) {
      return jsonResponse({ access_token: 'tok-1', expires_in: '180', token_type: 'bearer' });
    }
    return jsonResponse({
      data: {
        first_name: 'Mutale',
        last_name: 'Phiri',
        grade: 'GOLD',
        is_barred: false,
        is_pin_set: true,
        msisdn: '971234567',
        registration: { status: 'SUBS' },
      },
      status: { code: '200', message: 'SUCCESS', result_code: 'ESB000010', success: true },
    });
  };

  const result = await enquireUser('0971 234 567', {
    fetchImpl,
    config,
    tokenCache: { accessToken: null, expiresAt: 0 },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    client_id: 'consumer-key',
    client_secret: 'consumer-secret',
    grant_type: 'client_credentials',
  });
  assert.equal(calls[1].url, 'https://openapiuat.airtel.co.zm/standard/v1/users/971234567');
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[1].options.headers.Accept, '*/*');
  assert.equal(calls[1].options.headers['X-Country'], 'ZM');
  assert.equal(calls[1].options.headers['X-Currency'], 'ZMW');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer tok-1');
  assert.equal(result.verdict, 'verified');
  assert.equal(result.subscriber.fullName, 'Mutale Phiri');
  assert.equal(result.queriedMsisdn, '971234567');
});

test('reuses a cached token and refreshes it once after HTTP 401', async () => {
  const calls = [];
  let userCalls = 0;
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/auth/oauth2/token')) {
      return jsonResponse({ access_token: `tok-${calls.length}`, expires_in: 180 });
    }
    userCalls += 1;
    return jsonResponse({ status: { success: false, message: 'expired' } }, userCalls === 1 ? 401 : 200);
  };
  const tokenCache = { accessToken: 'stale', expiresAt: Date.now() + 60_000 };

  const result = await enquireUser('+260771234567', { fetchImpl, config, tokenCache });

  assert.deepEqual(calls, [
    'https://openapiuat.airtel.co.zm/standard/v1/users/771234567',
    'https://openapiuat.airtel.co.zm/auth/oauth2/token',
    'https://openapiuat.airtel.co.zm/standard/v1/users/771234567',
  ]);
  assert.equal(result.airtel.httpStatus, 200);
  assert.equal(tokenCache.accessToken, 'tok-2');
});

test('sends the international MSISDN when configured', async () => {
  let queried = '';
  const fetchImpl = async (url) => {
    queried = String(url);
    return jsonResponse({
      data: { first_name: 'A', last_name: 'B', msisdn: '260971234567', is_barred: false, registration: { status: 'SUBS' } },
      status: { success: true, message: 'SUCCESS', code: '200', result_code: 'OK' },
    });
  };
  await enquireUser('0971234567', {
    fetchImpl,
    config: { ...config, msisdnFormat: 'international' },
    tokenCache: { accessToken: 'ready', expiresAt: Date.now() + 60_000 },
  });
  assert.equal(queried, 'https://openapiuat.airtel.co.zm/standard/v1/users/260971234567');
});

test('refuses to call Airtel without credentials', async () => {
  await assert.rejects(
    () => enquireUser('0971234567', { config: { ...config, clientId: '', clientSecret: '' } }),
    (error) => error instanceof KycError && error.code === 'NOT_CONFIGURED',
  );
});

test('rejects an invalid number before any request', async () => {
  let called = false;
  await assert.rejects(
    () => enquireUser('123', {
      fetchImpl: async () => {
        called = true;
        return jsonResponse({});
      },
      config,
    }),
    (error) => error instanceof KycError && error.code === 'INVALID_MSISDN',
  );
  assert.equal(called, false);
});
