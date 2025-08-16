
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"
import { getActivities, ActivityLog } from "@/lib/log-actions"
import { ChevronLeft, ChevronRight, Ban } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { checkPermissions } from "@/lib/user-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useState, useCallback, use } from "react";
import { Skeleton } from "@/components/ui/skeleton";


const statusVariantMap: { [key: string]: "default" | "destructive" | "secondary" } = {
    Success: "default",
    Failed: "destructive",
    Pending: "secondary",
    Alert: "destructive",
}

export default function SecurityActivityPage({
  searchParams,
}: {
  searchParams?: {
    after?: string;
  };
}) {
    const [canView, setCanView] = useState(false);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [page, setPage] = useState(1);
    const [pageHistory, setPageHistory] = useState<(string | undefined)[]>([undefined]); // History of 'after' IDs
    const [hasNextPage, setHasNextPage] = useState(false);
    
    const router = useRouter();

    const fetchData = useCallback(async (startAfter?: string) => {
        const hasPerm = await checkPermissions(['security.recent_activities.view']);
        setCanView(hasPerm);
        if (!hasPerm) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const { logs, hasNextPage: newHasNextPage } = await getActivities({ startAfter, forCurrentUser: true });
        setLogs(logs);
        setHasNextPage(newHasNextPage);
        setLoading(false);
    }, []);

    useEffect(() => {
        const after = searchParams?.after;
        fetchData(after);
    }, [searchParams, fetchData]);
    
    const handleNextPage = () => {
        if (logs.length > 0) {
            const lastId = logs[logs.length - 1].id;
            const newHistory = [...pageHistory, lastId];
            setPageHistory(newHistory);
            setPage(p => p + 1);
            router.push(`/manage/security/activity?after=${lastId}`);
        }
    };

    const handlePrevPage = () => {
        const prevPageHistory = pageHistory.slice(0, -1);
        const prevAfterId = prevPageHistory[prevPageHistory.length - 1];
        setPageHistory(prevPageHistory);
        setPage(p => p - 1);
        const url = prevAfterId ? `/manage/security/activity?after=${prevAfterId}` : '/manage/security/activity';
        router.push(url);
    };

    if (!canView && !loading) {
        return (
             <div className="grid gap-8">
                <BackButton href="/manage/security" />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view recent activity.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/security" />
            <Card>
                <CardHeader>
                    <CardTitle>Recent Account Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                             ) : logs.length > 0 ? (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{log.action}</TableCell>
                                        <TableCell>
                                             <Badge variant={statusVariantMap[log.status] || "secondary"} className={log.status === 'Success' ? 'bg-accent/80 text-accent-foreground' : ''}>
                                                {log.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{log.timestamp}</TableCell>
                                    </TableRow>
                                ))
                             ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        No successful activities found.
                                    </TableCell>
                                </TableRow>
                             )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                     <Button variant="outline" onClick={handlePrevPage} disabled={page === 1 || loading}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                    <Button variant="outline" onClick={handleNextPage} disabled={!hasNextPage || loading}>
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
