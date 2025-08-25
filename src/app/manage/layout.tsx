
import React from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { validateCurrentSession } from "@/actions/auth/session"
import { UserNav } from "@/components/user-nav"
import { NeupIdLogo } from "@/components/neupid-logo"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await validateCurrentSession();

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background shadow">
                <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 md:px-6">
                    <NeupIdLogo iconHref={process.env.COMPANY_URL || "/"} textHref="/manage" />
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
    )
}
