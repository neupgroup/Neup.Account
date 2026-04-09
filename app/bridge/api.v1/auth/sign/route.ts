import { NextResponse, type NextRequest } from 'next/server';
import { bridgeSignIntoApplication } from '@/services/auth/sign';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const result = await bridgeSignIntoApplication(body);
    return NextResponse.json(result.body, { status: result.status });
}
