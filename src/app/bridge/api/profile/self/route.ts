import { NextResponse, type NextRequest } from 'next/server';
import { getUserProfile, getUserContacts, getUserNeupIds } from '@/lib/user';
import { getActiveSession } from '@/lib/auth-actions';

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

        const selfProfile = {
            ...profile,
            ...contacts,
            neupId: neupIds[0] || null, // Add the primary NeupID to the response
        };

        return NextResponse.json({
            success: true,
            profile: selfProfile
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
