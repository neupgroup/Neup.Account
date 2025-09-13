'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initializeAuthFlow } from '@/actions/auth/initialize';

// This component is an "invisible" entry point to the signup flow.
export default function SignUpStartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowInitialized = useRef(false);

  useEffect(() => {
    if (!flowInitialized.current) {
      flowInitialized.current = true;
      const startFlow = async () => {
        try {
          const currentId = sessionStorage.getItem('temp_auth_id');
          const newId = await initializeAuthFlow(currentId, 'signup');
          sessionStorage.setItem('temp_auth_id', newId);

          const returnUrl = searchParams.get('return_url');
          const redirectPath = '/auth/signup/name';
          
          const finalUrl = returnUrl 
            ? `${redirectPath}?return_url=${encodeURIComponent(returnUrl)}` 
            : redirectPath;
            
          router.push(finalUrl);

        } catch (error) {
          console.error('Failed to initialize signup flow:', error);
        }
      };
      startFlow();
    }
  }, [router, searchParams]);

  return null; // Render nothing visible
}
