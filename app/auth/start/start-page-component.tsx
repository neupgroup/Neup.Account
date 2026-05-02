'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, AlertTriangle } from '@/components/icons';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import React from 'react';
import { useToast } from '@/core/hooks/use-toast';
import { useSecurityCheck } from '@/core/hooks/use-security-check';
import { cn } from '@/core/helpers/utils';
import { AccountListItem } from '../accounts/account-list-item';
import type { StoredAccount } from '@/core/auth/session';
import { appendAuthCallbackContext, appendRedirect, getAppDisplayName, shouldReturnToAuthStartForExternalAuthentication } from '@/core/auth/callback';
import { redirectInApp } from '@/core/helpers/navigation';
import { cleanupExpiredStoredSessions } from '@/core/auth/session';

interface StartPageComponentProps {
  accounts: StoredAccount[];
  hasActiveSession: boolean;
  appName?: string | null;
}

function isSafeRedirectTarget(target: string) {
  if (!target) return false;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target) || target.startsWith('//')) return false;
  return target.startsWith('/') || target.startsWith('?');
}

export function StartPageComponent({ accounts, hasActiveSession, appName }: StartPageComponentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const isSecure = useSecurityCheck();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const redirects = searchParams.get('redirects');
  const didRedirectRef = useRef(false);
  const visibleAccounts = accounts.filter((account) => Boolean(account.aid) && !account.isUnknown);

  useEffect(() => {
    void cleanupExpiredStoredSessions();
  }, []);

  useEffect(() => {
    if (error === 'inactivity') {
      toastRef.current({
        variant: 'default',
        title: 'Signed Out',
        description: 'Signed Out because of Inactvity',
        className: 'bg-yellow-500 text-white border-none',
      });
    }

    if (!isSecure) {
      toastRef.current({
        variant: 'destructive',
        title: 'Insecure Conditions',
        description: 'Cant Authenticate.',
        duration: Infinity,
        dismissible: false,
      });
    }

    if (didRedirectRef.current) return;

    if (hasActiveSession && !error && isSecure) {
      const preferredTarget =
        redirects && isSafeRedirectTarget(redirects)
          ? redirects
          : shouldReturnToAuthStartForExternalAuthentication(searchParams)
            ? appendAuthCallbackContext('/auth/sign', searchParams)
            : null;

      if (preferredTarget && typeof window !== 'undefined') {
        const current = window.location.pathname + window.location.search + window.location.hash;
        const desiredUrl = new URL(preferredTarget, window.location.href);
        const desired = desiredUrl.pathname + desiredUrl.search + desiredUrl.hash;

        if (desired !== current) {
          didRedirectRef.current = true;
          redirectInApp(router, preferredTarget, { replace: true });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isSecure, hasActiveSession, redirects, router]);

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

            {visibleAccounts.length > 0 && (
              <div className="space-y-2">
                 {visibleAccounts.map((acc) => (
                    <AccountListItem
                        key={acc.aid}
                        account={acc}
                        isActive={acc.def === 1}
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
