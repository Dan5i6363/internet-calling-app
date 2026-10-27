import { NextRequest, NextResponse } from 'next/server';
const { telephonyStore } = require('../../../../../server/telephonyStore');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const favorites = telephonyStore.getFavorites();
    return NextResponse.json({ favorites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fav = telephonyStore.addFavorite(body);
    return NextResponse.json({ favorite: fav });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    telephonyStore.removeFavorite(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
