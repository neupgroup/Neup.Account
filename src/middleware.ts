

import { NextResponse, userAgent } from 'next/server';
import type { NextRequest } from 'next/server';

const MOBILE_BREAKPOINT = 1024;

export async function middleware(request: NextRequest) {
    const viewport = request.headers.get('x-viewport-width');
    const isMobile = viewport ? parseInt(viewport, 10) < MOBILE_BREAKPOINT : userAgent(request).device.type === 'mobile';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-next-pathname', request.nextUrl.pathname);
    requestHeaders.set('x-is-mobile', isMobile ? 'true' : 'false');
    
    // Check for device block cookie
    if (request.cookies.has('device_block')) {
        return NextResponse.redirect(new URL('/blocked', request.url));
    }
    
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        }
    });

    // Pass the current URL to the server components via a cookie
    // This is useful for layouts to know the current path.
    if(request.nextUrl.pathname) {
        response.cookies.set('next-url', request.nextUrl.pathname);
    }

    return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known/genkit (Genkit dev UI)
     * - blocked (the blocked page itself)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.well-known/genkit|blocked).*)',
  ],
};
