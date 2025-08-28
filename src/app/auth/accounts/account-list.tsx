
'use client';

import type { StoredAccount } from '@/types';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AccountListItem } from './account-list-item';

type CombinedAccount = StoredAccount & {
    displayName?: string;
    neupId?: string;
    displayPhoto?: string;
    isBrand?: boolean;
    isDependent?: boolean;
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
    const [visibleCount, setVisibleCount] = useState(isPaginated ? PAGE_SIZE : accounts.length);

    useEffect(() => {
        setVisibleCount(isPaginated ? PAGE_SIZE : accounts.length);
    }, [accounts, isPaginated]);
    
    if (accounts.length === 0) {
        return null;
    }
    
    const accountsToShow = accounts.slice(0, visibleCount);
    const canShowMore = isPaginated && visibleCount < accounts.length;

    const handleShowMore = () => {
        setVisibleCount(prev => prev + PAGE_SIZE);
    }

    return (
        <div className="flex flex-col">
            <div className="divide-y divide-border">
                {accountsToShow.map((acc) => (
                    <AccountListItem 
                        key={acc.accountId || `unknown-${Math.random()}`} 
                        account={acc}
                        mode={mode} 
                    />
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
