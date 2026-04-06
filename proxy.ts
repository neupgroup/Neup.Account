import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Prepare Headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);

  // 2. Device Block Check
  // If the user is blocked, redirect them to /auth/blocked immediately.
  // We must allow access to /auth/blocked itself to avoid infinite loops.
  if (request.cookies.has('device_block') && pathname !== '/auth/blocked') {
    return NextResponse.redirect(new URL('/auth/blocked', request.url));
  }

  // 3. Exclusions (Static assets, etc.)
  // These are usually handled by the matcher, but explicit check is good safety.
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next({
        request: { headers: requestHeaders }
    });
  }

  // 4. Public Routes (API, Bridge, Auth, Blocked page)
  // These paths do NOT require the main session authentication check here.
  if (
    pathname.startsWith('/bridge') || 
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 5. Auth Check (existence)
  // For all other routes, check for is the auth creds exists or not.
  const hasSession = request.cookies.has('auth_session_id') && request.cookies.has('auth_session_key');
  const hasAccount = request.cookies.has('auth_account_id');

  if (!hasSession || !hasAccount) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/start';
    if (pathname !== '/') {
      const backTo = pathname + request.nextUrl.search;
      url.searchParams.set('redirects', backTo);
      request.nextUrl.searchParams.forEach((value, key) => {
        if (key !== 'redirects') {
          url.searchParams.set(key, value);
        }
      });
    }
    return NextResponse.redirect(url);
  }

  // 6. Continue
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};