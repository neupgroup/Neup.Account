import { NextResponse, type NextRequest } from 'next/server';
import { getUserPermissions } from '@/services/user';
import { getActiveSession } from '@/core/auth/verify';

export async function GET(request: NextRequest) {
    const session = await getActiveSession();

    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
    }

    const permissions = await getUserPermissions(session.accountId);

    return NextResponse.json({
        success: true,
        permissions,
    });
}
