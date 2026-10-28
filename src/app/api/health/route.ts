import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    service: 'voipify-internet-calling',
    features: {
      webrtcAppCalling: true,
      telephonyDialerDemo: true,
      realPstnOutbound: process.env.ENABLE_REAL_PSTN_CALLS === 'true',
    },
    database: {
      type: process.env.DATABASE_URL ? 'hosted-remote' : 'local-persistent',
      ready: true,
    },
  });
}
