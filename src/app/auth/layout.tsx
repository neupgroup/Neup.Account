
import { InactivityMonitor } from "@/components/auth/inactivity-monitor";

export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <InactivityMonitor />
            {children}
        </>
    );
}
