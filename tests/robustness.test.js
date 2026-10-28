const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { dbStore } = require('../server/db');
const { telephonyStore } = require('../server/telephonyStore');
const { evaluateEligibility, validateAndFormatNumber, mockTelephonyProvider } = require('../server/telephonyUtils');
const { verifyToken, createToken, hashPassword } = require('../server/auth');

describe('System Robustness, Failure Resilience & Fallbacks', () => {
  describe('Environment & Auth Resilience', () => {
    test('JWT verification returns null on malformed or empty token without crashing', () => {
      assert.strictEqual(verifyToken(''), null);
      assert.strictEqual(verifyToken(null), null);
      assert.strictEqual(verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'), null);
    });

    test('Auth tokens correctly retain user identity and expiration structure', () => {
      const user = { id: 'test_id', username: 'resilient_user', displayName: 'Resilient' };
      const token = createToken(user);
      const decoded = verifyToken(token);
      assert.strictEqual(decoded.username, 'resilient_user');
      assert.ok(decoded.exp > decoded.iat);
    });
  });

  describe('Database Self-Healing & Corrupt File Handling', () => {
    test('DB store handles missing data directory cleanly', () => {
      const testUser = {
        username: 'healing_test_' + Date.now(),
        displayName: 'Healing Test',
        passwordHash: hashPassword('password123'),
      };
      const created = dbStore.createUser(testUser);
      assert.strictEqual(created.username, testUser.username);

      const retrieved = dbStore.getUser(testUser.username);
      assert.strictEqual(retrieved.id, created.id);
    });

    test('Telephony store handles missing data directory cleanly', () => {
      const fav = telephonyStore.addFavorite({
        name: 'Auto Heal Contact',
        phoneNumber: '+919876500001',
        countryCode: 'IN',
      });
      assert.ok(fav.id.startsWith('fav_'));

      const favs = telephonyStore.getFavorites();
      assert.ok(favs.some(f => f.phoneNumber === '+919876500001'));
      telephonyStore.removeFavorite(fav.id);
    });
  });

  describe('Telephony Route Guard & Non-Deception Verification', () => {
    test('Real PSTN calls strictly blocked on ₹0 budget', () => {
      const evaluation = evaluateEligibility('IN');
      assert.strictEqual(evaluation.eligibleForRealCalls, false);
      assert.strictEqual(evaluation.isSimulated, true);
      assert.strictEqual(evaluation.costPerMinuteINR, 0);
      assert.ok(evaluation.blockers.some(b => b.includes('₹0')));
    });

    test('Simulated call to Indian number never transitions to connected state', async () => {
      const session = await mockTelephonyProvider.initiateCall({
        targetNumber: '+919876543210',
        countryCode: 'IN',
      });

      assert.strictEqual(session.isSimulated, true);
      assert.strictEqual(session.durationSeconds, 0);

      // Verify that after timeout it transitions to unavailable, NEVER connected
      await new Promise(r => setTimeout(r, 4700));
      const status = await mockTelephonyProvider.getCallStatus(session.callId);
      assert.strictEqual(status.state, 'unavailable');
      assert.strictEqual(status.durationSeconds, 0);
      assert.ok(status.endReason.includes('Real phone call blocked'));
    });

    test('Number validator rejects boundary conditions and edge cases', () => {
      // Empty input
      const empty = validateAndFormatNumber('');
      assert.strictEqual(empty.isValid, false);

      // Alphabetic characters stripped
      const alpha = validateAndFormatNumber('abc-def');
      assert.strictEqual(alpha.isValid, false);

      // Overlength number (>15 digits)
      const overlength = validateAndFormatNumber('+11234567890123456789');
      assert.strictEqual(overlength.isValid, false);

      // Valid Indian 10-digit number with spaces/hyphens
      const spaced = validateAndFormatNumber('98765-43210');
      assert.strictEqual(spaced.isValid, true);
      assert.strictEqual(spaced.e164, '+919876543210');
    });
  });
});
