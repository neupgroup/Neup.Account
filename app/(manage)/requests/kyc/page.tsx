
'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { getPendingKycRequests, approveKycRequest, rejectKycRequest } from '@/services/manage/requests/kyc';
import type { KycRequest } from '@/services/manage/requests/kyc';
import { checkPermissions } from '@/services/user';
import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCheck, ShieldCheck, Loader2, Ban } from '@/components/icons';
import { useToast } from '@/core/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


function KycSkeleton() {
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
}

function KycRequestCard({ request, onAction }: { request: KycRequest, onAction: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveKycRequest(request.id, request.accountId);
            if (result.success) {
                toast({ title: 'KYC Approved', description: `KYC for ${request.userFullName} has been approved.`, className: "bg-accent text-accent-foreground" });
                onAction();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }

    const handleReject = () => {
        startTransition(async () => {
            // In a real app, you'd have a dialog to ask for a reason.
            const reason = "Documents were not clear."; 
            const result = await rejectKycRequest(request.id, request.accountId, reason);
            if (result.success) {
                toast({ title: 'KYC Rejected', description: `KYC for ${request.userFullName} has been rejected.` });
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
                    <span>{request.userFullName}</span>
                    <span className="font-mono text-sm font-normal text-muted-foreground">@{request.userNeupId}</span>
                </CardTitle>
                <CardDescription>Submitted on {request.submittedAt}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
                 <Dialog>
                    <DialogTrigger asChild>
                        <Image src={request.documentPhotoUrl} alt={`${request.documentType} photo`} width={300} height={200} className="rounded-md cursor-pointer" data-ai-hint="id card" />
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{request.documentType} for {request.userFullName}</DialogTitle>
                        </DialogHeader>
                        <Image src={request.documentPhotoUrl} alt={`${request.documentType} photo`} width={800} height={500} className="rounded-md" />
                    </DialogContent>
                </Dialog>
                <Dialog>
                    <DialogTrigger asChild>
                        <Image src={request.selfiePhotoUrl} alt="Selfie" width={300} height={300} className="rounded-md cursor-pointer" data-ai-hint="person selfie" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Selfie for {request.userFullName}</DialogTitle>
                        </DialogHeader>
                        <Image src={request.selfiePhotoUrl} alt="Selfie" width={500} height={500} className="rounded-md" />
                    </DialogContent>
                </Dialog>
            </CardContent>
            <CardFooter className="gap-2">
                <Button onClick={handleApprove} disabled={isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Approve
                </Button>
                <Button onClick={handleReject} disabled={isPending} variant="destructive">
                     {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reject
                </Button>
            </CardFooter>
        </Card>
    )
}

export default function KycApprovalPage() {
    const [requests, setRequests] = useState<KycRequest[]>([]);
    const [contentLoading, setContentLoading] = useState(true);
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');


    const fetchRequests = async () => {
        setContentLoading(true);
        const data = await getPendingKycRequests();
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
        return <KycSkeleton />;
    }

    if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <BackButton href="/manage/requests" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
                </div>
                 <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view KYC requests.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
                <p className="text-muted-foreground">Review and process pending KYC document submissions.</p>
            </div>
            {contentLoading ? (
                 <div className="grid md:grid-cols-2 gap-4">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : requests.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                    {requests.map((req) => (
                        <KycRequestCard key={req.id} request={req} onAction={fetchRequests} />
                    ))}
                </div>
            ) : (
                 <Card className="col-span-full">
                    <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-4">
                        <ShieldCheck className="h-12 w-12" />
                        <h3 className="text-lg font-semibold">All Clear!</h3>
                        <p>There are no pending KYC requests to review.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
