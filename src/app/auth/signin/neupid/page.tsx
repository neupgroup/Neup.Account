
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitNeupId } from '@/actions/auth/login';
import { getSignupStepData } from '@/actions/auth/signup';
import NProgress from 'nprogress';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/icons';

function NeupIdPageComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [neupId, setNeupId] = useState('');
  const [isCheckingNeupId, startNeupIdCheck] = useTransition();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [authRequestId, setAuthRequestId] = useState<string | null>(null);

  const returnUrl = searchParams.get('return_url');

  useEffect(() => {
    const id = sessionStorage.getItem('temp_auth_id');
    if (!id) {
      // No session, redirect to start the flow
      router.push('/auth/signin');
      return;
    }
    setAuthRequestId(id);

    // Fetch any previously entered NeupID
    const fetchPreviousData = async () => {
      const { data } = await getSignupStepData(id);
      if (data?.neupId) {
        setNeupId(data.neupId);
      }
    }
    fetchPreviousData();

  }, [router]);

  const handleNeupIdSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    if (!authRequestId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Session not found. Please try again.' });
      return;
    }
    NProgress.start();
    startNeupIdCheck(async () => {
      const result = await submitNeupId({ neupId, authRequestId });
      if (result.success) {
        const nextUrl = new URL(window.location.origin + '/auth/signin/password');
        if (returnUrl) nextUrl.searchParams.set('return_url', returnUrl);
        router.push(nextUrl.toString());
      } else {
        setValidationError(result.error || 'Invalid NeupID.');
        NProgress.done();
      }
    });
  };

  const handleNeupIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setNeupId(value);
    if (validationError) setValidationError(null);
  };

  const getSignupUrl = () => {
    if (typeof window === 'undefined') {
      // Server-side rendering fallback
      return returnUrl ? `/auth/signup?return_url=${returnUrl}` : '/auth/signup';
    }
    const url = new URL('/auth/signup', window.location.origin);
    if (returnUrl) url.searchParams.set('return_url', returnUrl);
    return url.toString();
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <div className="flex justify-start items-center mb-4"></div>
          <CardTitle className="text-2xl font-headline">Sign in with Neup.Account</CardTitle>
          <CardDescription>
            Sign in with your NeupID to access NeupID Group Products and Services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNeupIdSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="neupId">NeupID</Label>
              <div className="relative">
                <Input
                  id="neupId"
                  name="neupId"
                  type="text"
                  placeholder="neupid"
                  required
                  autoFocus
                  value={neupId}
                  onChange={handleNeupIdChange}
                  className="pr-10"
                  disabled={isCheckingNeupId}
                />
                {isCheckingNeupId && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isCheckingNeupId}>
              {isCheckingNeupId ? <Loader2 className="animate-spin" /> : 'Next'}
            </Button>
            <div className="mt-4 text-left text-sm">
              Don&apos;t have an Account?{' '}
              <Link href={getSignupUrl()} className="underline text-primary">
                <span>Sign Up</span>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NeupIdPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NeupIdPageComponent />
    </Suspense>
  );
}
