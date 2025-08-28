import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSession } from '@/lib/session';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import crypto from 'crypto';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic'; // Ensure this route is always dynamically rendered

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const authHandlerUrlString = searchParams.get('auth_handler');

    // The auth_handler is now mandatory.
    if (!authHandlerUrlString) {
        const errorUrl = new URL('/auth/start', request.url);
        errorUrl.searchParams.set('error', 'invalid_request');
        errorUrl.searchParams.set('error_description', 'The required \'auth_handler\' parameter was not provided.');
        return NextResponse.redirect(errorUrl);
    }
    
    // Create a new URL object from the handler and copy all original params.
    const finalRedirectUrl = new URL(authHandlerUrlString);
    searchParams.forEach((value, key) => {
        // Avoid duplicating the auth_handler itself in the final URL params
        if (key !== 'auth_handler') {
            finalRedirectUrl.searchParams.set(key, value);
        }
    });

    const appId = searchParams.get('appId');
    if (!appId) {
        finalRedirectUrl.searchParams.set('error', 'missing_app_id');
        finalRedirectUrl.searchParams.set('error_description', 'An application ID (appId) must be provided.');
        return NextResponse.redirect(finalRedirectUrl);
    }

    try {
        const session = await getActiveSession();

        if (!session) {
            finalRedirectUrl.searchParams.set('error', 'unauthenticated');
            finalRedirectUrl.searchParams.set('error_description', 'No active user session found.');
            return NextResponse.redirect(finalRedirectUrl);
        }

        const dependentKey = crypto.randomBytes(32).toString('hex');
        const expiresOn = new Date();
        expiresOn.setMinutes(expiresOn.getMinutes() + 5); // Key is valid for 5 minutes

        const sessionRef = doc(db, 'session', session.sessionId);

        await updateDoc(sessionRef, {
            dependentKey: arrayUnion({
                app: appId,
                key: dependentKey,
                expiresOn: expiresOn,
                isUsed: false,
            })
        });
        
        // Append the new, secure parameters to the final URL
        finalRedirectUrl.searchParams.set('key', dependentKey);
        finalRedirectUrl.searchParams.set('session_id', session.sessionId);
        finalRedirectUrl.searchParams.set('account_id', session.accountId);
        finalRedirectUrl.searchParams.set('expiresOn', expiresOn.toISOString());
        
        return NextResponse.redirect(finalRedirectUrl);

    } catch (error) {
        await logError('database', error, 'bridge_handshake');
        finalRedirectUrl.searchParams.set('error', 'internal_server_error');
        finalRedirectUrl.searchParams.set('error_description', 'An unexpected error occurred during handshake.');
        return NextResponse.redirect(finalRedirectUrl);
    }
}
