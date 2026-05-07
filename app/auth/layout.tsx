
import { InactivityMonitor } from "@/components/auth/inactivity-monitor";
import { SecurityGuard } from "@/components/auth/security-guard";
import { resolveCookies } from "@/services/auth/resolveCookies";

export default async function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Ensure the track cookie + IdentityTrack DB record exist for every
    // browser that lands on any /auth/* page. This is one of the two entry
    // points (the other is /bridge/handshake.v1/auth/grant) where a new
    // visitor first touches the server.
    await resolveCookies(null);

    return (
        <SecurityGuard>
            <InactivityMonitor />
            {children}
        </SecurityGuard>
    );
}
