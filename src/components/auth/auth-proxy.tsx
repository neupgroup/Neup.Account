'use client';

import { useSession } from "@/context/session-context";
import { useEffect } from "react";

/**
 * AuthProxy handles the authentication check and redirection logic.
 * It ensures that children (and the layout wrapping them) are only
 * visible after the authentication check has been successfully completed.
 * 
 * This component acts as a "proxy" to guard protected routes without
 * relying on Next.js middleware, which the user prefers to avoid.
 */
export function AuthProxy({ children }: { children: React.ReactNode }) {
    const { loading, profile } = useSession();

    useEffect(() => {
        // Redirect if not logged in.
        // Since this component is used within the (manage) layout,
        // we assume all routes it wraps require authentication.
        if (!loading && !profile) {
            // We use window.location.href for a hard redirect to ensure
            // all session states are cleared and we start fresh on the auth page.
            window.location.href = '/auth/start';
        }
    }, [loading, profile]);

    // If still loading or not authenticated, render nothing to hide the layout
    if (loading || !profile) {
        return null;
    }

    // Only render children if authenticated
    return <>{children}</>;
}
