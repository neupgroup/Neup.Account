import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, DocumentReference, DocumentData } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { getUserProfile, getUserNeupIds } from '@/lib/user';

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
        const sessionRef = collection(db, 'session');
        const q = query(sessionRef, where('accountId', '==', accountId), where('isExpired', '==', false));
        const sessionSnapshot = await getDocs(q);

        if (sessionSnapshot.empty) {
             return NextResponse.json({ success: false, error: 'No active session found for user.' }, { status: 403 });
        }
        
        let validKeyFound = false;
        let sessionDocToUpdate: DocumentReference<DocumentData> | null = null;
        let keyIndexToUpdate = -1;

        for (const sessionDoc of sessionSnapshot.docs) {
            const sessionData = sessionDoc.data();
            const dependentKeys = sessionData.dependentKey || [];
            
            const keyIndex = dependentKeys.findIndex((k: any) => 
                k.key === key && 
                k.app === appId && 
                !k.isUsed &&
                k.expiresOn.toDate() > new Date()
            );

            if (keyIndex !== -1) {
                validKeyFound = true;
                sessionDocToUpdate = sessionDoc.ref;
                keyIndexToUpdate = keyIndex;
                break;
            }
        }
        
        if (!validKeyFound || !sessionDocToUpdate) {
            return NextResponse.json({ success: false, error: 'Invalid or expired key.' }, { status: 403 });
        }
        
        // 3. Mark the key as used to prevent replay attacks
        const sessionToUpdateDoc = await getDoc(sessionDocToUpdate);
        const sessionData = sessionToUpdateDoc.data();
        if (!sessionData || !sessionData.dependentKey) {
            return NextResponse.json({ success: false, error: 'Session data or dependent key not found.' }, { status: 500 });
        }
        
        const dependentKeys = sessionData.dependentKey;
        dependentKeys[keyIndexToUpdate].isUsed = true;

        await updateDoc(sessionDocToUpdate, { dependentKey: dependentKeys });

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
                displayName: userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}`,
                neupId: userNeupIds[0] || null,
            },
        });

    } catch (error) {
        await logError('database', error, 'verify-key');
        return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
    }
}
