
import { NextRequest, NextResponse } from 'next/server';
import { bridgeCheckGrant, bridgeIssueGrant, bridgeRefreshGrant } from '@/services/auth/grant';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await bridgeIssueGrant(body);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const result = await bridgeRefreshGrant(body);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * GET /api.v1/auth/grant
 * Checks if the authentication grant is still valid.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  if (searchParams.has('appId')) {
    return NextResponse.json(
      { success: false, error: 'invalid_request', error_description: 'Use `app` (not `appId`).' },
      { status: 400 }
    );
  }
  const result = await bridgeCheckGrant({
    aid: searchParams.get('aid') ?? undefined,
    sid: searchParams.get('sid') ?? undefined,
    skey: searchParams.get('skey') ?? undefined,
    app: searchParams.get('app') ?? undefined,
  });
  return NextResponse.json(result.body, { status: result.status });
}
