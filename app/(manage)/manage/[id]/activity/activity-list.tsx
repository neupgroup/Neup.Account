'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getActivity } from "@/services/manage/users";
import { Ban, MapPin } from "@/components/icons";
import { checkPermissions } from "@/services/shared/user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserActivityLog } from "@/types";

const statusVariantMap: { [key: string]: "default" | "destructive" | "secondary" } = {
    Success: "default",
    Failed: "destructive",
    Pending: "secondary",
    Alert: "destructive",
}

export function ActivityList({ initialActivity, accountId }: { initialActivity?: UserActivityLog[], accountId: string }) {
    const [canView, setCanView] = useState(false);
    const [loading, setLoading] = useState(!initialActivity);
    const [logs, setLogs] = useState<UserActivityLog[]>(initialActivity || []);
    
    useEffect(() => {
        const checkAndFetch = async () => {
             const hasPerm = await checkPermissions(['root.account.view']);
             setCanView(hasPerm);
             if (hasPerm && !initialActivity) {
                setLoading(true);
                const fetchedLogs = await getActivity(accountId);
                setLogs(fetchedLogs);
                setLoading(false);
             } else {
                setLoading(false);
             }
        }
        checkAndFetch();
    }, [accountId, initialActivity]);
    
    if (loading) {
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>IP & Location</TableHead>
                        <TableHead>Timestamp</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )
    }

    if (!canView) {
        return (
             <Alert variant="destructive">
                <Ban className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to view this activity log.
                </AlertDescription>
            </Alert>
        )
    }

     return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP & Location</TableHead>
                    <TableHead>Timestamp</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {logs.length > 0 ? (
                    logs.map(log => (
                        <TableRow key={log.id}>
                            <TableCell>{log.action}</TableCell>
                            <TableCell><Badge variant={statusVariantMap[log.status] || "secondary"}>{log.status}</Badge></TableCell>
                            <TableCell>
                                <div className="font-mono text-xs">{log.ip}</div>
                                {log.geolocation && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span>{log.geolocation}</span>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>{log.timestamp}</TableCell>
                        </TableRow>
                    ))
                ) : (
                     <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">No recent activity.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
