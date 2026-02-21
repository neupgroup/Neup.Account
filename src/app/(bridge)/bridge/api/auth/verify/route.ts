import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { getUserProfile, getUserNeupIds } from '@/lib/user';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { appId, appSecret, key, accountId } = body;

        if (!appId || !appSecret || !key || !accountId) {
            return NextResponse.json({ success: false, error: 'Missing required parameters.' }, { status: 400 });
        }

        // 1. Validate the App and App Secret
        const appRef = doc(db, 'applications', appId);
        const appDoc = await getDoc(appRef);

        if (!appDoc.exists() || appDoc.data().appSecret !== appSecret) {
            return NextResponse.json({ success: false, error: 'Invalid application ID or secret.' }, { status: 401 });
        }

        // 2. Find the user's session from any of their active sessions
        const sessions = await prisma.session.findMany({
            where: {
                accountId: accountId,
                isExpired: false
            }
        });

        if (sessions.length === 0) {
             return NextResponse.json({ success: false, error: 'No active session found for user.' }, { status: 403 });
        }
        
        let validKeyFound = false;
        let sessionIdToUpdate: string | null = null;
        let keyIndexToUpdate = -1;
        let dependentKeysToUpdate: any[] = [];

        for (const session of sessions) {
            const dependentKeys = Array.isArray(session.dependentKeys) ? session.dependentKeys : [];
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const keyIndex = dependentKeys.findIndex((k: any) => {
                const expiresOn = new Date(k.expiresOn);
                return k.key === key && 
                       k.app === appId && 
                       !k.isUsed &&
                       expiresOn > new Date();
            });

            if (keyIndex !== -1) {
                validKeyFound = true;
                sessionIdToUpdate = session.id;
                keyIndexToUpdate = keyIndex;
                dependentKeysToUpdate = dependentKeys;
                break;
            }
        }
        
        if (!validKeyFound || !sessionIdToUpdate) {
            return NextResponse.json({ success: false, error: 'Invalid or expired key.' }, { status: 403 });
        }
        
        // 3. Mark the key as used to prevent replay attacks
        dependentKeysToUpdate[keyIndexToUpdate].isUsed = true;

        await prisma.session.update({
            where: { id: sessionIdToUpdate },
            data: { dependentKeys: dependentKeysToUpdate }
        });

        // 4. Return user info to the third-party app
        const [userProfile, userNeupIds] = await Promise.all([
            getUserProfile(accountId),
            getUserNeupIds(accountId)
        ]);

        if (!userProfile) {
             return NextResponse.json({ success: false, error: 'Could not retrieve user profile.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: {
                accountId: accountId,
                displayName: userProfile?.nameDisplay || `${userProfile?.nameFirst || ''} ${userProfile?.nameLast || ''}`,
                neupId: userNeupIds[0] || null,
            },
        });

    } catch (error) {
        await logError('database', error, 'verify-key');
        return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
    }
}
