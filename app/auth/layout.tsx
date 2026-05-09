import { InactivityMonitor } from "@/components/auth/inactivity-monitor";
import { SecurityGuard } from "@/components/auth/security-guard";
import { resolveGuestAccount } from "@/services/auth/guestAccount";

export default async function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Called on every /auth/* page — ensures a guest account exists in
    // auth_acc before the user interacts with any auth UI.
    await resolveGuestAccount(null);

    return (
        <SecurityGuard>
            <InactivityMonitor />
            {children}
        </SecurityGuard>
    );
}
