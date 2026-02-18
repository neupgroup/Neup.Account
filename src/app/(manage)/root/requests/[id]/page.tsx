
'use client';

import { getNeupIdRequestDetails } from '@/actions/root/requests/neupid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RequestDecisionForm } from './form';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PendingNeupIdRequest } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';

function RequestDetailsSkeleton() {
    return (
        <div className="grid gap-6">
             <BackButton href="/manage/root/requests" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-1/2" />
                    <Skeleton className="h-5 w-3/4 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                     </div>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader>
                    <Skeleton className="h-7 w-1/3" />
                    <Skeleton className="h-5 w-1/2 mt-2" />
                </CardHeader>
                 <CardContent>
                    <div className="flex space-x-4">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                 </CardContent>
            </Card>
        </div>
    )
}


export default function NeupIdRequestDetailsPage() {
    const params = useParams<{ id: string }>();
    const [requestDetails, setRequestDetails] = useState<PendingNeupIdRequest | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            const data = await getNeupIdRequestDetails(params.id);
            if (!data) {
                notFound();
            }
            setRequestDetails(data);
            setLoading(false);
        }
        fetchDetails();
    }, [params.id]);


    if (loading || !requestDetails) {
        return <RequestDetailsSkeleton />;
    }

    return (
        <div className="grid gap-6">
            <BackButton href="/manage/root/requests" />
            <Card>
                <CardHeader>
                    <CardTitle>NeupID Request Details</CardTitle>
                    <CardDescription>Review and process the NeupID request from {requestDetails.userFullName}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">User</p>
                            <p className="font-medium">{requestDetails.userFullName}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Requested NeupID</p>
                            <p className="font-mono font-medium">{requestDetails.requestedNeupId}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Request Date</p>
                            <p>{requestDetails.requestDate}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Status</p>
                            <div><Badge variant={requestDetails.status === 'pending' ? 'secondary' : requestDetails.status === 'approved' ? 'default' : 'destructive'} className={requestDetails.status === 'approved' ? 'bg-accent text-accent-foreground' : ''}>{requestDetails.status}</Badge></div>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <p className="text-muted-foreground">Current NeupIDs</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {requestDetails.currentNeupIds.map(id => <Badge key={id} variant="outline">{id}</Badge>)}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Take Action</CardTitle>
                    <CardDescription>Approve or deny this request. This action is irreversible.</CardDescription>
                </CardHeader>
                <CardContent>
                   <RequestDecisionForm request={requestDetails} />
                </CardContent>
            </Card>
        </div>
    );
}
