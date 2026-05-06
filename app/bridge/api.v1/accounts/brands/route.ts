import { NextResponse, type NextRequest } from 'next/server';
import { getActiveSession } from '@/core/auth/verify';
import { getAccessableBrandAccountsWithCapabilities } from '@/services/manage/accounts';

export const dynamic = 'force-dynamic';

/**
 * GET /bridge/api.v1/accounts/brands
 *
 * Returns only the brand and branch accounts the authenticated user
 * has been granted access to (accountType: 'brand' | 'branch').
 * Each account includes the capabilities the caller holds on it.
 *
 * Response shape:
 * {
 *   success: true,
 *   accounts: Array<{
 *     id: string;
 *     displayName: string | null;
 *     displayImage: string | null;
 *     status: string | null;
 *     isVerified: boolean;
 *     accountType: string;
 *     capabilities: string[];
 *   }>
 * }
 */
export async function GET(_request: NextRequest) {
    const session = await getActiveSession();

    if (!session) {
        return NextResponse.json(
            { success: false, error: 'Unauthenticated.' },
            { status: 401 }
        );
    }

    const accounts = await getAccessableBrandAccountsWithCapabilities(session.accountId);

    return NextResponse.json({
        success: true,
        accounts,
    });
}
