import { NextResponse, type NextRequest } from 'next/server';
import { getApplicationUsers } from '@/services/bridge/application-users';
import { validateSilentSsoOrigin } from '@/services/auth/silent-sso';

export const dynamic = 'force-dynamic';

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

async function resolveRequestOrigin(request: NextRequest): Promise<string | null> {
  const origin = request.headers.get('origin');
  if (origin) return origin;

  const referer = request.headers.get('referer');
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export async function OPTIONS(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const appId = sp.get('appId')?.trim() || '';
  const origin = await resolveRequestOrigin(request);

  // If this is a browser-origin request, only allow it from a registered Silent SSO Origin.
  if (origin && appId) {
    const { valid, appId: originAppId } = await validateSilentSsoOrigin(origin);
    if (valid && originAppId === appId) {
      return new NextResponse(null, { status: 204, headers: corsHeaders(new URL(origin).origin) });
    }
  }

  // If there's no Origin header, treat it as non-browser (server-to-server) and no CORS needed.
  return new NextResponse(null, { status: 204 });
}

/**
 * GET /bridge/api.v1/application/users
 *
 * Returns accounts (users) that have connected to the given application,
 * with their profile data.
 *
 * Auth (required):
 *   appId     — application ID
 *   appSecret — application secret
 *
 * Pagination — choose one mode:
 *   Offset:  ?start=0&end=100          (default: 0–100)
 *   Cursor:  ?startFrom=<connectionId>&limit=100
 *
 * Date filter (optional, filters on connectedAt):
 *   ?fromDate=2025-01-01&toDate=2026-01-01
 *
 * Response (200):
 * {
 *   success: true,
 *   columns: string[],
 *   data: [
 *     {
 *       connectionId, accountId, neupId, displayName, displayImage,
 *       accountType, isVerified, accountCreatedAt, connectedAt, connectionStatus
 *     },
 *     ...
 *   ],
 *   meta: {
 *     total: number,       — total matching rows in DB
 *     returned: number,    — rows in this response
 *     startedAt: string,   — id of first row (use as next startFrom)
 *     endedAt: string      — id of last row (use as next startFrom)
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const appId = sp.get('appId')?.trim() || '';
  const origin = await resolveRequestOrigin(request);

  // If called from a browser origin, require that origin to be registered as a Silent SSO Origin for this app.
  if (origin && appId) {
    const { valid, appId: originAppId } = await validateSilentSsoOrigin(origin);
    if (!valid || originAppId !== appId) {
      return NextResponse.json(
        { success: false, error: 'forbidden', error_description: 'Origin not registered for this app.' },
        { status: 403 }
      );
    }
  }

  const result = await getApplicationUsers({
    appId,
    appSecret: sp.get('appSecret'),
    start:     sp.get('start'),
    end:       sp.get('end'),
    startFrom: sp.get('startFrom'),
    limit:     sp.get('limit'),
    fromDate:  sp.get('fromDate'),
    toDate:    sp.get('toDate'),
  });

  const headers = origin ? corsHeaders(new URL(origin).origin) : undefined;
  return NextResponse.json(result.body, { status: result.status, headers });
}
