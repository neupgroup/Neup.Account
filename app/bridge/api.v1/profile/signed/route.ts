import { NextResponse, type NextRequest } from 'next/server';
import { getUserProfile, getUserContacts, getUserNeupIds } from '@/services/user';
import { getActiveSession } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';

export async function POST(request: NextRequest) {
    const session = await getActiveSession();

    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
    }

    try {
        const [profile, contacts, neupIds] = await Promise.all([
            getUserProfile(session.accountId),
            getUserContacts(session.accountId),
            getUserNeupIds(session.accountId)
        ]);

        if (!profile) {
            return NextResponse.json({ success: false, error: 'Profile not found.' }, { status: 404 });
        }

        const primaryNeupId = neupIds && neupIds.length > 0 ? neupIds[0] : '';

        // Comprehensive profile including contacts and identity info
        const responseData = {
            ...profile,
            ...contacts,
            neupId: primaryNeupId,
            // Compatibility mapping for apps using legacy format
            name: {
                firstName: profile.nameFirst || '',
                lastname: profile.nameLast || ''
            },
            username: primaryNeupId,
            photo: profile.accountPhoto || ''
        };

        return NextResponse.json({
            success: true,
            profile: responseData
        });

    } catch (error) {
        await logError('database', error, 'signed');
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return POST(request);
}
