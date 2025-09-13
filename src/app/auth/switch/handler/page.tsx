
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from '@/components/icons';

function SwitchHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Clear session storage immediately
        sessionStorage.clear();
        
        const sessionId = searchParams.get('sessionId');
        if (sessionId) {
            // Redirect to the server-side API route to handle the actual switch
            router.replace(`/api/auth/switch-account?sessionId=${sessionId}`);
        } else {
            // If no session ID, redirect to the accounts page with an error
            router.replace('/auth/accounts?error=invalid_request');
        }
    }, [router, searchParams]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>Switching accounts...</p>
            </div>
        </div>
    );
}

export default function SwitchHandlerPage() {
    return (
        <Suspense>
            <SwitchHandler />
        </Suspense>
    );
}
