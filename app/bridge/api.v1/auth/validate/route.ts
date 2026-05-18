import { NextRequest, NextResponse } from 'next/server';
import { bridgeValidateToken } from '@/services/auth/bridgeToken';

export const dynamic = 'force-dynamic';

/**
 * POST /bridge/api.v1/auth/validate
 *
 * Validates an auth token.
 *
 * - If `?app=` is provided: treats `token` as an external-app HS256 JWT signed with Application.appSecret.
 * - If `?app=` is omitted: treats `token` as the base account RS256 auth_account token (first-party).
 *
 * Body: { token }
 */
export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.has('appId')) {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Use `app` (not `appId`).' },
      { status: 400 }
    );
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const result = await bridgeValidateToken({
    token: body.token,
    app: sp.get('app') ?? undefined,
  });

  return NextResponse.json(result.body, { status: result.status });
}
