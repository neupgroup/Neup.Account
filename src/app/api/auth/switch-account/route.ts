
import { NextResponse, type NextRequest } from 'next/server';
import { switchToAccount, getStoredAccounts } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.redirect(new URL('/auth/accounts?error=invalid_request', request.url));
    }
    
    const storedAccounts = await getStoredAccounts();
    const accountToSwitch = storedAccounts.find(acc => acc.sessionId === sessionId);

    if (!accountToSwitch) {
         return NextResponse.redirect(new URL('/auth/accounts?error=session_not_found', request.url));
    }

    const result = await switchToAccount(accountToSwitch);

    if (result.success) {
        const manageUrl = new URL('/manage', request.url);
        revalidatePath('/manage', 'layout');
        const response = NextResponse.redirect(manageUrl);
        return response;
    } else {
        const errorUrl = new URL('/auth/accounts', request.url);
        errorUrl.searchParams.set('error', 'switch_failed');
        if(result.error) {
            errorUrl.searchParams.set('error_description', result.error);
        }
        return NextResponse.redirect(errorUrl);
    }
}
