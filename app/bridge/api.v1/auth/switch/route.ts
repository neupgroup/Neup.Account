
import { NextResponse, type NextRequest } from 'next/server';
import { switchToAccount, getStoredAccounts } from '@/core/helpers/session';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        const errorUrl = new URL('/auth/start', request.url);
        errorUrl.searchParams.set('error', 'invalid_request');
        return NextResponse.redirect(errorUrl);
    }
    
    const storedAccounts = await getStoredAccounts();
    const accountToSwitch = storedAccounts.find(acc => acc.sessionId === sessionId);

    if (!accountToSwitch) {
        const errorUrl = new URL('/auth/start', request.url);
        errorUrl.searchParams.set('error', 'session_not_found');
        return NextResponse.redirect(errorUrl);
    }

    const result = await switchToAccount(accountToSwitch);

    if (result.success) {
        const manageUrl = new URL('/', request.url);
        return NextResponse.redirect(manageUrl);
    } else {
        const errorUrl = new URL('/auth/start', request.url);
        errorUrl.searchParams.set('error', 'switch_failed');
        if(result.error) {
            errorUrl.searchParams.set('error_description', result.error);
        }
        return NextResponse.redirect(errorUrl);
    }
}
