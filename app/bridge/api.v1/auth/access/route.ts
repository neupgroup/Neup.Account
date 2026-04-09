
import { NextRequest, NextResponse } from 'next/server';
import { bridgeCreateAuthAccess, bridgeGetAuthAccess, bridgeUpdateAuthAccess } from '@/services/auth/access';

export const dynamic = 'force-dynamic';

/**
 * GET /bridge/api.v1/auth/access
 * Retrieves roles, permissions, and team information for a user.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const result = await bridgeGetAuthAccess({
    aid: searchParams.get('aid'),
    sid: searchParams.get('sid'),
    skey: searchParams.get('skey'),
    appId: searchParams.get('appId'),
  });
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * POST /bridge/api.v1/auth/access
 * Adds a user to the auth team (Admin/Manager role).
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await bridgeCreateAuthAccess(body);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * PATCH /bridge/api.v1/auth/access
 * Updates roles, user permissions, or asset permissions.
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const result = await bridgeUpdateAuthAccess(body);
  return NextResponse.json(result.body, { status: result.status });
}
