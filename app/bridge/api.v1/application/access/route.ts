import { NextResponse, type NextRequest } from 'next/server';
import { getApplicationAccess } from '@/services/bridge/application-access';

export const dynamic = 'force-dynamic';

/**
 * GET /bridge/api.v1/application/access
 *
 * Returns access grants (AuthzAppAccessGrant) for the given application —
 * who has been granted what role by whom, with capabilities denormalized
 * inline on each role.
 *
 * Auth (required):
 *   appId     — application ID
 *   appSecret — application secret
 *
 * Pagination — choose one mode:
 *   Offset:  ?start=0&end=100          (default: 0–100)
 *   Cursor:  ?startFrom=<grantId>&limit=100
 *
 * Response (200):
 * {
 *   success: true,
 *   columns: string[],
 *   data: [
 *     {
 *       grantId, status,
 *       ownerAccountId, ownerDisplayName, ownerAccountType,
 *       targetAccountId, targetDisplayName, targetAccountType,
 *       roleId, roleName, roleDescription, roleScope,
 *       capabilities: [
 *         { capabilityId, capabilityName, capabilityScope, denormalized }
 *       ],
 *       portfolioId
 *     },
 *     ...
 *   ],
 *   meta: {
 *     total: number,
 *     returned: number,
 *     startedAt: string | null,
 *     endedAt: string | null
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const result = await getApplicationAccess({
    appId:     sp.get('appId'),
    appSecret: sp.get('appSecret'),
    account:   sp.get('account'),
    start:     sp.get('start'),
    end:       sp.get('end'),
    startFrom: sp.get('startFrom'),
    limit:     sp.get('limit'),
    fromDate:  sp.get('fromDate'),
    toDate:    sp.get('toDate'),
  });

  return NextResponse.json(result.body, { status: result.status });
}
