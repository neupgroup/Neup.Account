import { NextRequest, NextResponse } from 'next/server';
import { resolveMe } from '@/services/auth/accountJwt';

export const dynamic = 'force-dynamic';

/**
 * POST /bridge/api.v1/me
 *
 * Returns full account information for the authenticated user.
 *
 * Authentication: Bearer token issued by POST /bridge/api.v1/auth/token.
 * The token must contain valid aid, sid, skey claims and the embedded
 * session must still be active in the database.
 *
 * The token is verified using the Application.appSecret for the appId
 * embedded in the JWT payload.
 *
 * Request headers:
 *   Authorization: Bearer <token>
 *
 * Optional request body (JSON):
 * {
 *   appId?: string  — hint for secret lookup (extracted from JWT if omitted)
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   account: {
 *     id:          string
 *     neupId:      string | null
 *     displayName: string | null
 *     displayImage: string | null
 *     accountType: string | null
 *     verified:    boolean
 *     status:      string | null
 *   },
 *   brandAccounts: Array<{
 *     id, displayName, displayImage, status, isVerified, accountType, capabilities
 *   }>,
 *   accessibleAccounts: Array<{
 *     id, displayName, displayImage, status, isVerified, accountType, capabilities
 *   }>
 * }
 *
 * Error responses: 400 (missing token), 401 (invalid/expired token or session),
 *                  403 (account blocked), 500
 */
export async function POST(request: NextRequest) {
  // Extract Bearer token from Authorization header
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: 'missing_token',
        error_description: 'Authorization: Bearer <token> header is required',
      },
      { status: 400 }
    );
  }

  // Optional appId hint from body
  let appId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.appId === 'string') appId = body.appId;
  } catch {
    // Body is optional — ignore parse errors
  }

  const result = await resolveMe({ token, appId });
  return NextResponse.json(result.body, { status: result.status });
}
