'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initializeAuthFlow } from '@/actions/auth/initialize';
import { NeupIdStep } from './_components/neupid-step';
import { PasswordStep } from './_components/password-step';
import { MfaStep } from './_components/mfa-step';

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
