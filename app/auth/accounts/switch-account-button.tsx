
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { StoredAccount } from '@/core/auth/session';
import { switchActiveAccount } from '@/services/auth/switch';
import { useToast } from '@/core/hooks/use-toast';
import { getActiveAccountId } from '@/core/auth/session';
import { redirectInApp } from '@/services/navigation';

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
            setIsActive(account.aid === activeId);
        }
        checkActive();
    }, [account.aid]);

    const handleSwitch = () => {
        startTransition(async () => {
            const result = await switchActiveAccount(account);

            if (result.success) {
                toast({ title: "Success", description: "Switched account successfully." });
                sessionStorage.clear();
                redirectInApp(router, '/');
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };
    
    if (isActive) {
        return <Button variant="secondary" size="sm" disabled>Current</Button>;
    }
    
    if (!account.sid) {
        return (
             <Button variant="outline" size="sm" asChild>
                <a href={`/auth/signin?step=password&neupId=${account.nid || account.neupId}`}>Sign In</a>
            </Button>
        );
    }

    return (
        <Button variant="outline" size="sm" onClick={handleSwitch} disabled={isPending}>
            {isPending ? 'Switching...' : 'Switch'}
        </Button>
    );
}
