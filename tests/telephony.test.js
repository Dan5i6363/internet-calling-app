const { test, describe } = require('node:test');
const assert = require('node:assert');
const { validateAndFormatNumber, COUNTRIES, evaluateEligibility } = require('../server/telephonyUtils');
const { telephonyStore } = require('../server/telephonyStore');

describe('Telephony Engine & Dialing Suite', () => {
  // 1. Phone number validation & E.164 formatting
  describe('E.164 Phone Number Validation', () => {
    const india = COUNTRIES.find(c => c.code === 'IN');
    const us = COUNTRIES.find(c => c.code === 'US');

    test('Validates 10-digit Indian mobile number correctly', () => {
      const result = validateAndFormatNumber('9876543210', india);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.e164, '+919876543210');
      assert.strictEqual(result.dialCode, '+91');
    });

    test('Rejects invalid length Indian phone number', () => {
      const result = validateAndFormatNumber('12345', india);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errorMessage.includes('10 digits'));
    });

    test('Validates US phone number and formats to E.164', () => {
      const result = validateAndFormatNumber('4155552671', us);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.e164, '+14155552671');
    });

    test('Parses full international prefix with + symbol automatically', () => {
      const result = validateAndFormatNumber('+447911123456');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.e164, '+447911123456');
      assert.strictEqual(result.country.code, 'GB');
    });
  });

  // 2. Real-Call Eligibility Gate & Regulatory Checks
  describe('Eligibility Gate & Regulatory Compliance', () => {
    test('Evaluates ₹0 budget and flags simulation mode', () => {
      const evalResult = evaluateEligibility('IN');
      assert.strictEqual(evalResult.eligibleForRealCalls, false);
      assert.strictEqual(evalResult.activeProvider, 'mock');
      assert.strictEqual(evalResult.isSimulated, true);
      assert.ok(evalResult.blockers.some(b => b.includes('Budget: Initial product budget is ₹0')));
    });

    test('Flags Indian DoT & TRAI compliance restrictions for India numbers (+91)', () => {
      const evalResult = evaluateEligibility('IN');
      assert.ok(evalResult.blockers.some(b => b.includes('DoT Regulation')));
      assert.ok(evalResult.blockers.some(b => b.includes('TRAI DLT Requirement')));
    });

    test('Evaluates international destinations under ₹0 budget', () => {
      const evalResult = evaluateEligibility('US');
      assert.strictEqual(evalResult.eligibleForRealCalls, false);
      assert.strictEqual(evalResult.isSimulated, true);
    });
  });

  // 3. Rate Limiter and Telephony Store
  describe('Telephony Store & Abuse Prevention', () => {
    test('Rate limiter allows requests below threshold', () => {
      const testIp = '192.168.1.99';
      const check = telephonyStore.checkRateLimit(testIp);
      assert.strictEqual(check.allowed, true);
    });

    test('Rate limiter blocks excess calls after 10 requests within a minute', () => {
      const abusiveIp = '10.0.0.99';
      for (let i = 0; i < 10; i++) {
        telephonyStore.checkRateLimit(abusiveIp);
      }
      const blocked = telephonyStore.checkRateLimit(abusiveIp);
      assert.strictEqual(blocked.allowed, false);
      assert.ok(blocked.retryAfterSeconds > 0);
    });

    test('Favorites management: add, retrieve, and remove', () => {
      const fav = telephonyStore.addFavorite({
        name: 'Unit Test Contact',
        phoneNumber: '+919988776655',
        countryCode: 'IN',
      });

      assert.strictEqual(fav.name, 'Unit Test Contact');
      const allFavs = telephonyStore.getFavorites();
      assert.ok(allFavs.some(f => f.phoneNumber === '+919988776655'));

      telephonyStore.removeFavorite(fav.id);
      const afterFavs = telephonyStore.getFavorites();
      assert.strictEqual(afterFavs.some(f => f.id === fav.id), false);
    });

    test('Call history persistence: record and retrieve', () => {
      const entry = telephonyStore.addCall({
        callId: 'call_test_123',
        targetNumber: '+919876543210',
        countryCode: 'IN',
        providerName: 'MockTelephonyEngine',
        isSimulated: true,
        state: 'connected',
        durationSeconds: 42,
      });

      assert.strictEqual(entry.callId, 'call_test_123');
      const recents = telephonyStore.getRecentCalls();
      assert.ok(recents.some(r => r.callId === 'call_test_123'));
    });
  });
});
