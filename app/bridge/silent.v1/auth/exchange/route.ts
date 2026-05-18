import { NextRequest, NextResponse } from 'next/server';
import { exchangeSilentAuthCode, validateSilentSsoOrigin } from '@/services/auth/silent-sso';

export const dynamic = 'force-dynamic';

/**
 * POST /bridge/silent.v1/auth/exchange
 *
 * Server-to-server endpoint. Exchanges a silent_auth_code for a verified
 * user identity. Rejects requests from browser origins (i.e., any Origin
 * header that matches a registered silentSsoOrigin).
 *
 * Body: { app, appSecret, code, codeVerifier? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Reject browser-origin requests
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin) {
    const { valid } = await validateSilentSsoOrigin(requestOrigin);
    if (valid) {
      return NextResponse.json(
        { success: false, error: 'browser_origin_forbidden' },
        { status: 403 }
      );
    }
  }

  // 2. Parse and validate body
  let body: { app?: string; appSecret?: string; code?: string; codeVerifier?: string; appId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  if (body.appId) {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Use `app` (not `appId`).' },
      { status: 400 }
    );
  }

  const { app, appSecret, code, codeVerifier } = body;

  if (!app || !appSecret || !code) {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'app, appSecret, and code are required' },
      { status: 400 }
    );
  }

  // 3. Delegate to service
  const result = await exchangeSilentAuthCode(app, appSecret, code, codeVerifier);

  return NextResponse.json(result.body, { status: result.status });
}
