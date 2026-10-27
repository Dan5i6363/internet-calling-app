export type CallProgressState =
  | 'idle'
  | 'validating'
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'failed'
  | 'unavailable';

export interface TelephonyCallRequest {
  targetNumber: string; // E.164 (e.g. +919876543210)
  countryCode: string;  // e.g. 'IN'
  fromName?: string;
  simulateFailure?: boolean; // For testing failed states
}

export interface TelephonyCallSession {
  callId: string;
  targetNumber: string;
  countryCode: string;
  providerName: string;
  isSimulated: boolean;
  state: CallProgressState;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  durationSeconds: number;
  endReason?: string;
}

export interface EligibilityResult {
  eligibleForRealCalls: boolean;
  activeProvider: 'mock' | 'twilio' | 'plivo' | 'sip';
  isSimulated: boolean;
  costPerMinuteINR: number;
  budgetRemainingINR: number;
  regulatoryNotice: string;
  blockers: string[];
}

export interface ITelephonyProvider {
  name: string;
  isSimulated: boolean;
  initiateCall(req: TelephonyCallRequest): Promise<TelephonyCallSession>;
  terminateCall(callId: string): Promise<{ success: boolean; durationSeconds: number }>;
  getCallStatus(callId: string): Promise<TelephonyCallSession | null>;
}
