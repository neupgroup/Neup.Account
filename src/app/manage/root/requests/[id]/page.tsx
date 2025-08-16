

import { getNeupIdRequestDetails } from '@/app/manage/root/requests/neupid/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RequestDecisionForm } from './form';
import { notFound } from 'next/navigation';

export default async function NeupIdRequestDetailsPage({ params }: { params: { id: string } }) {
    const requestDetails = await getNeupIdRequestDetails(params.id);

    if (!requestDetails) {
        notFound();
    }

    return (
        <div className="grid gap-6">
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
