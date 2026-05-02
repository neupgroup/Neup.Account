
import { NextRequest, NextResponse } from 'next/server';
import { bridgeGetProfile } from '@/services/profile';

export const dynamic = 'force-dynamic';

/**
 * GET /api.v1/profile
 * Retrieves user profile information based on authentication.
 * Supports header-based session authentication and tempToken-based authentication.
 */
export async function GET(request: NextRequest) {
  let parsedBody: any = undefined;
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      parsedBody = await request.json();
    }
  } catch {
    parsedBody = undefined;
  }

  const result = await bridgeGetProfile({
    searchParams: request.nextUrl.searchParams,
    headers: request.headers,
    body: parsedBody,
  });

  return NextResponse.json(result.body, { status: result.status });
}
