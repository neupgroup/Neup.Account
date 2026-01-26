
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { StoredAccount } from '@/types';
import { switchActiveAccount } from '@/actions/auth/switch';
import { useToast } from '@/hooks/use-toast';
import { getActiveAccountId } from '@/lib/auth-actions';

type CombinedAccount = StoredAccount & {
    isBrand?: boolean;
};


export function SwitchAccountButton({ account }: { account: CombinedAccount }) {
    const [isActive, setIsActive] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        async function checkActive() {
            const activeId = await getActiveAccountId();
            setIsActive(account.accountId === activeId);
        }
        checkActive();
    }, [account.accountId]);

    const handleSwitch = () => {
        startTransition(async () => {
            const result = await switchActiveAccount(account);

            if (result.success) {
                toast({ title: "Success", description: "Switched account successfully." });
                sessionStorage.clear();
                router.push('/manage');
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };
    
    if (isActive) {
        return <Button variant="secondary" size="sm" disabled>Current</Button>;
    }
    
    if (account.expired) {
        return (
             <Button variant="outline" size="sm" asChild>
                <a href={`/auth/signin?neupId=${account.neupId}`}>Sign In</a>
            </Button>
        );
    }

    return (
        <Button variant="outline" size="sm" onClick={handleSwitch} disabled={isPending}>
            {isPending ? 'Switching...' : 'Switch'}
        </Button>
    );
}
