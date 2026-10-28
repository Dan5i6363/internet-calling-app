import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbHealth;
  try {
    dbHealth = await dbStore.checkHealth();
  } catch (err: any) {
    dbHealth = { connected: false, error: err.message };
  }

  const isHealthy = dbHealth.connected !== false;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      service: 'voipify-internet-calling',
      features: {
        webrtcAppCalling: true,
        telephonyDialerDemo: true,
        realPstnOutbound: process.env.ENABLE_REAL_PSTN_CALLS === 'true',
      },
      database: dbHealth,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
