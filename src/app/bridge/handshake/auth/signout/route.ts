
import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSessionDetails } from '@/lib/auth-actions';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';

// This endpoint logs out a user from a specific application by marking all dependent keys for that app as used.
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const postLogoutRedirectUri = searchParams.get('post_logout_redirect_uri');

    if (!appId || !postLogoutRedirectUri) {
        return NextResponse.json({ success: false, error: 'appId and post_logout_redirect_uri are required.' }, { status: 400 });
    }

    const session = await getActiveSessionDetails();
    if (!session) {
         // Not logged in, so just redirect back
        return NextResponse.redirect(postLogoutRedirectUri);
    }

    try {
        const sessionRef = doc(db, 'session', session.auth_session_id);
        const sessionDoc = await getDoc(sessionRef);

        if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data();
            const dependentKeys = sessionData.dependentKey || [];

            const updatedKeys = dependentKeys.map((k: any) => {
                if (k.app === appId) {
                    return { ...k, isUsed: true };
                }
                return k;
            });
            
            await updateDoc(sessionRef, { dependentKey: updatedKeys });
        }

        return NextResponse.redirect(postLogoutRedirectUri);

    } catch (error) {
        await logError('database', error, `app_signout for ${appId}`);
        const errorUrl = new URL(postLogoutRedirectUri);
        errorUrl.searchParams.set('error', 'signout_failed');
        return NextResponse.redirect(errorUrl);
    }
}
