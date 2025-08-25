
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import type { UserStats } from "@/app/actions/root/users"
import { getUserStats } from "@/app/actions/root/users"
import { Users, UserCheck, UserPlus, ShieldCheck, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

export default function UsersPage() {
    const [stats, setStats] = useState<UserStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [neupIdSearch, setNeupIdSearch] = useState("");
    const router = useRouter();
    const { toast } = useToast()


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [statsData] = await Promise.all([
                getUserStats(),
            ]);
            setStats(statsData);
            setLoading(false);
        }
        fetchData();
    }, [])

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const searchTerm = neupIdSearch.trim().toLowerCase();
        if (searchTerm) {
            router.push(`/manage/root/users/${searchTerm}`);
        }
    }
    
    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Account Management</h1>
                <p className="text-muted-foreground">
                    Manage account roles, permissions, and view account statistics.
                </p>
            </div>
            
            <Card>
                <CardContent className="grid p-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    <div className="p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Total Accounts</h3>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">
                                {stats?.totalUsers ?? "..."}
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
                            <div className="text-2xl font-bold">{stats?.activeUsers ?? "..."}</div>
                            <p className="text-xs text-muted-foreground">No status tracking yet</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Signed Up Today</h3>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats?.signedUpToday ?? "..."}</div>
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

            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Find Users</h2>
                <p className="text-muted-foreground text-sm">
                    Enter the NeupID of a user to view their details and manage their account.
                </p>
                <Card>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch} className="flex items-center gap-2">
                            <Input 
                                placeholder="Enter an account's NeupID to continue" 
                                value={neupIdSearch}
                                onChange={(e) => setNeupIdSearch(e.target.value.toLowerCase())}
                            />
                            <Button type="submit" size="icon">
                                <Search className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
