import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { validateExternalRequest } from '@/services/auth/validate';
import { getUserProfile } from '@/core/helpers/user';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { appId, appType } = body;

        if (!appId) {
            return NextResponse.json({ success: false, error: 'appId is required.' }, { status: 400 });
        }

        // 1. Validate the session/credentials using existing logic
        // We pass the body to validateExternalRequest which handles internal/external/fast logic
        const validation = await validateExternalRequest(body);
        if (!validation.success) {
            return NextResponse.json({ success: false, error: validation.error }, { status: validation.status ?? 401 });
        }

        const { accountId } = validation.user;

        // 2. Check/Create AppAuthentication
        let appAuth = await prisma.appAuthentication.findUnique({
            where: {
                appId_accountId: {
                    appId,
                    accountId,
                }
            }
        });

        let isNewSignup = false;
        if (!appAuth) {
            appAuth = await prisma.appAuthentication.create({
                data: {
                    appId,
                    accountId,
                    permissions: [], // Default empty permissions
                }
            });
            isNewSignup = true;
        }

        // 3. Get User Profile for response
        const profile = await getUserProfile(accountId);
        if (!profile) {
            return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
        }

        const responseData: any = {
            success: true,
            accountId,
            displayName: profile.nameDisplay || `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim(),
            displayImage: profile.accountPhoto || '',
            permissions: appAuth.permissions,
            isNewSignup,
        };

        // 4. Handle External App Session (appSessions table)
        // External apps are not on the same domain and need a specific session mapping
        if (appType === 'external') {
              const authSid = body?.auth_sid || body?.auth_session_id;
            
              if (!authSid) {
                  return NextResponse.json({ success: false, error: 'auth_sid is required for external apps.' }, { status: 400 });
            }

            // Generate a unique sessionValue for the external app
            const sessionValue = randomBytes(32).toString('hex');
            const activeTill = new Date();
            activeTill.setDate(activeTill.getDate() + 30); // 30 days default

            const appSession = await prisma.appSession.create({
                data: {
                    accountId,
                    appId,
                    sessionId: authSid,
                    sessionValue,
                    activeTill,
                }
            });

            responseData.sessionValue = sessionValue;
            responseData.activeTill = activeTill.toISOString();
        }

        return NextResponse.json(responseData);

    } catch (error) {
        await logError('database', error, 'auth-sign');
        return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
    }
}
