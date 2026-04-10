import { NextResponse, type NextRequest } from 'next/server';
import { getEncodedUserPermissions } from '@/core/helpers/user';
import { getActiveSession } from '@/core/helpers/session';

export async function GET(request: NextRequest) {
    const session = await getActiveSession();

    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
    }

    const { encoded, publicKey } = await getEncodedUserPermissions(session.accountId);

    return NextResponse.json({
        success: true,
        permissions: encoded,
        publicKey: publicKey
    });
}
