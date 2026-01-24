'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSecurityCheck } from '@/hooks/use-security-check';

export function SecurityGuard({ children }: { children: React.ReactNode }) {
    const isSecure = useSecurityCheck();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // If we are not in a secure context
        if (!isSecure) {
            // And we are NOT already on the start page (to avoid loop)
            if (pathname !== '/auth/start') {
                router.push('/auth/start');
            }
        }
    }, [isSecure, pathname, router]);

    // If insecure and not on start page, hide content to prevent flash/interaction
    if (!isSecure && pathname !== '/auth/start') {
        return null;
    }

    return <>{children}</>;
}
