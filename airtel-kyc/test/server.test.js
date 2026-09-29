import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AIRTEL_MOCK = 'true';
process.env.AIRTEL_ENV = 'staging';
delete process.env.AIRTEL_BASE_URL;
delete process.env.ACCESS_KEY;
delete process.env.AIRTEL_CLIENT_ID;
delete process.env.AIRTEL_CLIENT_SECRET;

const { createServer } = await import('../src/server.js');

function dataFile() {
  return join(mkdtempSync(join(tmpdir(), 'airtel-kyc-')), 'verifications.json');
}

async function listen() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

test.describe('verifier http api', { concurrency: 1 }, () => {
  test('checks a number in mock mode and stores the result', async () => {
    process.env.DATA_FILE = dataFile();
    delete process.env.ACCESS_KEY;
    const { server, base } = await listen();
    try {
      assert.equal((await (await fetch(`${base}/api/health`)).json()).service, 'airtel-kyc');
      assert.match(await (await fetch(`${base}/`)).text(), /Check a mobile number/);

      const status = await (await fetch(`${base}/api/status`)).json();
      assert.equal(status.environment, 'staging');
      assert.equal(status.baseUrl, 'https://openapiuat.airtel.co.zm');
      assert.equal(status.country, 'ZM');
      assert.equal(status.currency, 'ZMW');
      assert.equal(status.mock, true);

      const verified = await (await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: '0971234567' }),
      })).json();
      assert.equal(verified.verdict, 'verified');
      assert.equal(verified.subscriber.fullName, 'Mutale Phiri');
      assert.equal(verified.queriedMsisdn, '971234567');
      assert.equal(verified.subscriber.isPinSet, true);
      assert.equal(verified.subscriber.isBarred, false);

      const barred = await (await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: '0971111111' }),
      })).json();
      assert.equal(barred.verdict, 'barred');

      const missing = await (await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: '0970000000' }),
      })).json();
      assert.equal(missing.verdict, 'not_verified');
      assert.equal(missing.summary, 'User not found.');

      const unregistered = await (await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: '0972222222' }),
      })).json();
      assert.equal(unregistered.verdict, 'not_registered');

      const invalid = await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: '123' }),
      });
      assert.equal(invalid.status, 400);

      const history = await (await fetch(`${base}/api/verifications`)).json();
      assert.equal(history.data.length, 4);
      assert.equal(history.data[0].verdict, 'not_registered');

      const connection = await (await fetch(`${base}/api/connection`, { method: 'POST' })).json();
      assert.deepEqual(connection, { ok: true, mock: true });
    } finally {
      await close(server);
    }
  });

  test('accepts a session cookie or an API key', async () => {
    process.env.DATA_FILE = dataFile();
    process.env.ACCESS_KEY = 'desk-key';
    const { server, base } = await listen();
    try {
      const denied = await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: '0971234567' }),
      });
      assert.equal(denied.status, 401);

      const login = await fetch(`${base}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: 'desk-key' }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
      const status = await fetch(`${base}/api/status`, { headers: { Cookie: cookie } });
      assert.equal(status.status, 200);

      const byKey = await fetch(`${base}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer desk-key',
        },
        body: JSON.stringify({ msisdn: '0771234567' }),
      });
      assert.equal(byKey.status, 200);
      assert.equal((await byKey.json()).input.isAirtelPrefix, true);
    } finally {
      delete process.env.ACCESS_KEY;
      await close(server);
    }
  });
});
