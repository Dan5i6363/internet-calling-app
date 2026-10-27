import { NextRequest, NextResponse } from 'next/server';
import { eligibilityGate } from '@/lib/telephony/eligibilityGate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const countryCode = url.searchParams.get('country') || 'IN';
    const evaluation = eligibilityGate.evaluateEligibility(countryCode);

    return NextResponse.json(evaluation);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
