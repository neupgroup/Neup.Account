
import { NextResponse, type NextRequest } from 'next/server';
import { getUserProfile, getUserContacts, getUserNeupIds } from '@/lib/user-actions';
import { getActiveSessionDetails } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
    const session = await getActiveSessionDetails();

    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
    }
    
    try {
        const [profile, contacts, neupIds] = await Promise.all([
            getUserProfile(session.auth_account_id),
            getUserContacts(session.auth_account_id),
            getUserNeupIds(session.auth_account_id)
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
