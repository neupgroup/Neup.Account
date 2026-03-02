import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionValue, appId } = body;

        if (!sessionValue) {
            return NextResponse.json({ success: false, error: 'sessionValue is required.' }, { status: 400 });
        }

        // 1. Expire specific App Session
        // External apps are not on same domain, they use sessionValue for their session
        const appSession = await prisma.appSession.findUnique({
            where: { sessionValue }
        });

        if (appSession) {
            // Check if it belongs to the appId if provided
            if (appId && appSession.appId !== appId) {
                 return NextResponse.json({ success: false, error: 'Unauthorized session.' }, { status: 403 });
            }

            // Delete the specific app session
            await prisma.appSession.delete({
                where: { sessionValue }
            });
        }

        return NextResponse.json({ success: true, message: 'Signed out successfully.' });

    } catch (error) {
        await logError('database', error, 'auth-signout-external');
        return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
    }
}
