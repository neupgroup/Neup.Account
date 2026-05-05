import { NextResponse, type NextRequest } from 'next/server';
import { getIndividualAccountPermission } from '@/services/user';
import { getActiveSession } from '@/core/auth/verify';

export async function GET(request: NextRequest) {
    const session = await getActiveSession();

    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
    }

    const permissions = await getIndividualAccountPermission(session.accountId);

    return NextResponse.json({
        success: true,
        permissions,
    });
}
