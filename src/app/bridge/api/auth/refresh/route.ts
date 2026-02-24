import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSession } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await getActiveSession();

        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
        }

        const newExpiresOn = new Date();
        newExpiresOn.setDate(newExpiresOn.getDate() + 30); // Extend by 30 days

        await prisma.session.update({
            where: { id: session.sessionId },
            data: { expiresOn: newExpiresOn }
        });

        return NextResponse.json({ 
            success: true, 
            newExpiresOn: newExpiresOn.toISOString() 
        });

    } catch (error) {
        await logError('database', error, 'refresh_token');
        return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
    }
}
