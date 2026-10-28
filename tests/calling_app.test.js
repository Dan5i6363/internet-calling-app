const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const WebSocket = require('ws');
const { dbStore } = require('../server/db');
const { hashPassword, verifyPassword, createToken, verifyToken } = require('../server/auth');
const { SignalingServer } = require('../server/signaling');

describe('Internet Calling App Test Suite', () => {
  let server;
  let signaling;
  let port;
  let tokenAlice;
  let tokenBob;
  let tokenCharlie;

  before(async () => {
    const u1 = 'test_alice_' + Date.now();
    const u2 = 'test_bob_' + Date.now();
    const u3 = 'test_charlie_' + Date.now();

    const pHash = hashPassword('Secret123!');
    const alice = dbStore.createUser({ username: u1, displayName: 'Alice', passwordHash: pHash });
    const bob = dbStore.createUser({ username: u2, displayName: 'Bob', passwordHash: pHash });
    const charlie = dbStore.createUser({ username: u3, displayName: 'Charlie', passwordHash: pHash });

    tokenAlice = { token: createToken(alice), username: u1 };
    tokenBob = { token: createToken(bob), username: u2 };
    tokenCharlie = { token: createToken(charlie), username: u3 };

    server = http.createServer();
    signaling = new SignalingServer(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  const openSockets = [];

  after(() => {
    for (const ws of openSockets) {
      try {
        ws.terminate();
      } catch (e) {}
    }
    openSockets.length = 0;
    signaling.close();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close();
    setTimeout(() => process.exit(0), 50);
  });

  function connectClient(token) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      openSockets.push(ws);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  function waitForMessage(ws, type, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off('message', onMsg);
        reject(new Error(`Timeout waiting for message type '${type}'`));
      }, timeoutMs);

      function onMsg(raw) {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === type) {
            clearTimeout(timer);
            ws.off('message', onMsg);
            resolve(msg);
          }
        } catch (e) {}
      }

      ws.on('message', onMsg);
    });
  }

  describe('Authentication & Store', () => {
    test('Password hashing and verification works', () => {
      const hash = hashPassword('MySecurePass2026!');
      assert.strictEqual(verifyPassword('MySecurePass2026!', hash), true);
      assert.strictEqual(verifyPassword('WrongPass', hash), false);
    });

    test('JWT token creation and verification works', () => {
      const payload = { id: 'usr_123', username: 'tester', displayName: 'Tester' };
      const token = createToken(payload);
      const decoded = verifyToken(token);
      assert.strictEqual(decoded.username, 'tester');
      assert.strictEqual(decoded.id, 'usr_123');
    });

    test('Invalid or tampered token returns null', () => {
      const invalid = verifyToken('not.a.real.jwt.token');
      assert.strictEqual(invalid, null);
    });

    test('Duplicate username creation throws error', () => {
      assert.throws(() => {
        dbStore.createUser({
          username: tokenAlice.username,
          displayName: 'Duplicate Alice',
          passwordHash: 'dummy'
        });
      }, /Username already exists/);
    });

    test('User search filters correctly and excludes requesting user', () => {
      const results = dbStore.searchUsers('alice', tokenAlice.username);
      assert.strictEqual(results.some(u => u.username === tokenAlice.username), false);
    });
  });

  describe('Real-time Signaling and WebRTC Call Session Flow', () => {
    test('Unauthorized connection without token closes with 4001 or rejects', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const authErrorReceived = await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'get_online_users' }));
        });
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'auth_error') resolve(true);
        });
        ws.on('close', () => resolve(true));
      });
      assert.strictEqual(authErrorReceived, true);
    });

    test('Two authenticated clients can register and exchange presence', async () => {
      const wsAlice = await connectClient(tokenAlice.token);
      const wsBob = await connectClient(tokenBob.token);

      const listPromise = waitForMessage(wsAlice, 'online_users_list');
      wsAlice.send(JSON.stringify({ type: 'get_online_users' }));
      const msg = await listPromise;

      assert.ok(msg.users.includes(tokenAlice.username));
      assert.ok(msg.users.includes(tokenBob.username));

      wsAlice.close();
      wsBob.close();
    });

    test('Self-calling is rejected with SELF_CALL error code', async () => {
      const wsAlice = await connectClient(tokenAlice.token);
      const errorPromise = waitForMessage(wsAlice, 'call_error');

      wsAlice.send(JSON.stringify({
        type: 'call_initiate',
        targetUsername: tokenAlice.username
      }));

      const errorMsg = await errorPromise;
      assert.strictEqual(errorMsg.code, 'SELF_CALL');
      wsAlice.close();
    });

    test('Calling offline user returns USER_OFFLINE error code', async () => {
      const wsAlice = await connectClient(tokenAlice.token);
      const errorPromise = waitForMessage(wsAlice, 'call_error');

      wsAlice.send(JSON.stringify({
        type: 'call_initiate',
        targetUsername: 'non_existent_offline_user'
      }));

      const errorMsg = await errorPromise;
      assert.strictEqual(errorMsg.code, 'USER_OFFLINE');
      wsAlice.close();
    });

    test('Full End-to-End Call Lifecycle: Ringing -> Accept -> WebRTC SDP Relay -> ICE Candidate -> End Call', async () => {
      const wsAlice = await connectClient(tokenAlice.token);
      const wsBob = await connectClient(tokenBob.token);

      // Prepare listener promises BEFORE initiating call
      const ringingPromise = waitForMessage(wsAlice, 'call_ringing');
      const incomingPromise = waitForMessage(wsBob, 'incoming_call');

      // Alice initiates call to Bob
      wsAlice.send(JSON.stringify({
        type: 'call_initiate',
        targetUsername: tokenBob.username
      }));

      const ringingMsg = await ringingPromise;
      const incomingMsg = await incomingPromise;

      assert.strictEqual(ringingMsg.targetUsername, tokenBob.username);
      assert.strictEqual(incomingMsg.callerUsername, tokenAlice.username);
      const currentCallId = ringingMsg.callId;
      assert.strictEqual(incomingMsg.callId, currentCallId);

      // Prepare accepted listener on Alice before Bob accepts
      const acceptedPromise = waitForMessage(wsAlice, 'call_accepted');

      // Bob accepts call
      wsBob.send(JSON.stringify({
        type: 'call_accept',
        callId: currentCallId
      }));

      const acceptedMsg = await acceptedPromise;
      assert.strictEqual(acceptedMsg.callId, currentCallId);

      // WebRTC SDP Offer relay: prepare listener on Bob
      const offerPromise = waitForMessage(wsBob, 'offer');
      const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=alice 123456 ... m=audio 9 UDP/TLS/RTP/SAVPF 111 ...' };
      wsAlice.send(JSON.stringify({
        type: 'offer',
        callId: currentCallId,
        sdp: mockOfferSdp
      }));
      const receivedOffer = await offerPromise;
      assert.strictEqual(receivedOffer.callId, currentCallId);
      assert.strictEqual(receivedOffer.sdp.type, 'offer');

      // WebRTC SDP Answer relay: prepare listener on Alice
      const answerPromise = waitForMessage(wsAlice, 'answer');
      const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=bob 654321 ... m=audio 9 UDP/TLS/RTP/SAVPF 111 ...' };
      wsBob.send(JSON.stringify({
        type: 'answer',
        callId: currentCallId,
        sdp: mockAnswerSdp
      }));
      const receivedAnswer = await answerPromise;
      assert.strictEqual(receivedAnswer.callId, currentCallId);
      assert.strictEqual(receivedAnswer.sdp.type, 'answer');

      // ICE Candidate relay: prepare listener on Bob
      const icePromise = waitForMessage(wsBob, 'ice_candidate');
      const mockCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host', sdpMid: '0' };
      wsAlice.send(JSON.stringify({
        type: 'ice_candidate',
        callId: currentCallId,
        candidate: mockCandidate
      }));
      const receivedCandidate = await icePromise;
      assert.strictEqual(receivedCandidate.callId, currentCallId);
      assert.strictEqual(receivedCandidate.candidate.candidate, mockCandidate.candidate);

      // Test Busy State: Charlie tries to call Bob while Bob is in call
      const wsCharlie = await connectClient(tokenCharlie.token);
      const busyPromise = waitForMessage(wsCharlie, 'call_error');
      wsCharlie.send(JSON.stringify({
        type: 'call_initiate',
        targetUsername: tokenBob.username
      }));
      const busyMsg = await busyPromise;
      assert.strictEqual(busyMsg.code, 'USER_BUSY');
      wsCharlie.close();

      // Alice ends call: prepare listener on Bob
      const endPromise = waitForMessage(wsBob, 'call_ended');
      wsAlice.send(JSON.stringify({
        type: 'call_end',
        callId: currentCallId
      }));
      const endMsg = await endPromise;
      assert.strictEqual(endMsg.callId, currentCallId);
      assert.strictEqual(endMsg.by, tokenAlice.username);

      // Verify DB record
      const history = dbStore.getCallHistory(tokenAlice.username);
      const recorded = history.find(c => c.caller === tokenAlice.username && c.callee === tokenBob.username);
      assert.ok(recorded, 'Call must be recorded in history');
      assert.strictEqual(recorded.status, 'completed');

      wsAlice.close();
      wsBob.close();
    });

    test('Call Rejection Flow: Callee rejects incoming call', async () => {
      const wsAlice = await connectClient(tokenAlice.token);
      const wsBob = await connectClient(tokenBob.token);

      const ringingPromise = waitForMessage(wsAlice, 'call_ringing');
      const incomingPromise = waitForMessage(wsBob, 'incoming_call');

      wsAlice.send(JSON.stringify({
        type: 'call_initiate',
        targetUsername: tokenBob.username
      }));

      const ringingMsg = await ringingPromise;
      const incomingMsg = await incomingPromise;
      const currentCallId = ringingMsg.callId;

      // Bob rejects call
      const rejectedPromise = waitForMessage(wsAlice, 'call_rejected');
      wsBob.send(JSON.stringify({
        type: 'call_reject',
        callId: currentCallId,
        reason: 'declined'
      }));

      const rejectedMsg = await rejectedPromise;
      assert.strictEqual(rejectedMsg.callId, currentCallId);
      assert.strictEqual(rejectedMsg.reason, 'declined');

      wsAlice.close();
      wsBob.close();
    });

    test('Call Cancellation Flow: Caller cancels before answer', async () => {
      const wsAlice = await connectClient(tokenAlice.token);
      const wsBob = await connectClient(tokenBob.token);

      const ringingPromise = waitForMessage(wsAlice, 'call_ringing');
      const incomingPromise = waitForMessage(wsBob, 'incoming_call');

      wsAlice.send(JSON.stringify({
        type: 'call_initiate',
        targetUsername: tokenBob.username
      }));

      const ringingMsg = await ringingPromise;
      await incomingPromise;
      const currentCallId = ringingMsg.callId;

      // Alice cancels
      const cancelPromise = waitForMessage(wsBob, 'call_cancelled');
      wsAlice.send(JSON.stringify({
        type: 'call_cancel',
        callId: currentCallId
      }));

      const cancelMsg = await cancelPromise;
      assert.strictEqual(cancelMsg.callId, currentCallId);

      wsAlice.close();
      wsBob.close();
    });
  });
});
