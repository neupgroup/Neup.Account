import { NextResponse, userAgent } from 'next/server';
import type { NextRequest } from 'next/server';

const MOBILE_BREAKPOINT = 1024;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Device Detection
  const viewport = request.headers.get('x-viewport-width');
  const isMobile = viewport 
    ? parseInt(viewport, 10) < MOBILE_BREAKPOINT 
    : userAgent(request).device.type === 'mobile';

  // 2. Prepare Headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);
  requestHeaders.set('x-is-mobile', isMobile ? 'true' : 'false');

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
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 6. Auth Check
  // For all other routes (e.g. /, /manage, etc.), check for session.
  const hasSession = request.cookies.has('auth_session_id');

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/start';
    
    if (pathname !== '/') {
        url.searchParams.set('return_url', pathname + request.nextUrl.search);
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
