import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Returns true if the current browser context is considered secure.
// HTTPS pages and secure contexts return true. Plain HTTP — including localhost — returns false.
export function isConnectionSecure(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.location.protocol === 'http:') return false;
  return window.isSecureContext;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Prepare Headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);

  // 2. Security Check
  // If the request is over HTTP (not HTTPS), redirect to /auth/unsecure.
  // Allow /auth/unsecure itself to avoid infinite loops.
  const proto = request.headers.get('x-forwarded-proto');
  const isSecure = proto === 'https' || request.nextUrl.protocol === 'https:';
  if (!isSecure && pathname !== '/auth/unsecure') {
    return NextResponse.redirect(new URL('/auth/unsecure', request.url));
  }

  // 3. Device Block Check
  // If the user is blocked, redirect them to /auth/blocked immediately.
  // We must allow access to /auth/blocked itself to avoid infinite loops.
  if (request.cookies.has('device_block') && pathname !== '/auth/blocked') {
    return NextResponse.redirect(new URL('/auth/blocked', request.url));
  }

  // 4. Exclusions (Static assets, etc.)
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

  // 5. Public Routes (API, Bridge, Auth, Blocked page)
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

  // 6. Auth Check (existence)
  // Parse auth_accounts and look for an entry with def === 1 that has sid and skey.
  const authAccountsRaw = request.cookies.get('auth_accounts')?.value;
  let hasActiveSession = false;
  if (authAccountsRaw) {
    try {
      const accounts = JSON.parse(authAccountsRaw);
      hasActiveSession = Array.isArray(accounts) &&
        accounts.length > 0 &&
        accounts.some(
          (a: any) => a?.def === 1 && a?.aid && a?.sid && a?.skey
        );
    } catch { /* invalid cookie, treat as no session */ }
  }

  if (!hasActiveSession) {
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

  // 7. Continue
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