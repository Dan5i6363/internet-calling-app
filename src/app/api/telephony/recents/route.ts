import { NextRequest, NextResponse } from 'next/server';
const { telephonyStore } = require('../../../../../server/telephonyStore');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const calls = telephonyStore.getRecentCalls();
    return NextResponse.json({ calls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
