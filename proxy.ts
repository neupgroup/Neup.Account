import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { handleAuthData } from '@/core/auth/handleAuthData';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Prepare Headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);

  // 2. Security Check
  const proto = request.headers.get('x-forwarded-proto');
  const isSecure = proto === 'https' || request.nextUrl.protocol === 'https:';
  if (!isSecure && pathname !== '/auth/unsecure') {
    return NextResponse.redirect(new URL('/auth/unsecure', request.url));
  }

  // 3. Device Block Check
  if (request.cookies.has('device_block') && pathname !== '/auth/blocked') {
    return NextResponse.redirect(new URL('/auth/blocked', request.url));
  }

  // 4. Static assets — always pass through
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 5. Entry points — /auth/* and /bridge/* do not require an existing account.
  //    /auth/start is where guest accounts are created.
  //    /bridge/* routes handle their own auth (handshake, silent SSO, API).
  if (
    pathname.startsWith('/bridge') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 6. Auth gate — all other paths go through handleAuthData
  const authResult = handleAuthData(request);

  switch (authResult.outcome) {
    case 'create_guest': {
      // No account at all — send to /auth/start to create a guest account
      const url = request.nextUrl.clone();
      url.pathname = '/auth/start';
      if (pathname !== '/') {
        url.searchParams.set('redirects', pathname + request.nextUrl.search);
      }
      return NextResponse.redirect(url);
    }

    case 'redirect': {
      // Guest account or invalid session — cannot access protected pages
      const url = request.nextUrl.clone();
      url.pathname = '/auth/start';
      if (pathname !== '/') {
        const backTo = pathname + request.nextUrl.search;
        url.searchParams.set('redirects', backTo);
        request.nextUrl.searchParams.forEach((value, key) => {
          if (key !== 'redirects') url.searchParams.set(key, value);
        });
      }
      return NextResponse.redirect(url);
    }

    case 'permit': {
      // Permanent account with valid session — let through
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
