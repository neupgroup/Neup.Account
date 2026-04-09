import { NextResponse, type NextRequest } from 'next/server';
import { bridgeSignoutExternalSession } from '@/services/auth/signout';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const result = await bridgeSignoutExternalSession(body);
    return NextResponse.json(result.body, { status: result.status });
}
