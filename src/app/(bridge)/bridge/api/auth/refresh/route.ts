import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSession } from '@/lib/auth-actions';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const session = await getActiveSession();

        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
        }

        const sessionRef = doc(db, 'session', session.sessionId);

        const newExpiresOn = new Date();
        newExpiresOn.setDate(newExpiresOn.getDate() + 30); // Extend by 30 days

        await updateDoc(sessionRef, {
            expiresOn: Timestamp.fromDate(newExpiresOn)
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
