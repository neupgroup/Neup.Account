
"use client";

import { useEffect, useState, useTransition } from 'react';
import { getUserProfile } from '@/lib/user';
import type { StoredAccount } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import { AccountActions } from './account-actions';
import { switchToBrand, switchToDependent, switchToDelegated, switchToAccount } from '@/lib/session';
import { redirectInApp } from '@/lib/navigation';

type CombinedAccount = StoredAccount & {
    displayName?: string;
    displayPhoto?: string;
    isUnknown?: boolean;
    isBrand?: boolean;
    isDependent?: boolean;
    accountType?: string;
};

export function AccountListItem({ account }: { account: CombinedAccount }) {
    const [details, setDetails] = useState<Partial<CombinedAccount>>({
        displayName: account.displayName,
        neupId: account.neupId,
        displayPhoto: account.isBrand ? 'https://neupgroup.com/assets/brand.png' : 'https://neupgroup.com/assets/user.png',
    });
    const [loading, setLoading] = useState(true);
    const [isSwitching, startSwitchTransition] = useTransition();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirects = searchParams.get('redirects');

    useEffect(() => {
        let isMounted = true;
        async function fetchAccountDetails() {
            if (!account.accountId || account.isUnknown) {
                if (isMounted) {
                    setDetails({ isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown', displayPhoto: 'https://neupgroup.com/assets/user.png' });
                    setLoading(false);
                }
                return;
            }

            // If we already have details passed in (e.g. from getAccessibleAccounts), use them and skip fetch
            if (account.displayName && account.displayPhoto && !account.isUnknown) {
                 if (isMounted) {
                    setLoading(false);
                }
                return;
            }

            try {
                const profile = await getUserProfile(account.accountId);
                if (isMounted) {
                    setDetails({
                        displayName: profile?.nameDisplay || `Account ${account.accountId.substring(0,6)}`,
                        neupId: account.neupId || profile?.neupIdPrimary || 'N/A',
                        displayPhoto: profile?.accountPhoto || (profile?.accountType === 'brand' ? 'https://neupgroup.com/assets/brand.png' : 'https://neupgroup.com/assets/user.png'),
                    });
                }
            } catch (e) {
                if (isMounted) {
                    setDetails({ isUnknown: true, displayName: 'Error Loading', neupId: 'error', displayPhoto: 'https://neupgroup.com/assets/user.png' });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchAccountDetails();
        return () => {
            isMounted = false;
        };
    }, [account.accountId, account.isUnknown, account.neupId, account.isBrand, account.displayName, account.displayPhoto]);

    const finalAccount = { ...account, ...details };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent navigation if the click is on a button inside AccountActions
        if ((e.target as HTMLElement).closest('[data-action-button]')) {
            return;
        }

        startSwitchTransition(async () => {
            if (finalAccount.isBrand) {
                 const res = await switchToBrand(finalAccount.accountId);
                 if (res.success) {
                    if (redirects) redirectInApp(router, redirects);
                    else router.refresh();
                 }
            } else if (finalAccount.isDependent) {
                 const res = await switchToDependent(finalAccount.accountId);
                 if (res.success) {
                    if (redirects) redirectInApp(router, redirects);
                    else router.refresh();
                 }
            } else if (finalAccount.sessionId) {
                if (finalAccount.expired) {
                    redirectInApp(router, `/auth/signin?neupId=${finalAccount.neupId}`);
                } else {
                    const res = await switchToAccount(finalAccount);
                    if (res.success) {
                        redirectInApp(router, redirects || '/');
                    }
                }
            } else {
                // If sessionId is undefined, it means it's a signed-out personal account
                if (finalAccount.sessionId === undefined) {
                     redirectInApp(router, `/auth/signin?neupId=${finalAccount.neupId}`);
                } else {
                    // If sessionId is empty string (''), it's a managed/delegated account
                     const res = await switchToDelegated(finalAccount.accountId);
                     if (res.success) {
                        if (redirects) redirectInApp(router, redirects);
                        else router.refresh();
                     }
                }
            }
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
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
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
                    <h3 className="font-semibold">{finalAccount.displayName}</h3>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                            @{finalAccount.neupId}
                        </p>
                        <AccountActions account={finalAccount} />
                    </div>
                </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
    );
}
