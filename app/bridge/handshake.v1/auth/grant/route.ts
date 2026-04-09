
import { NextResponse, type NextRequest } from 'next/server';
import { bridgeBuildGrantRedirect } from '@/services/auth/handshake';

export const dynamic = 'force-dynamic'; // Ensure this route is always dynamically rendered

export async function GET(request: NextRequest) {
    const result = await bridgeBuildGrantRedirect({
        requestUrl: request.url,
        pathname: request.nextUrl.pathname,
        searchParams: request.nextUrl.searchParams,
    });

    return NextResponse.redirect(new URL(result.redirectTo));
}
