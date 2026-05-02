'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Ban, Loader2 } from '@/components/icons';
import { BackButton } from '@/components/ui/back-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { checkPermissions } from '@/services/user';
import { useToast } from '@/core/hooks/use-toast';
import { getDisplayNameRequests, processDisplayNameRequest, type DisplayNameRequest } from '@/services/manage/requests/display-name';


export default function DisplayNameRequestsPage() {
    const [requests, setRequests] = useState<DisplayNameRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchRequests = async () => {
        setLoading(true);
        const data = await getDisplayNameRequests();
        setRequests(data);
        setLoading(false);
    };

    useEffect(() => {
        const verifyPermission = async () => {
            const canView = await checkPermissions(['root.requests.view']);
            setPermissionState(canView ? 'granted' : 'denied');
        };
        verifyPermission();
    }, []);

    useEffect(() => {
        if(permissionState === 'granted') {
            fetchRequests();
        }
    }, [permissionState]);

    const handleAction = (requestId: string, accountId: string, displayName: string, approve: boolean) => {
        startTransition(async () => {
            const result = await processDisplayNameRequest(requestId, accountId, displayName, approve);
            if (result.success) {
                toast({ title: "Success", description: `Request has been ${approve ? 'approved' : 'rejected'}.` });
                fetchRequests();
            } else {
                 toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }

     if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <BackButton href="/manage/requests" />
                 <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view this page.</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Display Name Requests</h1>
                <p className="text-muted-foreground">
                    Review and approve custom display name requests from users.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Pending Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Requested Name</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : requests.length > 0 ? (
                                requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                             <Link href={`/manage/${req.accountId}`} className="font-medium text-primary hover:underline">
                                                {req.userFullName}
                                             </Link>
                                        </TableCell>
                                        <TableCell className="font-medium">{req.requestedDisplayName}</TableCell>
                                        <TableCell>{req.createdAt}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button size="sm" variant="secondary" onClick={() => handleAction(req.id, req.accountId, req.requestedDisplayName, false)} disabled={isPending}>Reject</Button>
                                            <Button size="sm" onClick={() => handleAction(req.id, req.accountId, req.requestedDisplayName, true)} disabled={isPending}>Approve</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No pending display name requests.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}