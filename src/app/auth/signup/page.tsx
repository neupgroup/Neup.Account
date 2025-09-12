
'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initializeSignup } from '@/actions/auth/initialize';
import { getSignupStepData } from '@/actions/auth/signup';
import { cookies } from 'next/headers';

// This component is an "invisible" entry point to the signup flow.
// It uses a client-side effect to ensure a server action is called
// only once, which then sets a cookie and redirects. This avoids
// the "too many redirects" error and cookie modification errors
// from server components.

export default function SignUpStartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupInitialized = useRef(false);

  useEffect(() => {
    // The useRef hook ensures this effect runs only once per render.
    if (!signupInitialized.current) {
      signupInitialized.current = true;
      const startSignup = async () => {
        try {
          // First, check if a valid session already exists.
          const existingSession = await getSignupStepData();
          if (existingSession.success) {
            // If valid, no need to re-initialize. We can rely on the layout to redirect.
            // This case is unlikely to be hit if the layout redirects correctly,
            // but it's a good safeguard.
            router.push('/auth/signup/name');
            return;
          }

          // If no valid session, initialize a new one.
          await initializeSignup();
          const returnUrl = searchParams.get('return_url');
          const redirectPath = returnUrl ? `/auth/signup/name?return_url=${encodeURIComponent(returnUrl)}` : '/auth/signup/name';
          router.push(redirectPath);
        } catch (error) {
          console.error('Failed to initialize signup:', error);
          // Optional: handle error, e.g., show a toast notification
          // or redirect to an error page.
        }
      };
      startSignup();
    }
  }, [router, searchParams]);

  // Render nothing visible to the user.
  // A loading state could be added here if initialization takes time.
  return null;
}
