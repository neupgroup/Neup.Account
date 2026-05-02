
"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    Card,
    CardContent,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { getUserStats } from "@/services/manage/accounts"
import type { UserStats } from '@/services/manage/accounts';
import { Users, UserCheck, UserPlus, ShieldCheck, Search, Ban, List } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { useToast } from "@/core/hooks/use-toast"
import { checkPermissions } from '@/services/user'
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ListItem } from "@/components/ui/list-item"
import { TertiaryHeader } from "@/components/ui/tertiary-header"
import { PrimaryHeader } from "@/components/ui/primary-header"
import NProgress from 'nprogress';
import { redirectInApp } from "@/core/helpers/navigation";

function AccountsPageSkeleton() {
    return (
        <div className="grid gap-8">
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <Card>
                 <CardContent className="grid p-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="p-6 space-y-2">
                            <Skeleton className="h-5 w-1/3" />
                            <Skeleton className="h-7 w-1/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </CardContent>
            </Card>
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


export default function AccountsPage() {
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [stats, setStats] = useState<UserStats | null>(null)
    const [loadingStats, startStatsTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState("");
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            const hasPerm = await checkPermissions(['root.account.view']);
            setPermissionState(hasPerm ? 'granted' : 'denied');
            if (hasPerm) {
                 startStatsTransition(async () => {
                    const statsData = await getUserStats();
                    setStats(statsData);
                });
            }
        }
        fetchData();
    }, [])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const searchTerm = searchQuery.trim();
        if (searchTerm) {
            NProgress.start();
            redirectInApp(router, `/manage/list?q=${encodeURIComponent(searchTerm)}`);
        }
    }
    
    if (permissionState === 'loading') {
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
    
    return (
        <div className="grid gap-8">
            <PrimaryHeader 
                title="Account Management"
                description="Manage account roles, permissions, and view account statistics."
            />
            
            <Card>
                <CardContent className="grid p-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    <div className="p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Total Accounts</h3>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">
                                {loadingStats ? <Skeleton className="h-8 w-16" /> : stats?.totalUsers ?? "..."}
                            </div>
                            <p className="text-xs text-muted-foreground">Across the entire system</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Active Accounts</h3>
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                             <div className="text-2xl font-bold">
                                 {loadingStats ? <Skeleton className="h-8 w-16" /> : stats?.activeUsers ?? "..."}
                            </div>
                            <p className="text-xs text-muted-foreground">No status tracking yet</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Signed Up Today</h3>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                             <div className="text-2xl font-bold">
                                {loadingStats ? <Skeleton className="h-8 w-16" /> : stats?.signedUpToday ?? "..."}
                            </div>
                            <p className="text-xs text-muted-foreground">New accounts in last 24h</p>
                        </div>
                    </div>
                    <div className="p-6">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Permissions Defined</h3>
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">...</div>
                            <p className="text-xs text-muted-foreground">Total available permission sets</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

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
             <div className="grid gap-4">
                <TertiaryHeader
                    title="List All Accounts"
                    description="View a comprehensive, sortable list of all accounts in the system."
                />
                <Card>
                    <CardContent className="p-2">
                        <ListItem
                            icon={List}
                            title="List All Accounts"
                            description="View, sort, and filter all accounts."
                            href="/manage/list"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
