import { NextRequest, NextResponse } from 'next/server';
import { resolveMeFromToken, resolveMeFromSession } from '@/services/auth/accountJwt';

export const dynamic = 'force-dynamic';

/**
 * POST /account/bridge/api.v1/me
 * POST /account/bridge/api.v1/me?app_id=<appId>
 *
 * Returns account information shaped by the access fields configured on the
 * requesting application (Application.details.access).
 *
 * ─── Mode A — Bearer JWT (external / third-party apps) ───────────────────
 *
 *   Authorization: Bearer <token>
 *
 *   The token was issued by POST /account/bridge/api.v1/auth/token.
 *   It contains { cid, iat, exp } where cid is the ApplicationConnection.id.
 *   The server resolves accountId + appId from the connection record and
 *   verifies the JWT signature using Application.appSecret.
 *
 * ─── Mode B — Session triplet (Neup Group internal apps) ─────────────────
 *
 *   POST /account/bridge/api.v1/me?app_id=<appId>
 *   Body: { aid, sid, skey }
 *
 *   No JWT needed. The server validates aid/sid/skey directly against the
 *   database. app_id must be passed as a URL query parameter.
 *   An ApplicationConnection is created automatically if one doesn't exist.
 *
 * ─── Response (200) ───────────────────────────────────────────────────────
 *
 * {
 *   success: true,
 *   account: {
 *     // Only fields declared in Application.details.access are included.
 *     // Possible fields: connectionId, accountId, displayName, displayImage,
 *     // accountType, lastActive, neupid, firstName, lastName, middleName,
 *     // dateBirth, age, isMinor, gender
 *   },
 *   brandAccounts: Array<{ id, displayName, displayImage, status, isVerified, accountType, capabilities }>,
 *   accessibleAccounts: Array<{ id, displayName, displayImage, status, isVerified, accountType, capabilities }>
 * }
 *
 * ─── Errors ───────────────────────────────────────────────────────────────
 *
 *   400  missing_token / invalid_request
 *   401  invalid_token / token_expired / invalid_session / account_not_found
 *   403  account_blocked
 *   500  internal_server_error
 */
export async function POST(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('app_id') ?? undefined;
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  // Mode B — session triplet + app_id query param
  if (appId && !bearerToken) {
    let body: { aid?: string; sid?: string; skey?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'invalid_request', error_description: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const result = await resolveMeFromSession({ ...body, appId });
    return NextResponse.json(result.body, { status: result.status });
  }

  // Mode A — Bearer JWT
  if (!bearerToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'missing_token',
        error_description:
          'Provide either Authorization: Bearer <token>, or POST with { aid, sid, skey } and ?app_id=<appId>',
      },
      { status: 400 }
    );
  }

  const result = await resolveMeFromToken(bearerToken);
  return NextResponse.json(result.body, { status: result.status });
}
