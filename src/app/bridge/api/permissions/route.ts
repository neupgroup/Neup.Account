
import { NextResponse, type NextRequest } from 'next/server';
import { getUserPermissions } from '@/lib/user-actions';
import { getActiveSessionDetails } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
    const session = await getActiveSessionDetails();

    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
    }

    const permissions = await getUserPermissions(session.auth_account_id);

    return NextResponse.json({
        success: true,
        permissions: permissions
    });
}
