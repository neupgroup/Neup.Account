import { NextResponse, type NextRequest } from 'next/server';
import { bridgeBuildGrantRedirect } from '@/services/auth/handshake';
import { resolveCookies } from '@/services/auth/resolveCookies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Ensure the track cookie + IdentityTrack DB record exist.
  // The handshake grant is the entry point for redirect-based auth flows,
  // so this is where external apps first send users to neupgroup.com.
  await resolveCookies(null);

  const result = await bridgeBuildGrantRedirect({
    requestUrl: request.url,
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
  });

  return NextResponse.redirect(new URL(result.redirectTo));
}
