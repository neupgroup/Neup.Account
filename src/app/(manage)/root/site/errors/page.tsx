
"use client";

import Link from "next/link";
import React, { useEffect, useState, useCallback } from 'react';
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
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"
import { getSystemErrors } from "@/actions/root/site";
import type { SystemError } from "@/types";
import { checkPermissions } from "@/lib/user";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Ban } from "@/components/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


function ErrorsPageSkeleton() {
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
                    <Skeleton className="h-5 w-1/2" />
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
    )
}


const typeVariantMap: { [key: string]: "default" | "destructive" | "secondary" } = {
    database: "destructive",
    auth: "destructive",
    ai: "secondary",
    validation: "secondary",
    unknown: "default",
};

function SystemErrorsPageComponent({ after }: { after?: string }) {
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [errors, setErrors] = useState<SystemError[]>([]);
    const [contentLoading, setContentLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageHistory, setPageHistory] = useState<(string | undefined)[]>([undefined]); // History of 'after' IDs
    const [hasNextPage, setHasNextPage] = useState(false);

    const router = useRouter();

    const fetchData = useCallback(async (startAfter?: string) => {
        setContentLoading(true);
        const data = await getSystemErrors({ startAfter });
        setErrors(data.errors);
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
        if (errors.length > 0) {
            const lastId = errors[errors.length - 1].id;
            const newHistory = [...pageHistory, lastId];
            setPageHistory(newHistory);
            setPage(p => p + 1);
            router.push(`/manage/root/site/errors?after=${lastId}`);
        }
    };

    const handlePrevPage = () => {
        const prevPageHistory = pageHistory.slice(0, -1);
        const prevAfterId = prevPageHistory[prevPageHistory.length - 1];
        setPageHistory(prevPageHistory);
        setPage(p => p - 1);
        const url = prevAfterId ? `/manage/root/site/errors?after=${prevAfterId}` : '/manage/root/site/errors';
        router.push(url);
    };

    if (permissionState === 'loading') {
        return <ErrorsPageSkeleton />;
    }

    if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <BackButton href="/manage/root/site" />
                 <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view system errors.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Errors</h1>
                <p className="text-muted-foreground">
                    A log of all system-level errors captured by the logger.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Error Log</CardTitle>
                    <CardDescription>
                        Here is a list of recent errors recorded in the system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">Type</TableHead>
                                <TableHead className="w-[200px]">Context</TableHead>
                                <TableHead className="w-[200px]">Timestamp</TableHead>
                                <TableHead>Message</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contentLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                             ) : errors.length > 0 ? (
                                errors.map((error) => (
                                    <TableRow key={error.id}>
                                        <TableCell>
                                            <Badge variant={typeVariantMap[error.type] || "default"}>
                                                {error.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{error.context}</TableCell>
                                        <TableCell>{error.timestamp}</TableCell>
                                        <TableCell className="max-w-xs">
                                             <Link href={`/manage/root/site/errors/${error.id}`} className="hover:underline text-sm block truncate" target="_blank" rel="noopener noreferrer">
                                                {error.message}
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        No system errors recorded.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                     <Button variant="outline" onClick={handlePrevPage} disabled={page === 1 || contentLoading}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                    <Button variant="outline" onClick={handleNextPage} disabled={!hasNextPage || contentLoading}>
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

export default function SystemErrorsPage() {
    const searchParams = useSearchParams();
    const after = searchParams.get('after') || undefined;

    return (
        <React.Suspense fallback={<ErrorsPageSkeleton />}>
            <SystemErrorsPageComponent after={after} />
        </React.Suspense>
    );
}
