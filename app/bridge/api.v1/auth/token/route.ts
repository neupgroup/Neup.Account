import { NextRequest, NextResponse } from 'next/server';
import { issueAccountToken } from '@/services/auth/accountJwt';

export const dynamic = 'force-dynamic';

/**
 * POST /bridge/api.v1/auth/token
 *
 * Issues a signed JWT for external API access.
 *
 * This is called after the silent auth flow completes and the client has
 * received the user's aid, sid, and skey (e.g. via the silent auth code
 * exchange or from the session cookies on a first-party page).
 *
 * The issued JWT embeds aid, sid, skey and is signed with the application's
 * appSecret (HS256). It can then be passed as a Bearer token to
 * POST /bridge/api.v1/me to retrieve full account information.
 *
 * Request body:
 * {
 *   aid:   string  — account ID
 *   sid:   string  — session ID
 *   skey:  string  — session key
 *   appId: string  — application ID (used to look up the signing secret)
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   token:   string  — signed JWT
 *   exp:     number  — Unix timestamp when the token expires
 * }
 *
 * Error responses: 400 (missing params), 401 (invalid session), 404 (app not found), 500
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
