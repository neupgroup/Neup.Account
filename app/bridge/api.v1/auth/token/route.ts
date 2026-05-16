import { NextRequest, NextResponse } from 'next/server';
import { issueAccountToken } from '@/services/auth/accountJwt';

export const dynamic = 'force-dynamic';

/**
 * POST /account/bridge/api.v1/auth/token
 *
 * Issues a signed JWT for external API access.
 *
 * Called after the silent auth flow completes and the caller has the user's
 * aid, sid, and skey (from the silent auth code exchange or session cookies).
 *
 * The issued JWT contains only { cid, iat, exp }:
 *   cid — ApplicationConnection.id (stable link between account and app)
 *   iat — issued-at Unix timestamp
 *   exp — expiry Unix timestamp (7 days from issue)
 *
 * The JWT is signed with Application.appSecret (HS256).
 * Pass it as a Bearer token to POST /account/bridge/api.v1/me.
 *
 * Request body:
 * {
 *   aid:   string  — account ID
 *   sid:   string  — session ID
 *   skey:  string  — session key
 *   appId: string  — application ID
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   token:   string  — signed JWT  { cid, iat, exp }
 *   exp:     number  — Unix timestamp when the token expires
 * }
 *
 * Errors: 400 (missing params), 401 (invalid session), 404 (app not found), 500
 */
export async function POST(request: NextRequest) {
  let body: { aid?: string; sid?: string; skey?: string; appId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const result = await issueAccountToken(body);
  return NextResponse.json(result.body, { status: result.status });
}
