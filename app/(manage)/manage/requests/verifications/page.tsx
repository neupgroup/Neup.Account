
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/core/hooks/use-toast';
import { getPendingVerificationRequests, grantVerification, revokeVerification } from '@/services/manage/verifications';
import type { VerificationRequest } from '@/types';
import { checkPermissions } from '@/lib/user';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, UserCheck, Loader2, Ban } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

function VerificationSkeleton() {
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    )
}

function RequestCard({ request, onAction }: { request: VerificationRequest, onAction: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleApprove = () => {
        startTransition(async () => {
            // In a real app, you'd have a dialog to ask for category/reason.
            const reason = "User meets verification criteria.";
            const category = "Community Leader";
            const result = await grantVerification(request.accountId, { reason, category });
            if (result.success) {
                toast({ title: 'Verification Approved', className: "bg-accent text-accent-foreground" });
                onAction();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }

     const handleReject = () => {
        startTransition(async () => {
            const reason = "Does not meet verification criteria at this time.";
            const result = await revokeVerification(request.accountId, reason);
            if (result.success) {
                toast({ title: 'Verification Rejected' });
                onAction();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <Link href={`/manage/${request.accountId}`} className="hover:underline">
                    {request.fullName}
                  </Link>
                </CardTitle>
                <CardDescription>@{request.neupId}</CardDescription>
            </CardHeader>
             <CardContent>
                <p className="text-sm text-muted-foreground">Requested on {request.requestedAt}</p>
            </CardContent>
            <CardFooter className="gap-2">
                <Button onClick={handleApprove} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Approve
                </Button>
                <Button onClick={handleReject} disabled={isPending} variant="destructive">
                     {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reject
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function VerificationsPage() {
    const [requests, setRequests] = useState<VerificationRequest[]>([]);
    const [contentLoading, setContentLoading] = useState(true);
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');

    const fetchRequests = async () => {
        setContentLoading(true);
        const data = await getPendingVerificationRequests();
        setRequests(data);
        setContentLoading(false);
    }
    
    useEffect(() => {
        const verifyPermission = async () => {
            const canView = await checkPermissions(['root.requests.view']);
            setPermissionState(canView ? 'granted' : 'denied');
        }
        verifyPermission();
    }, []);

    useEffect(() => {
        if(permissionState === 'granted') {
            fetchRequests();
        }
    }, [permissionState])

    if (permissionState === 'loading') {
        return <VerificationSkeleton />;
    }

     if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <BackButton href="/manage/requests" />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view verification requests.</AlertDescription>
                </Alert>
            </div>
        )
    }
    
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Verification Requests</h1>
                <p className="text-muted-foreground">Review and process user requests for account verification.</p>
            </div>
            {contentLoading ? (
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            ) : requests.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.map((req) => (
                        <RequestCard key={req.id} request={req} onAction={fetchRequests} />
                    ))}
                </div>
            ) : (
                 <Card className="col-span-full">
                    <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-4">
                        <UserCheck className="h-12 w-12" />
                        <h3 className="text-lg font-semibold">All caught up!</h3>
                        <p>There are no pending verification requests to review.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
