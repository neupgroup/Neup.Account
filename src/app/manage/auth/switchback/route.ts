'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { clearManagingCookie } from '@/lib/cookies';
import { refreshSessionData } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
    await clearManagingCookie();
    
    return NextResponse.redirect(new URL('/manage', request.url));
}
