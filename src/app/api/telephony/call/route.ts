import { NextRequest, NextResponse } from 'next/server';
import { validateAndFormatNumber, COUNTRIES, CountryInfo } from '@/lib/telephony/phoneUtils';
import { eligibilityGate } from '@/lib/telephony/eligibilityGate';
const { telephonyStore } = require('../../../../../server/telephonyStore');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateCheck = telephonyStore.checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds}s before dialing again.`,
          code: 'RATE_LIMITED',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { phoneNumber, countryCode, simulateFailure } = body;

    const matchedCountry = COUNTRIES.find((c: CountryInfo) => c.code === countryCode) || COUNTRIES[0];
    const validation = validateAndFormatNumber(phoneNumber || '', matchedCountry);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.errorMessage || 'Invalid phone number format',
          code: 'INVALID_NUMBER',
        },
        { status: 400 }
      );
    }

    // Resolve provider via eligibility gate
    const provider = eligibilityGate.getActiveProvider(matchedCountry.code);

    const session = await provider.initiateCall({
      targetNumber: validation.e164,
      countryCode: matchedCountry.code,
      simulateFailure: Boolean(simulateFailure),
    });

    // Save initial record to store
    await telephonyStore.addCall({
      callId: session.callId,
      targetNumber: session.targetNumber,
      countryCode: session.countryCode,
      providerName: session.providerName,
      isSimulated: session.isSimulated,
      state: session.state,
      startedAt: new Date(session.startedAt).toISOString(),
      durationSeconds: 0,
      endReason: session.endReason,
    });

    return NextResponse.json({
      session,
      eligibility: eligibilityGate.evaluateEligibility(matchedCountry.code),
    });
  } catch (err: any) {
    console.error('Telephony Call Error:', err);
    return NextResponse.json(
      { error: err.message || 'Call initiation failed', code: 'CALL_FAILED' },
      { status: 500 }
    );
  }
}
