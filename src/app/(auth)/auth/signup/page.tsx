'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initializeAuthFlow } from '@/actions/auth/initialize';
import { NameStep } from './_components/name-step';
import { DemographicsStep } from './_components/demographics-step';
import { NationalityStep } from './_components/nationality-step';
import { ContactStep } from './_components/contact-step';
import { OtpStep } from './_components/otp-step';
import { NeupIdStep } from './_components/neupid-step';
import { PasswordStep } from './_components/password-step';
import { TermsStep } from './_components/terms-step';

function SignupFlow() {
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
          // We can't rely on initializeAuthFlow to redirect because we want to control it here
          // initializeAuthFlow returns an ID.
          const newId = await initializeAuthFlow(currentId, 'signup');
          sessionStorage.setItem('temp_auth_id', newId);

          const returnUrl = searchParams.get('return_url');
          
          const params = new URLSearchParams(searchParams.toString());
          params.set('step', 'name');
          if (returnUrl) params.set('return_url', returnUrl);
          
          router.push(`/auth/signup?${params.toString()}`);

        } catch (error) {
          console.error('Failed to initialize signup flow:', error);
        }
      };
      startFlow();
    }
  }, [step, router, searchParams]);

  if (!step) return null; // Or a loading spinner

  switch (step) {
    case 'name': return <NameStep />;
    case 'demographics': return <DemographicsStep />;
    case 'nationality': return <NationalityStep />;
    case 'contact': return <ContactStep />;
    case 'otp': return <OtpStep />;
    case 'neupid': return <NeupIdStep />;
    case 'password': return <PasswordStep />;
    case 'terms': return <TermsStep />;
    default: return <NameStep />;
  }
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupFlow />
    </Suspense>
  )
}
