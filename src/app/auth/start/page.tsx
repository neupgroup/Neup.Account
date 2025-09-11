
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, AlertTriangle } from '@/components/icons';
import { hasActiveSessionCookies } from '@/lib/auth-actions';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import React from 'react';

function StartPageComponent() {
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const returnUrl = searchParams.get('return_url');

  useEffect(() => {
    async function checkSession() {
      const sessionExists = await hasActiveSessionCookies();
      setHasSession(sessionExists);
      setLoading(false);
    }
    checkSession();
  }, []);

  const getUrlWithReturn = (baseUrl: string) => {
    if (returnUrl) {
      return `${baseUrl}?return_url=${encodeURIComponent(returnUrl)}`;
    }
    return baseUrl;
  };

  if (loading) {
    return (
        <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
            <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
                <CardHeader>
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse mb-4" />
                    <div className="h-8 w-3/4 bg-muted animate-pulse" />
                    <div className="h-5 w-1/2 bg-muted animate-pulse mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="h-20 w-full bg-muted animate-pulse rounded-lg" />
                     <div className="h-20 w-full bg-muted animate-pulse rounded-lg" />
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <div className="flex justify-start items-center mb-4">
            
          </div>
          <CardTitle className="text-2xl font-headline">Get Started</CardTitle>
          <CardDescription>
            Choose an option below to continue with Neup.Account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Authentication Error</AlertTitle>
                    <AlertDescription>
                        {errorDescription || 'An unknown error occurred. Please try signing in again.'}
                    </AlertDescription>
                </Alert>
            )}
            {hasSession && (
              <Link
                href="/manage"
                className="flex w-full items-center justify-between p-4 border rounded-lg bg-accent/10 border-accent hover:border-primary transition-colors"
              >
                <div>
                  <h3 className="font-semibold">Continue</h3>
                  <p className="text-sm text-muted-foreground">Continue with your Account you're currently signed in.</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            )}

            <Link
              href={getUrlWithReturn("/auth/signin")}
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
            >
              <div>
                <h3 className="font-semibold">Sign In</h3>
                <p className="text-sm text-muted-foreground">Sign in with NeupID and continue using NeupID Group Products and Services.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href={getUrlWithReturn("/auth/signup")}
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
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
              href="/auth/forget"
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
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


export default function StartPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <StartPageComponent />
        </React.Suspense>
    )
}
