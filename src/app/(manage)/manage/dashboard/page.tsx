"use client"

import {
    Card,
    CardContent,
} from "@/components/ui/card"
import { Users, AlertTriangle, Clock, ShieldCheck } from "@/components/icons"
import { getUserStats } from "@/actions/manage/accounts"
import { checkPermissions } from "@/lib/user"
import { notFound } from "next/navigation"
import { useEffect, useState } from "react"
import type { UserStats } from "@/types"

export default function DashboardPage() {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const hasPerm = await checkPermissions(['root.dashboard.view']);
            if (!hasPerm) {
                notFound();
            }
            const userStats = await getUserStats();
            setStats(userStats);
            setLoading(false);
        };
        fetchData();
    }, []);

    return (
        <div className="grid gap-8">
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    A high-level overview of key metrics and system status.
                </p>
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Reporting Overview</h2>
                 <p className="text-muted-foreground text-sm">A high-level overview of key metrics and system status.</p>
                <Card>
                    <CardContent className="grid p-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                        <div className="p-6">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium">Total Users</h3>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">
                                    {stats ? stats.totalUsers.toLocaleString() : '...'}
                                </div>
                                <p className="text-xs text-muted-foreground">+5.2% from last month</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium">Active Users</h3>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats ? stats.activeUsers.toLocaleString() : '...'}</div>
                                <p className="text-xs text-muted-foreground">in 24 hours</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium">Security Alerts</h3>
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">3</div>
                                <p className="text-xs text-muted-foreground">Anomalies detected today</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium text-primary">System Status</h3>
                                <ShieldCheck className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-primary">Operational</div>
                                <p className="text-xs text-primary/80">All systems are secure and running.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
