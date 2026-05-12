"use client"

import { useState, useEffect } from "react"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import { Users, Ban, List, Terminal, ArrowRight, AppWindow } from "@/components/icons"
import { checkPermissions } from '@/services/user'
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TertiaryHeader } from "@/components/ui/tertiary-header"
import { PrimaryHeader } from "@/components/ui/primary-header"
import { FlowLink } from '@/components/ui/flow-link'
import { useSession } from "@/core/providers/session"

function AccountsPageSkeleton() {
    return (
        <div className="grid gap-8">
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
            </div>
        </div>
    )
}

const managementItems = [
    {
        href: "/manage/accounts",
        label: "Accounts",
        description: "Browse and manage all accounts in the system.",
        icon: Users,
        permission: "root.account.view"
    },
    {
        href: "/manage/requests",
        label: "Requests",
        description: "Review and act on pending user requests.",
        icon: List,
        permission: "root.requests.view"
    },
    {
        href: "/data/applications?mode=root",
        label: "Applications",
        description: "Approve, reject, block, or activate applications.",
        icon: AppWindow,
        permission: "root.app.view"
    },
    {
        href: "/manage/config",
        label: "Configurations",
        description: "Manage payment settings and footer social accounts.",
        icon: Terminal,
        permission: "root.payment_config.view"
    },
]

export default function ManagePage() {
    const { permissions, loading: sessionLoading } = useSession();
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');

    useEffect(() => {
        const fetchData = async () => {
            const hasPerm = await checkPermissions(['root.account.view']);
            setPermissionState(hasPerm ? 'granted' : 'denied');
        }
        fetchData();
    }, [])

    if (permissionState === 'loading' || sessionLoading) {
        return <AccountsPageSkeleton />;
    }

    if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <PrimaryHeader
                    title="Account Management"
                    description="Manage account roles, permissions, and view account statistics."
                />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view account management.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    const visibleItems = managementItems.filter(item =>
        !item.permission || permissions?.includes(item.permission)
    );

    return (
        <div className="grid gap-8">
            <PrimaryHeader
                title="Account Management"
                description="Manage account roles, permissions, and view account statistics."
            />

            {visibleItems.length > 0 && (
                <div className="space-y-6">
                    <TertiaryHeader
                        title="System Tools"
                        description="Access administrative tools and system configurations."
                    />
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {visibleItems.map((item) => (
                            <FlowLink key={item.href} href={item.href}>
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
                            </FlowLink>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
