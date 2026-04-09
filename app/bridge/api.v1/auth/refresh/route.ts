import { NextResponse, type NextRequest } from 'next/server';
import { bridgeRefreshSessionExpiry } from '@/services/auth/session';

export async function POST(request: NextRequest) {
    const result = await bridgeRefreshSessionExpiry();
    return NextResponse.json(result.body, { status: result.status });
}
