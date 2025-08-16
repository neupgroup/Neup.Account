

import { NextResponse, userAgent } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { device } = userAgent(request);
    const isMobile = device.type === 'mobile' || device.type === 'tablet';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-next-pathname', request.nextUrl.pathname);
    requestHeaders.set('x-is-mobile', isMobile ? 'true' : 'false');
    
    // Check for device block cookie
    if (request.cookies.has('device_block')) {
        return NextResponse.redirect(new URL('/blocked', request.url));
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        }
    });
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
