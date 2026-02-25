"use client"

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
    Users, 
    List, 
    ShieldCheck, 
    AppWindow, 
    Terminal, 
    BarChart,
    ArrowRight
} from "@/components/icons"
import Link from "next/link"
import { useSession } from "@/context/session-context"
import { Skeleton } from "@/components/ui/skeleton"

const managementItems = [
    { 
        href: "/manage/dashboard", 
        label: "Dashboard", 
        description: "A high-level overview of key metrics and system status.",
        icon: BarChart,
        permission: "root.dashboard.view"
    },
    { 
        href: "/manage/accounts", 
        label: "Account Management", 
        description: "Manage account roles and permissions.",
        icon: Users,
        permission: "root.account.search"
    },
    { 
        href: "/manage/requests", 
        label: "Requests Management", 
        description: "Review and act on pending user requests.",
        icon: List,
        permission: "root.requests.view"
    },
    { 
        href: "/manage/permission", 
        label: "Permission Management", 
        description: "Define system-wide permission sets.",
        icon: ShieldCheck,
        permission: "root.permission.view"
    },
    { 
        href: "/manage/app", 
        label: "App Management", 
        description: "Create, edit, and manage applications.",
        icon: AppWindow,
        permission: "root.app.view"
    },
    { 
        href: "/manage/site", 
        label: "Site Configuration", 
        description: "Manage site-wide settings and error logs.",
        icon: Terminal,
        permission: "root.payment_config.view"
    },
]

export default function ManagePage() {
    const { permissions, loading } = useSession();

    if (loading) {
        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                ))}
            </div>
        );
    }

    const visibleItems = managementItems.filter(item => 
        !item.permission || permissions?.includes(item.permission)
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Management</h1>
                <p className="text-muted-foreground">
                    Access administrative tools and system configurations.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visibleItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <Card className="h-full transition-all hover:border-primary/50 hover:bg-accent/50 group cursor-pointer">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <item.icon className="h-6 w-6" />
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                </div>
                                <CardTitle className="mt-4">{item.label}</CardTitle>
                                <CardDescription>{item.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
