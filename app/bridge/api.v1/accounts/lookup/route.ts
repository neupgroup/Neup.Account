import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/core/helpers/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /bridge/api.v1/accounts/lookup
 *
 * Looks up basic public profile information for an account.
 * Pass either `accountId` or `neupId` as a query parameter.
 *
 * Query params:
 *   accountId  - the account UUID
 *   neupId     - the NeupID string (e.g. @handle)
 *
 * Response shape:
 * {
 *   success: true,
 *   account: {
 *     accountId:    string;
 *     displayName:  string | null;
 *     displayImage: string | null;
 *     accountType:  string;
 *     neupId:       string | null;
 *   }
 * }
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const accountId = searchParams.get('accountId')?.trim() || null;
    const neupId = searchParams.get('neupId')?.trim() || null;

    if (!accountId && !neupId) {
        return NextResponse.json(
            { success: false, error: 'Provide either accountId or neupId.' },
            { status: 400 }
        );
    }

    let resolvedAccountId: string | null = null;

    if (accountId) {
        resolvedAccountId = accountId;
    } else if (neupId) {
        const neupRecord = await prisma.neupId.findUnique({
            where: { id: neupId.toLowerCase() },
            select: { accountId: true },
        });
        if (!neupRecord) {
            return NextResponse.json(
                { success: false, error: 'Account not found.' },
                { status: 404 }
            );
        }
        resolvedAccountId = neupRecord.accountId;
    }

    const account = await prisma.account.findUnique({
        where: { id: resolvedAccountId! },
        select: {
            id: true,
            displayName: true,
            displayImage: true,
            accountType: true,
            neupIds: {
                select: { id: true },
                take: 1,
                orderBy: { id: 'asc' },
            },
        },
    });

    if (!account) {
        return NextResponse.json(
            { success: false, error: 'Account not found.' },
            { status: 404 }
        );
    }

    return NextResponse.json({
        success: true,
        account: {
            accountId:    account.id,
            displayName:  account.displayName,
            displayImage: account.displayImage,
            accountType:  account.accountType,
            neupId:       account.neupIds[0]?.id ?? null,
        },
    });
}
