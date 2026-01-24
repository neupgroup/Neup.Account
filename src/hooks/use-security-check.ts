
'use client';

import { useEffect, useState } from 'react';

export function useSecurityCheck() {
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    // Check if we are running in a secure context (HTTPS or localhost)
    if (typeof window !== 'undefined') {
      setIsSecure(window.isSecureContext);
    }
  }, []);

  return isSecure;
}
