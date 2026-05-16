import { NextResponse, type NextRequest } from 'next/server';
import { getApplicationUsers } from '@/services/bridge/application-users';

export const dynamic = 'force-dynamic';

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

  const result = await getApplicationUsers({
    appId:     sp.get('appId'),
    appSecret: sp.get('appSecret'),
    start:     sp.get('start'),
    end:       sp.get('end'),
    startFrom: sp.get('startFrom'),
    limit:     sp.get('limit'),
    fromDate:  sp.get('fromDate'),
    toDate:    sp.get('toDate'),
  });

  return NextResponse.json(result.body, { status: result.status });
}
