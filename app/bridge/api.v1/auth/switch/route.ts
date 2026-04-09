
import { NextResponse, type NextRequest } from 'next/server';
import { bridgeSwitchAccountBySessionId } from '@/services/auth/switch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    const result = await bridgeSwitchAccountBySessionId({
        requestUrl: request.url,
        sessionId,
    });

    return NextResponse.redirect(new URL(result.redirectTo));
}
