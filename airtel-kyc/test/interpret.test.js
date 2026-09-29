import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretEnquiry } from '../src/interpret.js';

const subscriber = {
  first_name: 'Mutale',
  last_name: 'Phiri',
  grade: 'GOLD',
  is_barred: false,
  is_pin_set: true,
  msisdn: '971234567',
  registration: { status: 'SUBS' },
};

test('maps a successful enquiry to a verified subscriber', () => {
  const result = interpretEnquiry({
    data: subscriber,
    status: { code: '200', message: 'SUCCESS', result_code: 'ESB000010', success: true },
  }, 200);
  assert.equal(result.verdict, 'verified');
  assert.equal(result.subscriber.fullName, 'Mutale Phiri');
  assert.equal(result.subscriber.isPinSet, true);
  assert.equal(result.airtel.resultCode, 'ESB000010');
});

test('accepts string booleans from the gateway', () => {
  const result = interpretEnquiry({
    data: { ...subscriber, is_barred: 'false', is_pin_set: 'true' },
    status: { success: 'true', message: 'SUCCESS', result_code: 'ESB000010', code: '200' },
  }, 200);
  assert.equal(result.verdict, 'verified');
  assert.equal(result.subscriber.isBarred, false);
});

test('flags a barred wallet', () => {
  const result = interpretEnquiry({
    data: { ...subscriber, is_barred: true },
    status: { success: true, message: 'SUCCESS', code: '200', result_code: 'ESB000010' },
  }, 200);
  assert.equal(result.verdict, 'barred');
});

test('flags an unregistered subscriber', () => {
  const result = interpretEnquiry({
    data: { ...subscriber, registration: { status: 'UNREGISTERED' }, is_pin_set: false },
    status: { success: true, message: 'SUCCESS', code: '200', result_code: 'ESB000010' },
  }, 200);
  assert.equal(result.verdict, 'not_registered');
});

test('keeps an unsuccessful enquiry as not verified', () => {
  const result = interpretEnquiry({
    status: { code: '404', message: 'User not found.', result_code: 'ROUTER404', success: false },
  }, 200);
  assert.equal(result.verdict, 'not_verified');
  assert.equal(result.summary, 'User not found.');
});

test('treats an authentication failure as an error', () => {
  const result = interpretEnquiry({ status: { message: 'Unauthorized', success: false } }, 401);
  assert.equal(result.verdict, 'error');
});
