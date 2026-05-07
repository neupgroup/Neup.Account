import { NextRequest, NextResponse } from 'next/server';

/**
 * Identity Track Gate
 *
 * Every request to neupgroup.com/account must have a `track` cookie.
 * The cookie is created (with a DB record) at the entry points:
 *   - /account/auth/*              (auth layout calls resolveCookies)
 *   - /account/bridge/handshake.v1/auth/grant  (handshake entry)
 *   - /account/bridge/silent.v1/*  (silent SSO iframe)
 *
 * If a request arrives at any other path without the cookie, the browser
 * hasn't been through an entry point yet — redirect to /auth/start so the
 * track gets created before anything else happens.
 *
 * Paths that are always allowed through (no cookie required):
 *   - The entry points themselves (they create the cookie)
 *   - Static assets (_next/*)
 *   - Favicon
 */

const TRACK_COOKIE = 'track';

// These paths create the track cookie — always let them through
const ENTRY_POINT_PREFIXES = [
  '/account/auth/',
  '/account/bridge/handshake.v1/',
  '/account/bridge/silent.v1/',
];

// These paths are infrastructure — never gate them
const ALWAYS_ALLOWED_PREFIXES = [
  '/account/_next/',
  '/account/favicon',
];

const AUTH_START = '/account/auth/start';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Always allow infrastructure paths
  if (ALWAYS_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Always allow entry points — they create the cookie
  if (ENTRY_POINT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For all other paths: require the track cookie
  const hasTrack = !!request.cookies.get(TRACK_COOKIE)?.value;

  if (!hasTrack) {
    // Preserve the original destination so /auth/start can redirect back
    const startUrl = new URL(AUTH_START, request.url);
    startUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(startUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match everything under /account except static files.
     * The middleware function itself handles the fine-grained allow/redirect logic.
     */
    '/account/:path*',
  ],
};
