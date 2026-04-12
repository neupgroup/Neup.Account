"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { StoredAccount } from '@/core/helpers/session';
import { logoutStoredSession, removeStoredAccount } from "@/services/auth/switch";
import { useToast } from "@/core/hooks/use-toast";
import { Loader2 } from "@/components/icons";

export function AccountActions({ account }: { account: StoredAccount }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();
    
    if (account.isUnknown) return null;
    // If sessionId is explicitly empty string, it's a managed account (e.g. brand/dependent) from DB, not a stored session.
    if (account.sessionId === '') return null;

    const handleSignOut = () => {
        startTransition(async () => {
            if (!account.sessionId) return;
            const result = await logoutStoredSession(account.sessionId);
            if (result.success) {
                toast({ title: "Session Expired", description: "You have been signed out of this account." });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
            router.refresh();
        });
    };

    const handleRemove = () => {
        startTransition(async () => {
            const targetAccountId = account.accountId || account.aid;
            const result = await removeStoredAccount(targetAccountId);
            if (result.success) {
                toast({ title: "Account Removed", description: "The account has been removed from this device." });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
             router.refresh();
        });
    };

    return (
        <div data-action-button="true">
            <span className="text-muted-foreground">&bull;</span>
            {!account.sessionId ? (
                <Button variant="link" size="sm" onClick={handleRemove} disabled={isPending} className="p-0 h-auto ml-2 text-destructive">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
                </Button>
            ) : (
                <Button variant="link" size="sm" onClick={handleSignOut} disabled={isPending} className="p-0 h-auto ml-2 text-muted-foreground hover:text-foreground">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign Out"}
                </Button>
            )}
        </div>
    );
}