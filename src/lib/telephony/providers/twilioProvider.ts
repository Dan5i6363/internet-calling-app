import {
  ITelephonyProvider,
  TelephonyCallRequest,
  TelephonyCallSession,
} from '../types';

export class TwilioVoiceProvider implements ITelephonyProvider {
  name = 'Twilio Voice (PSTN Outbound)';
  isSimulated = false;

  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
      this.authToken &&
      this.fromNumber &&
      !this.accountSid.includes('placeholder') &&
      !this.authToken.includes('placeholder')
    );
  }

  async initiateCall(req: TelephonyCallRequest): Promise<TelephonyCallSession> {
    if (!this.isConfigured()) {
      throw new Error(
        'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in server environment variables.'
      );
    }

    // Call Twilio REST API
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`;

    const body = new URLSearchParams({
      To: req.targetNumber,
      From: this.fromNumber,
      // Minimal TwiML response telling recipient it is an internet call
      Twiml: '<Response><Say voice="alice">Connecting your internet call. Please stay on the line.</Say></Response>',
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Twilio PSTN Error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      callId: data.sid,
      targetNumber: req.targetNumber,
      countryCode: req.countryCode,
      providerName: this.name,
      isSimulated: false,
      state: 'connecting',
      startedAt: Date.now(),
      durationSeconds: 0,
    };
  }

  async terminateCall(callId: string): Promise<{ success: boolean; durationSeconds: number }> {
    if (!this.isConfigured()) return { success: false, durationSeconds: 0 };

    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${callId}.json`;

    const body = new URLSearchParams({ Status: 'completed' });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    return { success: response.ok, durationSeconds: 0 };
  }

  async getCallStatus(callId: string): Promise<TelephonyCallSession | null> {
    if (!this.isConfigured()) return null;

    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${callId}.json`;

    const response = await fetch(endpoint, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) return null;
    const data = await response.json();

    let state: any = 'connecting';
    if (data.status === 'ringing') state = 'ringing';
    else if (data.status === 'in-progress') state = 'connected';
    else if (data.status === 'completed') state = 'ended';
    else if (['busy', 'failed', 'no-answer', 'canceled'].includes(data.status)) state = 'failed';

    return {
      callId: data.sid,
      targetNumber: data.to,
      countryCode: 'UNKNOWN',
      providerName: this.name,
      isSimulated: false,
      state,
      startedAt: new Date(data.date_created).getTime(),
      durationSeconds: parseInt(data.duration || '0', 10),
    };
  }
}

export const twilioVoiceProvider = new TwilioVoiceProvider();
