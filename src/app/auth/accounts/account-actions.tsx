
"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logoutStoredSession, removeStoredAccount } from '@/lib/auth-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from '@/components/icons';

type Account = {
  accountId: string;
  sessionId: string;
  expired: boolean;
  isUnknown?: boolean;
}

export function AccountActions({ account }: { account: Account }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = () => {
    startTransition(async () => {
      const result = await logoutStoredSession(account.sessionId);
      if (result.success) {
        toast({ title: "Signed Out", description: "The account session has been signed out." });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

  const handleRemove = () => {
     startTransition(async () => {
      const result = await removeStoredAccount(account.accountId);
      if (result.success) {
        toast({ title: "Account Removed", description: "The account has been removed from this device." });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

  if (account.isUnknown) {
    return (
      <Button variant="outline" size="sm" onClick={handleRemove} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : 'Remove'}
      </Button>
    );
  }

  if (account.expired) {
    return (
      <Button variant="outline" size="sm" onClick={handleRemove} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : 'Remove'}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : 'Sign Out'}
    </Button>
  );
}
