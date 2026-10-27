import { NextRequest, NextResponse } from 'next/server';
import { eligibilityGate } from '@/lib/telephony/eligibilityGate';
const { telephonyStore } = require('../../../../../server/telephonyStore');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    const countryCode = url.searchParams.get('countryCode') || 'IN';

    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const provider = eligibilityGate.getActiveProvider(countryCode);
    const session = await provider.getCallStatus(callId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update store
    telephonyStore.updateCall(callId, {
      state: session.state,
      durationSeconds: session.durationSeconds,
    });

    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
