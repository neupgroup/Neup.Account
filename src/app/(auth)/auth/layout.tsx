
import { InactivityMonitor } from "@/components/auth/inactivity-monitor";
import { SecurityGuard } from "@/components/auth/security-guard";

export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <SecurityGuard>
            <InactivityMonitor />
            {children}
        </SecurityGuard>
    );
}
