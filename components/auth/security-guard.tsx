'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSecurityCheck } from '@/core/hooks/use-security-check';
import { isConnectionSecure } from '@/proxy';
import { redirectInApp } from '@/services/navigation';

export function SecurityGuard({ children }: { children: React.ReactNode }) {
    const isSecure = useSecurityCheck();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check for specific HTTP + Unsecure condition as requested
        if (!isConnectionSecure()) {
            if (pathname !== '/auth/start') {
                redirectInApp(router, '/auth/start?error=unsecure');
                return;
            }
        }
    }, [isSecure, pathname, router]);

    // If insecure and not on start page, hide content to prevent flash/interaction
    // We check both general security and specific HTTP unsecure condition
    if ((!isSecure || (typeof window !== 'undefined' && !isConnectionSecure())) && pathname !== '/auth/start') {
        return null;
    }

    return <>{children}</>;
}
