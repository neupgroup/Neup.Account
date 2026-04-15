import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/services/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api.v1/auth/verify
 * Validates a session against session ID, session key, account ID, app ID, and private key.
 * Returns { valid: true } if the session is valid for the app, { valid: false } otherwise.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await validateSession({
      sessionId: body.sessionId,
      sessionKey: body.sessionKey,
      accountId: body.accountId,
      appId: body.appId,
      privateKey: body.privateKey,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in /bridge/api.v1/auth/verify:', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
