'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSignup } from '@/actions/auth/initialize';

// This component is an "invisible" entry point to the signup flow.
// It uses a client-side effect to ensure a server action is called
// only once, which then sets a cookie and redirects. This avoids
// the "too many redirects" error and cookie modification errors
// from server components.

export default function SignUpStartPage() {
  const router = useRouter();
  const signupInitialized = useRef(false);

  useEffect(() => {
    // The useRef hook ensures this effect runs only once.
    if (!signupInitialized.current) {
      signupInitialized.current = true;
      const startSignup = async () => {
        try {
          await initializeSignup();
          router.push('/auth/signup/name');
        } catch (error) {
          console.error('Failed to initialize signup:', error);
          // Optional: handle error, e.g., show a toast notification
          // or redirect to an error page.
        }
      };
      startSignup();
    }
  }, [router]);

  // Render nothing visible to the user.
  // A loading state could be added here if initialization takes time.
  return null;
}
