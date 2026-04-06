
import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSession } from '@/core/helpers/auth-actions';
import crypto from 'crypto';
import { logError } from '@/core/helpers/logger';
import prisma from '@/core/helpers/prisma';

export const dynamic = 'force-dynamic'; // Ensure this route is always dynamically rendered

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const redirectsTo = searchParams.get('redirectsTo');
    const appId = searchParams.get('appId');

    // redirectsTo is now mandatory.
    if (!redirectsTo) {
        const errorUrl = new URL('/auth/start', request.url);
        errorUrl.searchParams.set('error', 'invalid_request');
        errorUrl.searchParams.set('error_description', 'The required "redirectsTo" parameter was not provided.');
        return NextResponse.redirect(errorUrl);
    }
    
    // Create a new URL object from the handler and copy all original params.
    const finalRedirectUrl = new URL(redirectsTo);
    searchParams.forEach((value, key) => {
        // Avoid duplicating redirectsTo and appId in the final URL params initially
        if (key !== 'redirectsTo' && key !== 'appId') {
            finalRedirectUrl.searchParams.set(key, value);
        }
    });

    if (!appId) {
        finalRedirectUrl.searchParams.set('error', 'missing_app_id');
        finalRedirectUrl.searchParams.set('error_description', 'An application ID (appId) must be provided.');
        return NextResponse.redirect(finalRedirectUrl);
    }
    
    try {
        // In a real scenario, you'd decode/validate the appId from a public key here if needed.
        // For now, we continue with the existing appId validation logic.
        
        // --- Security Check ---
        const application = await prisma.application.findUnique({
            where: { id: appId }
        });

        if (!application || !application.appSecret) {
            finalRedirectUrl.searchParams.set('error', 'invalid_app');
            finalRedirectUrl.searchParams.set('error_description', 'The provided application ID is invalid or not fully configured.');
            return NextResponse.redirect(finalRedirectUrl);
        }

        const session = await getActiveSession();

        if (!session) {
            const backTo = request.nextUrl.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
            const signInUrl = new URL('/auth/start', request.url);
            signInUrl.searchParams.set('redirects', backTo);
            searchParams.forEach((value, key) => {
                if (key !== 'redirects') {
                    signInUrl.searchParams.set(key, value);
                }
            });
            return NextResponse.redirect(signInUrl);
        }

        const tempToken = crypto.randomBytes(32).toString('hex');
        const expiresOn = new Date();
        expiresOn.setMinutes(expiresOn.getMinutes() + 5); // Token is valid for 5 minutes

        // Fetch existing keys first
        const currentSession = await prisma.session.findUnique({
            where: { id: session.sessionId },
            select: { dependentKeys: true }
        });

        const existingKeys = Array.isArray(currentSession?.dependentKeys) ? currentSession.dependentKeys : [];

        const newKeyEntry = {
            app: appId,
            key: tempToken,
            expiresOn: expiresOn,
            isUsed: false,
        };

        // Update with new key added
        await prisma.session.update({
            where: { id: session.sessionId },
            data: {
                dependentKeys: [...existingKeys, newKeyEntry]
            }
        });
        
        // Check if user is new for this app to determine authType
        const appAuth = await prisma.appAuthentication.findUnique({
            where: {
                appId_accountId: {
                    appId,
                    accountId: session.accountId,
                }
            }
        });

        const authType = appAuth ? 'signin' : 'signup';

        // Append the new, secure parameters to the final URL
        finalRedirectUrl.searchParams.set('tempToken', tempToken);
        finalRedirectUrl.searchParams.set('authType', authType);
        
        return NextResponse.redirect(finalRedirectUrl);

    } catch (error) {
        await logError('database', error, 'bridge_handshake');
        finalRedirectUrl.searchParams.set('error', 'internal_server_error');
        finalRedirectUrl.searchParams.set('error_description', 'An unexpected error occurred during handshake.');
        return NextResponse.redirect(finalRedirectUrl);
    }
}
