"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
            <div className="space-y-4">
                <Skeleton className="h-7 w-1/4" />
                <Skeleton className="h-5 w-1/2" />
                <Card>
                    <CardContent className="pt-6">
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

const otherManagementItems = [
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
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            const hasPerm = await checkPermissions(['root.account.view']);
            setPermissionState(hasPerm ? 'granted' : 'denied');
        }
        fetchData();
    }, [])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const searchTerm = searchQuery.trim();
        if (searchTerm) {
            NProgress.start();
            redirectInApp(router, `/manage/accounts?q=${encodeURIComponent(searchTerm)}`);
        }
    }
    
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

    const visibleItems = otherManagementItems.filter(item => 
        !item.permission || permissions?.includes(item.permission)
    );
    
    return (
        <div className="grid gap-8">
            <PrimaryHeader 
                title="Account Management"
                description="Manage account roles, permissions, and view account statistics."
            />

            <div className="grid gap-4">
                <TertiaryHeader
                    title="Find User"
                    description="Search for a user by name, ID, or type to view their details and manage their account."
                />
                <Card>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch} className="flex items-center gap-2">
                            <Input 
                                placeholder="Search for an account..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Button type="submit" size="icon">
                                <Search className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {visibleItems.length > 0 && (
                <div className="space-y-6">
                    <TertiaryHeader 
                        title="System Tools"
                        description="Access other administrative tools and system configurations."
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
