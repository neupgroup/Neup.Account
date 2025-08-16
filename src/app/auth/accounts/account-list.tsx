
'use client';

import type { StoredAccount } from '@/lib/auth-actions';
import { getUserProfile, getUserNeupIds } from '@/lib/user-actions';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AccountActions } from './account-actions';


type CombinedAccount = StoredAccount & {
    displayName?: string;
    neupId?: string;
    displayPhoto?: string;
    isBrand?: boolean;
    plan?: string;
    isUnknown?: boolean;
};

const PAGE_SIZE = 10;

export function AccountList({ 
    accounts, 
    mode = 'link',
    isPaginated = false 
}: { 
    accounts: CombinedAccount[], 
    mode?: 'link' | 'switch',
    isPaginated?: boolean
}) {
    const [accountsWithDetails, setAccountsWithDetails] = useState<CombinedAccount[]>(accounts);
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(isPaginated ? PAGE_SIZE : accounts.length);

    useEffect(() => {
        setVisibleCount(isPaginated ? PAGE_SIZE : accounts.length);
    }, [accounts, isPaginated]);

    useEffect(() => {
        async function fetchAccountDetails() {
            setLoading(true);
            const detailedAccounts = await Promise.all(
                accounts.map(async (acc) => {
                    if (acc.isBrand) {
                        return acc;
                    }

                    if (!acc.accountId) {
                        return { ...acc, isUnknown: true };
                    }
                    
                    try {
                        const [profile, neupIds] = await Promise.all([
                            getUserProfile(acc.accountId),
                            getUserNeupIds(acc.accountId)
                        ]);

                        if (!profile) {
                             return { ...acc, isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown' };
                        }

                        return {
                            ...acc,
                            displayName: profile?.displayName || `${profile?.firstName} ${profile?.lastName}`,
                            neupId: neupIds[0] || 'N/A',
                            displayPhoto: profile?.displayPhoto
                        };
                    } catch (e) {
                        return { ...acc, isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown' };
                    }
                })
            );
            setAccountsWithDetails(detailedAccounts);
            setLoading(false);
        }

        if (accounts.length > 0) {
            fetchAccountDetails();
        } else {
            setLoading(false);
        }
    }, [accounts]);
    
    if (loading) {
        return (
            <div className="space-y-4 p-4">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                           <Skeleton className="h-4 w-32" />
                           <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }
    
    if (accountsWithDetails.length === 0) {
        return <p className="text-center text-sm text-muted-foreground py-4">No other accounts found.</p>
    }
    
    const accountsToShow = accountsWithDetails.slice(0, visibleCount);
    const canShowMore = isPaginated && visibleCount < accountsWithDetails.length;

    const handleShowMore = () => {
        setVisibleCount(prev => prev + PAGE_SIZE);
    }
    
    const AccountItem = ({ acc }: { acc: CombinedAccount }) => {
        const itemContent = (
             <div className="flex items-center gap-4 p-4">
                <Avatar>
                    <AvatarImage src={acc.displayPhoto} data-ai-hint={acc.isBrand ? 'logo' : 'person'} />
                    <AvatarFallback>{acc.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                     {acc.expired && !acc.isUnknown && <Badge variant="secondary" className="text-xs font-normal mb-1">Signed out</Badge>}
                    {acc.isUnknown && <Badge variant="secondary" className="text-xs font-normal mb-1">Signed out</Badge>}
                    <p className="font-semibold">{acc.displayName || 'Unknown Account'}</p>
                    <p className="text-sm text-muted-foreground">{acc.neupId || acc.plan || 'unknown'}</p>
                </div>
                {mode === 'link' && <AccountActions account={acc} />}
            </div>
        );

        if (mode === 'link' && !acc.isUnknown && !acc.expired) {
            return (
                <Link href={`/auth/signin?neupId=${acc.neupId}`} className="block group rounded-lg hover:bg-muted/50 transition-colors">
                    {itemContent}
                </Link>
            )
        }
        
        return <div className="group rounded-lg hover:bg-muted/50 transition-colors">{itemContent}</div>;
    };


    return (
        <div className="flex flex-col">
            <div className="divide-y divide-border">
                {accountsToShow.map((acc) => (
                    <AccountItem key={acc.accountId || `unknown-${Math.random()}`} acc={acc} />
                ))}
            </div>
            {canShowMore && (
                 <div className="p-4 border-t">
                    <Button variant="outline" className="w-full" onClick={handleShowMore}>
                        Show More
                    </Button>
                </div>
            )}
        </div>
    );
}
