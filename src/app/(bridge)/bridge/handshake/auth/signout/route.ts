import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSession } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import prisma from '@/lib/prisma';

// This endpoint logs out a user from a specific application by marking all dependent keys for that app as used.
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const postLogoutRedirectUri = searchParams.get('post_logout_redirect_uri');

    if (!appId || !postLogoutRedirectUri) {
        return NextResponse.json({ success: false, error: 'appId and post_logout_redirect_uri are required.' }, { status: 400 });
    }

    try {
        const session = await getActiveSession();
        if (!session) {
             // Not logged in, so just redirect back
            return NextResponse.redirect(postLogoutRedirectUri);
        }

        const currentSession = await prisma.session.findUnique({
            where: { id: session.sessionId },
            select: { dependentKeys: true }
        });

        if (currentSession) {
            const dependentKeys = Array.isArray(currentSession.dependentKeys) ? currentSession.dependentKeys : [];

            const updatedKeys = dependentKeys.map((k: any) => {
                if (k.app === appId) {
                    return { ...k, isUsed: true };
                }
                return k;
            });
            
            await prisma.session.update({
                where: { id: session.sessionId },
                data: { dependentKeys: updatedKeys }
            });
        }

        return NextResponse.redirect(postLogoutRedirectUri);

    } catch (error) {
        await logError('database', error, `app_signout for ${appId}`);
        const errorUrl = new URL(postLogoutRedirectUri);
        errorUrl.searchParams.set('error', 'signout_failed');
        return NextResponse.redirect(errorUrl);
    }
}
