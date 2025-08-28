

'use client';

import React from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { UserNav } from "@/components/user-nav"
import { NeupIdLogo } from "@/components/neupid-logo"
import { SessionProvider, useSession } from "@/context/session-context"
import { Skeleton } from "@/components/ui/skeleton";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { loading } = useSession();

    if (loading) {
        return (
             <div className="min-h-screen w-full bg-background text-foreground">
                <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background shadow">
                    <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 md:px-6">
                        <NeupIdLogo iconHref={process.env.NEXT_PUBLIC_COMPANY_URL || "/"} textHref="/manage" />
                        <div className="flex items-center gap-2">
                            <div className="text-right">
                                <Skeleton className="h-4 w-20 mb-1" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                            <Skeleton className="h-9 w-9 rounded-full" />
                        </div>
                    </div>
                </header>
                <div className="mx-auto grid w-full max-w-[1440px] md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                    <aside className="hidden h-[calc(100vh-4rem)] flex-col border-r md:sticky md:top-16 md:flex">
                        <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ))}
                        </div>
                    </aside>
                    <main className="min-h-[calc(100vh-4rem)] p-6 md:p-8">
                        <Skeleton className="h-64 w-full" />
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background shadow">
                <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 md:px-6">
                    <NeupIdLogo iconHref={process.env.NEXT_PUBLIC_COMPANY_URL || "/"} textHref="/manage" />
                    <UserNav />
                </div>
            </header>
            <div className="mx-auto grid w-full max-w-[1440px] md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                <aside className="hidden h-[calc(100vh-4rem)] flex-col border-r md:sticky md:top-16 md:flex">
                    <div className="flex flex-1 flex-col overflow-y-auto p-4">
                        <DashboardNav />
                    </div>
                </aside>
                <main className="min-h-[calc(100vh-4rem)] p-6 md:p-8">
                    <div className="w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}


export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // The server-side validation is now handled inside the SessionProvider
    return (
        <SessionProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </SessionProvider>
    )
}
