'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useTransition, Suspense } from 'react';
import NProgress from 'nprogress';

import { useToast } from '@/hooks/use-toast';
import { submitNeupId, submitPassword } from '@/actions/auth/login';
import { getSignupStepData } from '@/actions/auth/signup';
import { cancelAccountDeletion } from '@/actions/data/delete';
import { initializeAuthFlow } from '@/actions/auth/initialize';
import { verifyMfa } from '@/actions/auth/verify-mfa';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/icons';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// --- Components ---

function NeupIdStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [neupId, setNeupId] = useState('');
  const [isCheckingNeupId, startNeupIdCheck] = useTransition();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [authRequestId, setAuthRequestId] = useState<string | null>(null);

  const returnUrl = searchParams.get('return_url');

  useEffect(() => {
    const initFlow = async () => {
      let id = sessionStorage.getItem('temp_auth_id');

      if (!id) {
        try {
          id = await initializeAuthFlow(null, 'signin');
          sessionStorage.setItem('temp_auth_id', id);
          setAuthRequestId(id);
        } catch (error) {
          console.error("Failed to initialize auth flow", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to initialize session. Please refresh.' });
          return;
        }
      } else {
        setAuthRequestId(id);
        const fetchPreviousData = async () => {
          const { data } = await getSignupStepData(id!);
          if (data?.neupId) {
            setNeupId(data.neupId);
          }
        }
        fetchPreviousData();
      }
      
      const neupIdParam = searchParams.get('neupId');
      if (neupIdParam) {
          setNeupId(neupIdParam);
      }
    };
    initFlow();
  }, [router, toast, searchParams]);

  const handleNeupIdSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const currentId = authRequestId || sessionStorage.getItem('temp_auth_id');

    if (!currentId) {
      toast({ title: 'Please wait...', description: 'Initializing secure session.' });
      return;
    }

    NProgress.start();
    startNeupIdCheck(async () => {
      const result = await submitNeupId({ neupId, authRequestId: currentId });
      if (result.success) {
        if (result.userInfo) {
          sessionStorage.setItem('temp_user_info', JSON.stringify(result.userInfo));
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set('step', 'password');
        router.push(`/auth/signin?${params.toString()}`);
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
    const params = new URLSearchParams();
    params.set('step', 'name');
    if (returnUrl) params.set('return_url', returnUrl);
    return `/auth/signup?${params.toString()}`;
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
                  autoComplete="username"
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

function PasswordStep() {
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
        const params = new URLSearchParams(searchParams.toString());
        params.set('step', 'neupid');
        router.push(`/auth/signin?${params.toString()}`);
      }
    };
    fetchPreviousData();
  }, [router, searchParams]);

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
          const params = new URLSearchParams(searchParams.toString());
          params.set('step', 'mfa');
          router.push(`/auth/signin?${params.toString()}`);
        } else {
          sessionStorage.clear();
          router.push(returnUrl || '/');
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
        const loginResult = await submitPassword({ password, authRequestId });
        if (loginResult.success && !loginResult.isPendingDeletion) {
          if (loginResult.mfaRequired) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('step', 'mfa');
            router.push(`/auth/signin?${params.toString()}`);
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
    router.push('/auth/start');
  };

  const handleBack = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', 'neupid');
    router.push(`/auth/signin?${params.toString()}`);
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

function MfaStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [isSubmitting, startSubmit] = useTransition();
  const [authRequestId, setAuthRequestId] = useState<string | null>(null);

  const returnUrl = searchParams.get('return_url');

  useEffect(() => {
    const id = sessionStorage.getItem('temp_auth_id');
    if (!id) {
      router.push('/auth/signin');
      return;
    }
    setAuthRequestId(id);
  }, [router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authRequestId) return;
    NProgress.start();
    startSubmit(async () => {
      try {
        const result = await verifyMfa({ token, authRequestId });

        if (result.success) {
          sessionStorage.clear();
          router.push(returnUrl || '/');
        } else {
          toast({
            variant: 'destructive',
            title: 'MFA Failed',
            description: result.error || 'An unexpected error occurred.',
          });
          NProgress.done();
        }
      } catch (error) {
        console.error('MFA error:', error);
        toast({
          variant: 'destructive',
          title: 'MFA Failed',
          description: 'An unexpected error occurred. Please try again.',
        });
        NProgress.done();
      }
    });
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Enter Authentication Code</CardTitle>
          <CardDescription>Open your authenticator app and enter the code to complete your login.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="token">One-Time Password</Label>
              <Input
                id="token"
                name="token"
                type="text"
                placeholder="123456"
                required
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isSubmitting}
                autoComplete="one-time-code"
              />
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Page ---

function SigninFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = searchParams.get('step');

  useEffect(() => {
    if (!step) {
      const startFlow = async () => {
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          router.push('/auth/start');
          return;
        }
        try {
          const currentId = sessionStorage.getItem('temp_auth_id');
          const newId = await initializeAuthFlow(currentId, 'signin');
          sessionStorage.setItem('temp_auth_id', newId);

          const returnUrl = searchParams.get('return_url');
          const neupId = searchParams.get('neupId');
          
          const params = new URLSearchParams(searchParams.toString());
          if (neupId) {
             params.set('step', 'password');
             // neupId is already in searchParams so it's preserved
          } else {
             params.set('step', 'neupid');
          }
          if (returnUrl) params.set('return_url', returnUrl);

          router.push(`/auth/signin?${params.toString()}`);

        } catch (error) {
          console.error('Failed to initialize signin flow:', error);
        }
      };
      startFlow();
    }
  }, [step, router, searchParams]);

  if (!step) return null;

  switch (step) {
    case 'neupid': return <NeupIdStep />;
    case 'password': return <PasswordStep />;
    case 'mfa': return <MfaStep />;
    default: return <NeupIdStep />;
  }
}

export default function SigninPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SigninFlow />
    </Suspense>
  )
}
