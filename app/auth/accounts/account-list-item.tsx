
"use client";

import { useEffect, useState, useTransition } from 'react';
import { getUserProfile } from '@/services/user';
import type { StoredAccount } from '@/core/auth/session';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import { AccountActions } from './account-actions';
import { switchActiveAccount, switchToBrand, switchToDependent, switchToDelegated } from '@/services/auth/switch';
import { appendAuthCallbackContext, appendRedirect } from '@/core/auth/callback';
import { redirectInApp } from '@/core/helpers/navigation';
import { cn } from '@/core/helpers/utils';

type CombinedAccount = StoredAccount & {
    displayName?: string;
    displayPhoto?: string;
    isUnknown?: boolean;
    isBrand?: boolean;
    isDependent?: boolean;
    accountType?: string;
};

export function AccountListItem({ account, isActive }: { account: CombinedAccount; isActive?: boolean }) {
    const [details, setDetails] = useState<Partial<CombinedAccount>>({
        displayName: account.displayName,
        neupId: account.nid || account.neupId,
        displayPhoto: account.displayPhoto || (account.isBrand ? 'https://neupgroup.com/assets/brand.png' : 'https://neupgroup.com/assets/user.png'),
    });
    const [loading, setLoading] = useState(true);
    const [isSwitching, startSwitchTransition] = useTransition();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirects = searchParams.get('redirects');

    const getSigninUrl = (neupId?: string) => {
        const params = new URLSearchParams();
        params.set('step', 'password');
        if (neupId) params.set('neupId', neupId);
        const baseUrl = `/auth/signin?${params.toString()}`;
        const withContext = appendAuthCallbackContext(baseUrl, searchParams);
        return appendRedirect(withContext, redirects);
    };

    useEffect(() => {
        let isMounted = true;
        async function fetchAccountDetails() {
            const accountId = account.accountId || account.aid;
            if (!accountId || account.isUnknown) {
                if (isMounted) {
                    setDetails({ isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown', displayPhoto: 'https://neupgroup.com/assets/user.png' });
                    setLoading(false);
                }
                return;
            }



            if (account.displayName) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                const profile = await getUserProfile(accountId);
                if (isMounted) {
                    setDetails({
                        displayName: profile?.nameDisplay || `Account ${accountId.substring(0, 6)}`,
                        neupId: account.nid || account.neupId || profile?.neupIdPrimary || 'N/A',
                        displayPhoto: profile?.accountPhoto || (profile?.accountType === 'brand' ? 'https://neupgroup.com/assets/brand.png' : 'https://neupgroup.com/assets/user.png'),
                    });
                }
            } catch (e) {
                if (isMounted) {
                    setDetails({ isUnknown: true, displayName: 'Error Loading', neupId: 'error', displayPhoto: 'https://neupgroup.com/assets/user.png' });
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchAccountDetails();
        return () => { isMounted = false; };
    }, [account.accountId, account.aid, account.isUnknown, account.nid, account.neupId, account.isBrand, account.displayName, account.displayPhoto]);

    const finalAccount = { ...account, ...details };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent navigation if the click is on a button inside AccountActions
        if ((e.target as HTMLElement).closest('[data-action-button]')) {
            return;
        }

        startSwitchTransition(async () => {
            const targetAccountId = finalAccount.aid || finalAccount.accountId || '';

            if (finalAccount.isBrand) {
                 const res = await switchToBrand(targetAccountId);
                 if (res.success) redirectInApp(router, redirects || '/');
                 return;
            }

            if (finalAccount.isDependent) {
                 const res = await switchToDependent(targetAccountId);
                 if (res.success) redirectInApp(router, redirects || '/');
                 return;
            }

            if (finalAccount.def === 1 && (finalAccount.sid || finalAccount.sessionId)) {
                redirectInApp(router, redirects || '/');
                return;
            }

            if (finalAccount.sid || finalAccount.sessionId) {
                const res = await switchActiveAccount(finalAccount);
                if (res.success) {
                    redirectInApp(router, redirects || '/');
                }
                return;
            }

            redirectInApp(router, getSigninUrl(finalAccount.nid || finalAccount.neupId));

            const res = await switchToDelegated(targetAccountId);
            if (res.success) redirectInApp(router, redirects || '/');
        });
    };

    if (loading) {
        return (
            <div className="flex w-full items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
                <Skeleton className="h-5 w-5" />
            </div>
        );
    }

    return (
        <div
            onClick={handleClick}
            className={cn(
                "w-full flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer",
                isActive
                    ? "bg-accent/10 border-accent hover:bg-accent/20"
                    : "hover:bg-muted/50"
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(e as any);
                }
            }}
        >
            <div className="flex items-center gap-4">
                <div>
                    <h3 className={cn("font-semibold", isActive && "text-accent")}>{finalAccount.displayName}</h3>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                            @{finalAccount.neupId}
                        </p>
                        <AccountActions account={finalAccount} />
                    </div>
                </div>
            </div>
            <ChevronRight className={cn("h-5 w-5", isActive ? "text-accent" : "text-muted-foreground")} />
        </div>
    );
}
