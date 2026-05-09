import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { handleAuthData } from '@/core/auth/handleAuthData';

export async function proxy(request: NextRequest) {
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
  if (
    pathname.startsWith('/bridge') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 6. Auth gate — verify the auth_account JWT and decide
  const authResult = await handleAuthData(request);

  switch (authResult.outcome) {
    case 'create_guest': {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/start';
      if (pathname !== '/') {
        url.searchParams.set('redirects', pathname + request.nextUrl.search);
      }
      return NextResponse.redirect(url);
    }

    case 'redirect': {
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
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
