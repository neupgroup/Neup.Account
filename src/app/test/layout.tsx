import { headers } from 'next/headers';
import Link from 'next/link';

export default function TestLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    // Allow localhost access for both IPv4 and IPv6
    if (process.env.NODE_ENV === 'production' && ip !== '127.0.0.1' && ip !== '::1') {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
                <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
                    <h1 className="mb-2 text-2xl font-bold">Access Denied</h1>
                    <p className="text-muted-foreground">
                        This section is only available for local development.
                    </p>
                     <Link href="/" className="mt-4 inline-block text-sm text-primary underline">
                        Go to Homepage
                    </Link>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen w-full flex-col items-center bg-muted/20">
            <header className="w-full border-b bg-background p-4">
                 <h1 className="text-xl font-bold">Sentinel Test Suite</h1>
            </header>
            <main className="w-full max-w-4xl p-8">
                {children}
            </main>
        </div>
    );
}
