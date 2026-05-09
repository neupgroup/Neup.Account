'use client';

import { useEffect, useTransition } from 'react';
import { initGuestAccount } from './actions';

/**
 * Fires initGuestAccount() as a Server Action on first mount.
 * This is the correct way to set cookies from a page — Server Actions
 * can set cookies; Server Components and layouts cannot.
 *
 * Renders nothing visible.
 */
export function GuestAccountInitializer() {
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void initGuestAccount();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
