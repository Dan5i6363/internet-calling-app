import { NextRequest, NextResponse } from 'next/server';
import { eligibilityGate } from '@/lib/telephony/eligibilityGate';
const { telephonyStore } = require('../../../../../server/telephonyStore');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { callId, countryCode } = body;

    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const provider = eligibilityGate.getActiveProvider(countryCode || 'IN');
    const result = await provider.terminateCall(callId);

    await telephonyStore.updateCall(callId, {
      state: 'ended',
      durationSeconds: result.durationSeconds,
      endedAt: new Date().toISOString(),
      endReason: 'Call ended by caller',
    });

    return NextResponse.json({ success: true, durationSeconds: result.durationSeconds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
