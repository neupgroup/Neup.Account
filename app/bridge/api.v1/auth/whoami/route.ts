import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookies } from '@/core/helpers/cookies';
import { resolveWhoAmI } from '@/services/auth/whoami';
import prisma from '@/core/helpers/prisma';

export const dynamic = 'force-dynamic';

/**
 * Resolves the CORS origin for a given request.
 * Returns the origin if it belongs to a registered application, null otherwise.
 */
async function resolveAllowedOrigin(request: NextRequest): Promise<string | null> {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  // Check if the origin is registered as an authenticatesTo URL for any active app
  const record = await prisma.applicationBridge.findFirst({
    where: { type: 'authenticatesTo' },
    select: { value: true },
  });

  if (!record) return null;

  // Match by origin (scheme + host) rather than full URL
  const allRecords = await prisma.applicationBridge.findMany({
    where: { type: 'authenticatesTo' },
    select: { value: true },
  });

  for (const r of allRecords) {
    try {
      const registered = new URL(r.value);
      const incoming = new URL(origin);
      if (registered.origin === incoming.origin) return origin;
    } catch {
      continue;
    }
  }

  return null;
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * OPTIONS /bridge/api.v1/auth/whoami
 * Preflight handler for cross-origin requests.
 */
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = await resolveAllowedOrigin(request);
  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin) });
}

/**
 * GET /bridge/api.v1/auth/whoami
 *
 * Returns the identity of the currently logged-in NeupID user based on
 * the session cookies sent with the request (credentials: 'include').
 *
 * No secret or token required — the session cookie is the credential.
 * The requesting origin must be registered as an authenticatesTo URL for
 * any application in the system, otherwise the request is rejected.
 *
 * Response:
 * {
 *   success: true,
 *   accountId: string,
 *   neupId: string | null,
 *   displayName: string | null,
 *   displayImage: string | null,
 *   accountType: string | null,
 *   verified: boolean
 * }
 */
export async function GET(request: NextRequest) {
  const allowedOrigin = await resolveAllowedOrigin(request);

  if (!allowedOrigin) {
    return NextResponse.json(
      { error: 'forbidden', error_description: 'Origin not registered' },
      { status: 403 }
    );
  }

  const { accountId, sessionId, sessionKey } = await getSessionCookies();

  if (!accountId || !sessionId || !sessionKey) {
    return NextResponse.json(
      { error: 'unauthenticated', error_description: 'No active session' },
      { status: 401, headers: corsHeaders(allowedOrigin) }
    );
  }

  const result = await resolveWhoAmI({ accountId, sessionId, sessionKey });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: corsHeaders(allowedOrigin),
  });
}
