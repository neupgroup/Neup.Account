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
 * Body: { appId, appSecret, code, codeVerifier? }
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
  let body: { appId?: string; appSecret?: string; code?: string; codeVerifier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const { appId, appSecret, code, codeVerifier } = body;

  if (!appId || !appSecret || !code) {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'appId, appSecret, and code are required' },
      { status: 400 }
    );
  }

  // 3. Delegate to service
  const result = await exchangeSilentAuthCode(appId, appSecret, code, codeVerifier);

  return NextResponse.json(result.body, { status: result.status });
}
