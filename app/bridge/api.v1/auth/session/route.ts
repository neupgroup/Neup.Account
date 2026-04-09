
import { NextRequest, NextResponse } from 'next/server';
import { bridgeInvalidateSession, bridgeValidateAndRefreshSession } from '@/services/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api.v1/auth/session
 * Validates a session, updates device type, and extends expiry.
 * Used for internal Neup.Account session management.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await bridgeValidateAndRefreshSession(body);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * DELETE /api.v1/auth/session
 * Invalidates a session (logout).
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const result = await bridgeInvalidateSession(body);
  return NextResponse.json(result.body, { status: result.status });
}
