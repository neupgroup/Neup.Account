

'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getReportedBugs } from '@/actions/root/site';
import type { BugReport } from '@/types';
import { checkPermissions } from '@/lib/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Ban, Bug, ChevronLeft, ChevronRight } from '@/components/icons';
import { BackButton } from '@/components/ui/back-button';
import { TertiaryHeader } from '@/components/ui/tertiary-header';

function BugsPageSkeleton() {
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site" />
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-1/4" />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {[...Array(4)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-20" /></TableHead>)}
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
                </CardContent>
            </Card>
        </div>
    );
}

const statusVariantMap: { [key: string]: "default" | "destructive" | "secondary" } = {
    new: "destructive",
    in_progress: "secondary",
    solved: "default",
};

function ReportedBugsPageComponent({ after }: { after?: string }) {
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [bugs, setBugs] = useState<BugReport[]>([]);
    const [contentLoading, setContentLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageHistory, setPageHistory] = useState<(string | undefined)[]>([undefined]);
    const [hasNextPage, setHasNextPage] = useState(false);
    const router = useRouter();

    const fetchData = useCallback(async (startAfter?: string) => {
        setContentLoading(true);
        const data = await getReportedBugs({ startAfter });
        setBugs(data.bugs);
        setHasNextPage(data.hasNextPage);
        setContentLoading(false);
    }, []);

    useEffect(() => {
        const verifyPermission = async () => {
            const hasPerm = await checkPermissions(['root.errors.view']);
            setPermissionState(hasPerm ? 'granted' : 'denied');
        };
        verifyPermission();
    }, []);

    useEffect(() => {
        if (permissionState === 'granted') {
            fetchData(after);
        }
    }, [permissionState, after, fetchData]);

    const handleNextPage = () => {
        if (bugs.length > 0) {
            const lastId = bugs[bugs.length - 1].id;
            const newHistory = [...pageHistory, lastId];
            setPageHistory(newHistory);
            setPage(p => p + 1);
            router.push(`/manage/root/site/bugs?after=${lastId}`);
        }
    };

    const handlePrevPage = () => {
        const prevPageHistory = pageHistory.slice(0, -1);
        const prevAfterId = prevPageHistory[prevPageHistory.length - 1];
        setPageHistory(prevPageHistory);
        setPage(p => p - 1);
        const url = prevAfterId ? `/manage/root/site/bugs?after=${prevAfterId}` : '/manage/root/site/bugs';
        router.push(url);
    };

    if (permissionState === 'loading') {
        return <BugsPageSkeleton />;
    }

    if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <BackButton href="/manage/root/site" />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view bug reports.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Reported Bugs</h1>
                <p className="text-muted-foreground">
                    Review bugs and other issues reported by users.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <TertiaryHeader title="Bug Reports" description="A list of all user-submitted bug reports." />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Reported By</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contentLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : bugs.length > 0 ? (
                                bugs.map((bug) => (
                                    <TableRow key={bug.id}>
                                        <TableCell>
                                            <Link href={`/manage/root/site/bugs/${bug.id}`} className="font-medium hover:underline">{bug.title}</Link>
                                        </TableCell>
                                        <TableCell>{bug.reportedBy}</TableCell>
                                        <TableCell>{bug.createdAt}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariantMap[bug.status] || "secondary"}>{bug.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        <Bug className="mx-auto h-8 w-8 mb-2" />
                                        No bug reports found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                     <Button variant="outline" onClick={handlePrevPage} disabled={page === 1 || contentLoading}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                    <Button variant="outline" onClick={handleNextPage} disabled={!hasNextPage || contentLoading}>
                        Next <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function ReportedBugsPage() {
    const searchParams = useSearchParams();
    const after = searchParams.get('after') || undefined;

    return <ReportedBugsPageComponent after={after} />;
}
