
import { NextResponse, type NextRequest } from 'next/server';
import { getUserProfile, getUserNeupIds } from '@/core/helpers/user-actions';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
        return NextResponse.json({ success: false, error: 'accountId is required.' }, { status: 400 });
    }
    
    try {
        const [profile, neupIds] = await Promise.all([
            getUserProfile(accountId),
            getUserNeupIds(accountId)
        ]);

        if (!profile) {
            return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
        }

        // Return only publicly safe information
        const publicProfile = {
            accountId: accountId,
            displayName: profile.displayName || `${profile.firstName} ${profile.lastName}`.trim(),
            neupId: neupIds[0] || null,
            displayPhoto: profile.displayPhoto,
        };

        return NextResponse.json({
            success: true,
            profile: publicProfile
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
