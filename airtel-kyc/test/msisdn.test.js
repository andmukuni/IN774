import assert from 'node:assert/strict';
import test from 'node:test';
import { parseZambiaMsisdn, formatForAirtel } from '../src/msisdn.js';

test('normalizes Zambian numbers to the national form', () => {
  const samples = ['0971234567', '971234567', '+260971234567', '260 97 123 4567', '00260971234567'];
  for (const sample of samples) {
    const parsed = parseZambiaMsisdn(sample);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.national, '971234567');
    assert.equal(parsed.local, '0971234567');
    assert.equal(parsed.international, '260971234567');
    assert.equal(parsed.isAirtelPrefix, true);
  }
});

test('accepts the other Airtel Zambia prefixes and flags other networks', () => {
  assert.equal(parseZambiaMsisdn('0771234567').isAirtelPrefix, true);
  assert.equal(parseZambiaMsisdn('0571234567').isAirtelPrefix, true);
  const mtn = parseZambiaMsisdn('0961234567');
  assert.equal(mtn.ok, true);
  assert.equal(mtn.isAirtelPrefix, false);
  assert.match(mtn.prefixWarning, /057, 077, 097/);
});

test('rejects numbers that are not Zambian mobiles', () => {
  for (const sample of ['', '12345', '260123456789', '0812345678', '097123456']) {
    assert.equal(parseZambiaMsisdn(sample).ok, false);
  }
});

test('formats the MSISDN the way Airtel is configured to receive it', () => {
  const parsed = parseZambiaMsisdn('0971234567');
  assert.equal(formatForAirtel(parsed, 'national'), '971234567');
  assert.equal(formatForAirtel(parsed, 'local'), '0971234567');
  assert.equal(formatForAirtel(parsed, 'international'), '260971234567');
});
