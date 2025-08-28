
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { clearManagingCookie } from '@/lib/cookies';
import { refreshSessionData } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
    await clearManagingCookie();
    await refreshSessionData();
    
    return NextResponse.redirect(new URL('/manage', request.url));
}
