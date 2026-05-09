import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 5. Public Routes (Bridge, Auth pages)
  // These paths are entry points — they create the guest_acc cookie and do
  // not require it to already exist.
  if (
    pathname.startsWith('/bridge') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 6. Guest Account Check
  // Every protected page requires a `guest_acc` cookie. This cookie holds
  // the guest account ID created when the user first visits any /auth/* page
  // or goes through the handshake/silent SSO entry points.
  //
  // If the cookie is missing the user has never been through an entry point —
  // redirect to /auth/start where a guest account will be created automatically.
  const hasGuestAcc = !!request.cookies.get('guest_acc')?.value;
  if (!hasGuestAcc) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/start';
    if (pathname !== '/') {
      url.searchParams.set('redirects', pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(url);
  }

  // 7. Auth Check
  // Parse auth_acc and look for an entry with def === 1 that has aid, sid, skey.
  const authAccRaw = request.cookies.get('auth_acc')?.value;
  let hasActiveSession = false;
  if (authAccRaw) {
    try {
      const accounts = JSON.parse(authAccRaw);
      hasActiveSession =
        Array.isArray(accounts) &&
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

  // 8. Continue
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
