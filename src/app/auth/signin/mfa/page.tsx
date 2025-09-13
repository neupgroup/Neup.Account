'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { verifyMfa } from '@/actions/auth/verify-mfa';
import NProgress from 'nprogress';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/icons';

function MfaForm() {
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
          sessionStorage.removeItem('temp_auth_id');
          router.push(returnUrl || '/manage');
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

export default function MfaPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MfaForm />
    </Suspense>
  );
}
