
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useContext, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitPassword } from '@/actions/auth/login';
import { getSignupStepData } from '@/actions/auth/signup';
import { cancelAccountDeletion } from '@/actions/data/delete';
import NProgress from 'nprogress';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/icons';

// Add export default at the end of the file
export default function PasswordPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PasswordPageContent />
    </React.Suspense>
  );
}

function PasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [neupId, setNeupId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, startPasswordSubmit] = useTransition();
  const [authRequestId, setAuthRequestId] = useState<string | null>(null);

  const [showDeletionDialog, setShowDeletionDialog] = useState(false);

  const returnUrl = searchParams.get('return_url');

  useEffect(() => {
    const id = sessionStorage.getItem('temp_auth_id');
    if (!id) {
      router.push('/auth/signin');
      return;
    }
    setAuthRequestId(id);

    // Try to load from session storage for instant render
    const savedUserInfo = sessionStorage.getItem('temp_user_info');
    if (savedUserInfo) {
      try {
        const parsed = JSON.parse(savedUserInfo);
        if (parsed.neupId) {
          setNeupId(parsed.neupId);
        }
      } catch (e) {
        // ignore parse error
      }
    }

    const fetchPreviousData = async () => {
      const { data } = await getSignupStepData(id);
      if (data?.neupId) {
        setNeupId(data.neupId);
      } else if (!savedUserInfo) {
        // If NeupID isn't set and we don't have it locally, we likely can't be on this step
        router.push('/auth/signin/neupid');
      }
    };
    fetchPreviousData();
  }, [router]);

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authRequestId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Session not found. Please try again.' });
      return;
    }
    NProgress.start();
    startPasswordSubmit(async () => {
      const result = await submitPassword({ password, authRequestId });

      if (result.success) {
        if (result.isPendingDeletion) {
          setShowDeletionDialog(true);
          NProgress.done();
        } else if (result.mfaRequired) {
          const mfaUrl = new URL(window.location.origin + '/auth/signin/mfa');
          if (returnUrl) mfaUrl.searchParams.set('return_url', returnUrl);
          router.push(mfaUrl.toString());
        } else {
          sessionStorage.clear();
          router.push(returnUrl || '/manage');
        }
      } else {
        toast({ variant: 'destructive', title: 'Sign In Failed', description: result.error });
        NProgress.done();
      }
    });
  };

  const handleCancelDeletion = async () => {
    setShowDeletionDialog(false);
    if (!authRequestId) return;
    NProgress.start();
    startPasswordSubmit(async () => {
      const { data } = await getSignupStepData(authRequestId);
      if (!data?.accountId) {
        toast({ variant: "destructive", title: "Error", description: "Could not find account to cancel deletion." });
        NProgress.done();
        return;
      }

      const result = await cancelAccountDeletion(data.accountId);
      if (result.success) {
        toast({ title: "Deletion Cancelled", description: "Your account deletion request has been cancelled. Welcome back!", className: "bg-accent text-accent-foreground" });
        // Re-attempt login after cancellation
        const loginResult = await submitPassword({ password, authRequestId });
        if (loginResult.success && !loginResult.isPendingDeletion) {
          if (loginResult.mfaRequired) {
            router.push(returnUrl ? `/auth/signin/mfa?return_url=${returnUrl}` : '/auth/signin/mfa');
          }
          else {
            sessionStorage.clear();
            router.push(returnUrl || '/manage');
          }
        } else {
          toast({ variant: "destructive", title: "Sign In Failed", description: loginResult.error });
          NProgress.done();
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error || "Could not cancel deletion." });
        NProgress.done();
      }
    });
  };

  const handleProceedWithDeletion = () => {
    setShowDeletionDialog(false);
    router.push('/auth/accounts');
  };

  const handleBack = () => {
    router.push('/auth/signin/neupid' + (returnUrl ? `?return_url=${returnUrl}` : ''));
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Welcome back,</CardTitle>
          <CardDescription>
            @{neupId}, enter your password and you're a step closer to getting into your NeupID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="password-form" onSubmit={handlePasswordSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Sign In'}
            </Button>
            <div className="flex justify-between items-center text-sm">
              <Link href="/auth/forget" className="underline text-primary">
                Forget Password
              </Link>
              <Button variant="link" type="button" onClick={handleBack} className="text-primary p-0 h-auto" disabled={isSubmitting}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Deletion Pending</AlertDialogTitle>
            <AlertDialogDescription>
              Your account is scheduled for deletion. Continuing to sign in will cancel this request. Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleProceedWithDeletion}>Log Out</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelDeletion} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Cancel Deletion & Sign In'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
