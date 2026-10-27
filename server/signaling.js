const WebSocket = require('ws');
const { verifyToken } = require('./auth');
const { dbStore } = require('./db');

class SignalingServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map(); // username -> WebSocket
    this.userStates = new Map(); // username -> 'idle' | 'calling' | 'ringing' | 'in_call'
    this.activeCalls = new Map(); // callId -> CallSession
    this.ringTimeouts = new Map(); // callId -> NodeJS.Timeout

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat to sweep dead sockets
    this.heartbeatInterval = setInterval(() => {
      for (const [username, ws] of this.clients.entries()) {
        if (!ws.isAlive) {
          console.log(`[Signaling] Heartbeat timeout for ${username}, terminating.`);
          ws.terminate();
          this.handleDisconnect(username, ws);
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, 30000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let authenticatedUser = null;

    // Check query token if present
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          authenticatedUser = decoded;
          this.registerUser(authenticatedUser, ws);
        }
      }
    } catch (e) {
      // Continue to in-band auth
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!authenticatedUser) {
          if (msg.type === 'auth') {
            const decoded = verifyToken(msg.token);
            if (!decoded) {
              this.send(ws, { type: 'auth_error', message: 'Invalid or expired token' });
              ws.close(4001, 'Unauthorized');
              return;
            }
            authenticatedUser = decoded;
            this.registerUser(authenticatedUser, ws);
            this.send(ws, { type: 'auth_success', user: authenticatedUser });
            return;
          } else {
            this.send(ws, { type: 'auth_error', message: 'Authentication required' });
            return;
          }
        }

        // Authenticated message handling
        this.handleMessage(authenticatedUser, ws, msg);
      } catch (err) {
        console.error('[Signaling] Message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (authenticatedUser) {
        this.handleDisconnect(authenticatedUser.username, ws);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Signaling] Socket error for ${authenticatedUser?.username}:`, err);
    });
  }

  registerUser(user, ws) {
    const username = user.username.toLowerCase();
    // If user already had a session, replace it
    if (this.clients.has(username)) {
      const oldWs = this.clients.get(username);
      if (oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
        this.send(oldWs, { type: 'replaced', message: 'Session opened from another tab/device.' });
        oldWs.close();
      }
    }

    this.clients.set(username, ws);
    this.userStates.set(username, 'idle');
    console.log(`[Signaling] User registered: ${username}`);

    // Broadcast presence update
    this.broadcastPresence(username, 'online');
  }

  handleDisconnect(username, ws) {
    const uname = username.toLowerCase();
    if (ws && this.clients.get(uname) !== ws) {
      return;
    }
    console.log(`[Signaling] User disconnected: ${uname}`);
    this.clients.delete(uname);
    this.userStates.delete(uname);

    // End or clean up any active calls involving this user
    for (const [callId, call] of this.activeCalls.entries()) {
      if (call.caller === uname || call.callee === uname) {
        const peer = call.caller === uname ? call.callee : call.caller;
        const peerWs = this.clients.get(peer);

        if (this.ringTimeouts.has(callId)) {
          clearTimeout(this.ringTimeouts.get(callId));
          this.ringTimeouts.delete(callId);
        }

        if (peerWs && peerWs.readyState === WebSocket.OPEN) {
          this.send(peerWs, {
            type: 'call_ended',
            callId,
            reason: 'peer_disconnected',
            message: `${uname} lost connection.`
          });
          this.userStates.set(peer, 'idle');
        }

        const duration = call.startedAt ? Math.round((Date.now() - call.startedAt) / 1000) : 0;
        dbStore.addCallRecord({
          caller: call.caller,
          callee: call.callee,
          status: call.state === 'in_call' ? 'completed' : 'missed',
          startedAt: new Date(call.createdAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: duration,
        });

        this.activeCalls.delete(callId);
      }
    }

    this.broadcastPresence(uname, 'offline');
  }

  broadcastPresence(username, status) {
    const payload = {
      type: 'presence',
      username,
      status, // 'online' | 'offline'
      timestamp: Date.now()
    };
    for (const client of this.clients.values()) {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client, payload);
      }
    }
  }

  handleMessage(user, ws, msg) {
    const sender = user.username.toLowerCase();

    switch (msg.type) {
      case 'get_online_users': {
        const onlineList = Array.from(this.clients.keys());
        this.send(ws, {
          type: 'online_users_list',
          users: onlineList,
          states: Object.fromEntries(this.userStates)
        });
        break;
      }

      case 'call_initiate': {
        const target = (msg.targetUsername || '').toLowerCase().trim();
        if (!target) {
          return this.send(ws, { type: 'call_error', code: 'INVALID_TARGET', message: 'Target username is required.' });
        }
        if (target === sender) {
          return this.send(ws, { type: 'call_error', code: 'SELF_CALL', message: 'You cannot call yourself.' });
        }

        const targetWs = this.clients.get(target);
        if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
          dbStore.addCallRecord({
            caller: sender,
            callee: target,
            status: 'failed',
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            durationSeconds: 0
          });
          return this.send(ws, { type: 'call_error', code: 'USER_OFFLINE', message: `${target} is currently offline.` });
        }

        const targetState = this.userStates.get(target);
        if (targetState && targetState !== 'idle') {
          dbStore.addCallRecord({
            caller: sender,
            callee: target,
            status: 'busy',
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            durationSeconds: 0
          });
          return this.send(ws, { type: 'call_error', code: 'USER_BUSY', message: `${target} is currently in another call.` });
        }

        const senderState = this.userStates.get(sender);
        if (senderState && senderState !== 'idle') {
          return this.send(ws, { type: 'call_error', code: 'CALLER_BUSY', message: 'You already have an active call session.' });
        }

        const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const callSession = {
          callId,
          caller: sender,
          callerDisplayName: user.displayName || sender,
          callee: target,
          state: 'ringing',
          createdAt: Date.now(),
          startedAt: null
        };

        this.activeCalls.set(callId, callSession);
        this.userStates.set(sender, 'calling');
        this.userStates.set(target, 'ringing');

        // Ringing timeout (45s)
        const timeout = setTimeout(() => {
          this.handleRingTimeout(callId);
        }, 45000);
        this.ringTimeouts.set(callId, timeout);

        // Notify callee
        this.send(targetWs, {
          type: 'incoming_call',
          callId,
          callerUsername: sender,
          callerDisplayName: user.displayName || sender
        });

        // Notify caller that ringing has started
        this.send(ws, {
          type: 'call_ringing',
          callId,
          targetUsername: target
        });
        break;
      }

      case 'call_accept': {
        const callId = msg.callId;
        const call = this.activeCalls.get(callId);

        if (!call || call.callee !== sender) {
          return this.send(ws, { type: 'call_error', code: 'INVALID_CALL', message: 'Call session not found or unauthorized.' });
        }

        if (call.state !== 'ringing') {
          return this.send(ws, { type: 'call_error', code: 'INVALID_STATE', message: 'Call is no longer ringing.' });
        }

        if (this.ringTimeouts.has(callId)) {
          clearTimeout(this.ringTimeouts.get(callId));
          this.ringTimeouts.delete(callId);
        }

        call.state = 'in_call';
        call.startedAt = Date.now();
        this.userStates.set(call.caller, 'in_call');
        this.userStates.set(call.callee, 'in_call');

        const callerWs = this.clients.get(call.caller);
        if (callerWs && callerWs.readyState === WebSocket.OPEN) {
          this.send(callerWs, {
            type: 'call_accepted',
            callId,
            startedAt: call.startedAt
          });
        }

        this.send(ws, {
          type: 'call_started',
          callId,
          startedAt: call.startedAt
        });
        break;
      }

      case 'call_reject': {
        const callId = msg.callId;
        const call = this.activeCalls.get(callId);

        if (!call || (call.callee !== sender && call.caller !== sender)) {
          return;
        }

        if (this.ringTimeouts.has(callId)) {
          clearTimeout(this.ringTimeouts.get(callId));
          this.ringTimeouts.delete(callId);
        }

        const callerWs = this.clients.get(call.caller);
        if (callerWs && callerWs.readyState === WebSocket.OPEN) {
          this.send(callerWs, {
            type: 'call_rejected',
            callId,
            reason: msg.reason || 'declined'
          });
        }

        dbStore.addCallRecord({
          caller: call.caller,
          callee: call.callee,
          status: 'rejected',
          startedAt: new Date(call.createdAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 0
        });

        this.userStates.set(call.caller, 'idle');
        this.userStates.set(call.callee, 'idle');
        this.activeCalls.delete(callId);
        break;
      }

      case 'call_cancel': {
        const callId = msg.callId;
        const call = this.activeCalls.get(callId);

        if (!call || call.caller !== sender) {
          return;
        }

        if (this.ringTimeouts.has(callId)) {
          clearTimeout(this.ringTimeouts.get(callId));
          this.ringTimeouts.delete(callId);
        }

        const calleeWs = this.clients.get(call.callee);
        if (calleeWs && calleeWs.readyState === WebSocket.OPEN) {
          this.send(calleeWs, {
            type: 'call_cancelled',
            callId,
            message: 'Caller hung up before answer.'
          });
        }

        dbStore.addCallRecord({
          caller: call.caller,
          callee: call.callee,
          status: 'missed',
          startedAt: new Date(call.createdAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 0
        });

        this.userStates.set(call.caller, 'idle');
        this.userStates.set(call.callee, 'idle');
        this.activeCalls.delete(callId);
        break;
      }

      case 'offer': {
        const call = this.activeCalls.get(msg.callId);
        if (!call) return;
        const target = call.caller === sender ? call.callee : call.caller;
        const targetWs = this.clients.get(target);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          this.send(targetWs, {
            type: 'offer',
            callId: msg.callId,
            sdp: msg.sdp,
            from: sender
          });
        }
        break;
      }

      case 'answer': {
        const call = this.activeCalls.get(msg.callId);
        if (!call) return;
        const target = call.caller === sender ? call.callee : call.caller;
        const targetWs = this.clients.get(target);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          this.send(targetWs, {
            type: 'answer',
            callId: msg.callId,
            sdp: msg.sdp,
            from: sender
          });
        }
        break;
      }

      case 'ice_candidate': {
        const call = this.activeCalls.get(msg.callId);
        if (!call) return;
        const target = call.caller === sender ? call.callee : call.caller;
        const targetWs = this.clients.get(target);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          this.send(targetWs, {
            type: 'ice_candidate',
            callId: msg.callId,
            candidate: msg.candidate,
            from: sender
          });
        }
        break;
      }

      case 'call_end': {
        const callId = msg.callId;
        const call = this.activeCalls.get(callId);
        if (!call) return;

        if (this.ringTimeouts.has(callId)) {
          clearTimeout(this.ringTimeouts.get(callId));
          this.ringTimeouts.delete(callId);
        }

        const otherUser = call.caller === sender ? call.callee : call.caller;
        const otherWs = this.clients.get(otherUser);

        if (otherWs && otherWs.readyState === WebSocket.OPEN) {
          this.send(otherWs, {
            type: 'call_ended',
            callId,
            by: sender,
            reason: 'hangup'
          });
        }

        this.send(ws, {
          type: 'call_ended',
          callId,
          by: sender,
          reason: 'hangup'
        });

        const duration = call.startedAt ? Math.round((Date.now() - call.startedAt) / 1000) : 0;
        dbStore.addCallRecord({
          caller: call.caller,
          callee: call.callee,
          status: call.startedAt ? 'completed' : 'missed',
          startedAt: new Date(call.createdAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: duration
        });

        this.userStates.set(call.caller, 'idle');
        this.userStates.set(call.callee, 'idle');
        this.activeCalls.delete(callId);
        break;
      }

      default:
        console.warn(`[Signaling] Unrecognized message type: ${msg.type}`);
    }
  }

  handleRingTimeout(callId) {
    const call = this.activeCalls.get(callId);
    if (!call || call.state !== 'ringing') return;

    this.ringTimeouts.delete(callId);

    const callerWs = this.clients.get(call.caller);
    const calleeWs = this.clients.get(call.callee);

    if (callerWs && callerWs.readyState === WebSocket.OPEN) {
      this.send(callerWs, {
        type: 'call_error',
        code: 'NO_ANSWER',
        message: `${call.callee} did not answer.`
      });
    }

    if (calleeWs && calleeWs.readyState === WebSocket.OPEN) {
      this.send(calleeWs, {
        type: 'call_cancelled',
        callId,
        message: 'Missed call.'
      });
    }

    dbStore.addCallRecord({
      caller: call.caller,
      callee: call.callee,
      status: 'missed',
      startedAt: new Date(call.createdAt).toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: 0
    });

    this.userStates.set(call.caller, 'idle');
    this.userStates.set(call.callee, 'idle');
    this.activeCalls.delete(callId);
  }

  send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  close() {
    clearInterval(this.heartbeatInterval);
    for (const timeout of this.ringTimeouts.values()) {
      clearTimeout(timeout);
    }
    for (const client of this.clients.values()) {
      try {
        client.terminate();
      } catch (e) {}
    }
    this.clients.clear();
    this.userStates.clear();
    this.activeCalls.clear();
    this.wss.close();
  }
}

module.exports = { SignalingServer };
