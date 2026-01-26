import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    // TODO: Implement webhook handling
    return NextResponse.json({ message: 'Webhook received' }, { status: 200 });
}

export async function GET(request: Request) {
    return NextResponse.json({ message: 'Webhook endpoint' }, { status: 200 });
}
