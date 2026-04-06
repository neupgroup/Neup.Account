

'use client';

import React from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { UserNav } from "@/components/user-nav"
import { NeupIdLogo } from "@/components/neupid-logo"
import { SessionProvider } from "@/core/providers/session-context"
import { AuthProxy } from "@/components/auth/auth-proxy"

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    return (
        <AuthProxy>
            <div className="min-h-screen w-full bg-background text-foreground">
                <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background shadow">
                    <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 lg:px-6">
                        <NeupIdLogo iconHref="https://neupgroup.com" textHref="/" />
                        <UserNav />
                    </div>
                </header>
                <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
                    <aside className="hidden h-[calc(100vh-4rem)] flex-col border-r lg:sticky lg:top-16 lg:flex">
                        <div className="flex flex-1 flex-col overflow-y-auto p-4">
                            <DashboardNav />
                        </div>
                    </aside>
                    <main className="min-h-[calc(100vh-4rem)] p-6 lg:p-8">
                        <div className="w-full">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </AuthProxy>
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
