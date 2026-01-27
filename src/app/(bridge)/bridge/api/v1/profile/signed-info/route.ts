import { NextResponse, type NextRequest } from 'next/server';
import { getUserProfile, getUserNeupIds } from '@/lib/user';
import { getActiveSession } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
    const session = await getActiveSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    try {
        const [profile, neupIds] = await Promise.all([
            getUserProfile(session.accountId),
            getUserNeupIds(session.accountId)
        ]);

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const primaryNeupId = neupIds && neupIds.length > 0 ? neupIds[0] : '';

        // Map the data to the requested format
        const responseData = {
            name: {
                firstName: profile.nameFirst || '',
                lastname: profile.nameLast || ''
            },
            username: primaryNeupId,
            photo: profile.accountPhoto || ''
        };

        return NextResponse.json(responseData);

    } catch (error) {
        await logError('database', error, 'signed-info');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
