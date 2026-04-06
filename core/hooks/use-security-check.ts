
'use client';

import { useEffect, useState } from 'react';
import { isConnectionSecure } from '@/core/helpers/security-check';

export function useSecurityCheck() {
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    // Check if we are running in a secure context (HTTPS or localhost)
    if (typeof window !== 'undefined') {
      setIsSecure(isConnectionSecure());
    }
  }, []);

  return isSecure;
}