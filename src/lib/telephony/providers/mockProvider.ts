import {
  ITelephonyProvider,
  TelephonyCallRequest,
  TelephonyCallSession,
} from '../types';

class MockTelephonyProvider implements ITelephonyProvider {
  name = 'MockTelephonyEngine (₹0 Demo)';
  isSimulated = true;
  private sessions = new Map<string, TelephonyCallSession>();

  async initiateCall(req: TelephonyCallRequest): Promise<TelephonyCallSession> {
    const callId = 'mock_call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // If simulated failure requested or test number ending in 000
    if (req.simulateFailure || req.targetNumber.endsWith('00000')) {
      const failedSession: TelephonyCallSession = {
        callId,
        targetNumber: req.targetNumber,
        countryCode: req.countryCode,
        providerName: this.name,
        isSimulated: true,
        state: 'unavailable',
        startedAt: Date.now(),
        endedAt: Date.now(),
        durationSeconds: 0,
        endReason: 'Simulated: Destination subscriber is busy or unavailable',
      };
      this.sessions.set(callId, failedSession);
      return failedSession;
    }

    const session: TelephonyCallSession = {
      callId,
      targetNumber: req.targetNumber,
      countryCode: req.countryCode,
      providerName: this.name,
      isSimulated: true,
      state: 'connecting',
      startedAt: Date.now(),
      durationSeconds: 0,
    };

    this.sessions.set(callId, session);

    // Realistic state progression
    // 1.5s -> ringing
    setTimeout(() => {
      const s = this.sessions.get(callId);
      if (s && s.state === 'connecting') {
        s.state = 'ringing';
      }
    }, 1200);

    // 4.0s -> connected
    setTimeout(() => {
      const s = this.sessions.get(callId);
      if (s && s.state === 'ringing') {
        s.state = 'connected';
        s.connectedAt = Date.now();
      }
    }, 3800);

    return session;
  }

  async terminateCall(callId: string): Promise<{ success: boolean; durationSeconds: number }> {
    const session = this.sessions.get(callId);
    if (!session) {
      return { success: false, durationSeconds: 0 };
    }

    const now = Date.now();
    session.endedAt = now;
    session.state = 'ended';
    if (session.connectedAt) {
      session.durationSeconds = Math.round((now - session.connectedAt) / 1000);
    } else {
      session.durationSeconds = 0;
    }
    session.endReason = 'Call ended by caller';

    return { success: true, durationSeconds: session.durationSeconds };
  }

  async getCallStatus(callId: string): Promise<TelephonyCallSession | null> {
    const session = this.sessions.get(callId);
    if (!session) return null;

    if (session.state === 'connected' && session.connectedAt) {
      session.durationSeconds = Math.round((Date.now() - session.connectedAt) / 1000);
    }
    return session;
  }
}

export const mockTelephonyProvider = new MockTelephonyProvider();
