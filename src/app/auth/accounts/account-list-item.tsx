
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUserProfile } from '@/lib/user';
import { ChevronRight } from '@/components/icons';
import type { StoredAccount } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

type CombinedAccount = StoredAccount & {
    displayName?: string;
    isUnknown?: boolean;
};

export function AccountListItem({ account }: { account: CombinedAccount }) {
    const [details, setDetails] = useState<Partial<CombinedAccount>>({
        displayName: account.displayName,
        neupId: account.neupId,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchAccountDetails() {
            if (!account.accountId || account.isUnknown) {
                if (isMounted) {
                    setDetails({ isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown' });
                    setLoading(false);
                }
                return;
            }

            try {
                const profile = await getUserProfile(account.accountId);
                if (isMounted) {
                    setDetails({
                        displayName: profile?.nameDisplay || 'Unnamed Account',
                        neupId: account.neupId || profile?.neupIdPrimary || 'N/A'
                    });
                }
            } catch (e) {
                if (isMounted) {
                    setDetails({ isUnknown: true, displayName: 'Error Loading', neupId: 'error' });
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
    }, [account.accountId, account.neupId, account.isUnknown]);

    const finalAccount = { ...account, ...details };

    if (loading) {
        return (
            <div className="flex w-full items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-5" />
            </div>
        );
    }
    
    const href = finalAccount.expired 
        ? `/auth/signin?neupId=${finalAccount.neupId}` 
        : `/auth/accounts/switch-handler?sessionId=${finalAccount.sessionId}`;

    return (
        <Link
            href={href}
            className="flex w-full items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
            <div>
                <h3 className="font-semibold">{finalAccount.displayName}</h3>
                <p className="text-sm text-muted-foreground">
                    @{finalAccount.neupId}
                    {finalAccount.expired && <span className="text-destructive ml-2">(Expired)</span>}
                </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    );
}
