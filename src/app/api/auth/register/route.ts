import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, displayName } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, and underscores' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existing = dbStore.getUser(cleanUsername);
    if (existing) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const newUser = dbStore.createUser({
      username: cleanUsername,
      displayName: (displayName && typeof displayName === 'string') ? displayName.trim() : cleanUsername,
      passwordHash,
    });

    const token = createToken({
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
      },
      token,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
