'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, AlertTriangle } from '@/components/icons';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import React from 'react';
import { useToast } from '@/core/hooks/use-toast';
import { useSecurityCheck } from '@/core/hooks/use-security-check';
import { cn } from '@/lib/utils';
import { AccountListItem } from '../accounts/account-list-item';
import type { StoredAccount } from '@/types';
import { appendAuthCallbackContext, appendRedirect, getAppDisplayName, shouldReturnToAuthStartForExternalAuthentication } from '@/lib/auth-callback';
import { redirectInApp } from '@/lib/navigation';
import { cleanupStoredSessionsAction } from '@/services/auth/cleanup-stored-sessions';

interface StartPageComponentProps {
  accounts: StoredAccount[];
  hasActiveSession: boolean;
  appName?: string | null;
}

export function StartPageComponent({ accounts, hasActiveSession, appName }: StartPageComponentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isSecure = useSecurityCheck();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const redirects = searchParams.get('redirects');

  useEffect(() => {
    void cleanupStoredSessionsAction();

    if (error === 'inactivity') {
      toast({
        variant: 'default',
        title: 'Signed Out',
        description: 'Signed Out because of Inactvity',
        className: 'bg-yellow-500 text-white border-none',
      });
    }

    if (!isSecure) {
      toast({
        variant: 'destructive',
        title: 'Insecure Conditions',
        description: 'Cant Authenticate.',
        duration: Infinity,
        dismissible: false,
      });
    }

    if (hasActiveSession && shouldReturnToAuthStartForExternalAuthentication(searchParams) && !error && isSecure) {
      redirectInApp(router, appendAuthCallbackContext('/auth/sign', searchParams), { replace: true });
      return;
    }

    if (hasActiveSession && redirects && !error && isSecure) {
      redirectInApp(router, redirects, { replace: true });
    }
  }, [error, toast, isSecure, hasActiveSession, redirects, router, searchParams]);

  const getUrlWithReturn = (baseUrl: string) => {
    const withContext = appendAuthCallbackContext(baseUrl, searchParams);
    return appendRedirect(withContext, redirects);
  };

  const displayAppName = getAppDisplayName(appName);

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <div className="flex justify-start items-center mb-4">

          </div>
          <CardTitle className="text-2xl font-headline">Get Started</CardTitle>
          <CardDescription>
            {appName ? `Continue to ${displayAppName} with your NeupAccount.` : 'Choose an option below to continue with Neup.Account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn("space-y-4", !isSecure && "pointer-events-none opacity-50")}>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>
                  {errorDescription || 'An unknown error occurred. Please try signing in again.'}
                </AlertDescription>
              </Alert>
            )}

            {hasActiveSession && (
              <Link
                href={redirects ? redirects : "/"}
                className="flex w-full items-center justify-between p-4 border rounded-lg bg-accent/10 border-accent hover:bg-accent/20 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-accent">Continue</h3>
                  <p className="text-sm text-muted-foreground">Continue with your Account you're currently signed in.</p>
                </div>
                <ChevronRight className="h-5 w-5 text-accent" />
              </Link>
            )}

            {accounts.length > 0 && (
              <div className="space-y-2">
                 {accounts.map((acc) => (
                    <AccountListItem 
                        key={acc.accountId || `unknown-${Math.random()}`} 
                        account={acc}
                    />
                ))}
              </div>
            )}

            <Link
              href={getUrlWithReturn("/auth/signin?step=neupid")}
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div>
                <h3 className="font-semibold">Sign In</h3>
                <p className="text-sm text-muted-foreground">Sign in with NeupID and continue using NeupID Group Products and Services.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href={getUrlWithReturn("/auth/signup?step=name")}
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div>
                <h3 className="font-semibold">Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up for an Neup.Account to use NeupID Group Products and Services.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href={getUrlWithReturn('/auth/forget')}
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div>
                <h3 className="font-semibold">Forget NeupID</h3>
                <p className="text-sm text-muted-foreground">
                  Can't remember your NeupID? We can help you recover your ID.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
