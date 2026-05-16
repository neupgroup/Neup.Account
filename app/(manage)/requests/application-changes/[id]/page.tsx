import { notFound } from 'next/navigation';
import { getApplicationChangeRequestDetails } from '@/services/applications/change-requests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/ui/back-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { ApplicationChangeDecisionForm } from './form';

type Props = { params: Promise<{ id: string }> };

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  denied: 'destructive',
};

export default async function ApplicationChangeRequestDetailPage({ params }: Props) {
  const { id } = await params;
  const request = await getApplicationChangeRequestDetails(id);

  if (!request) notFound();

  return (
    <div className="grid gap-6">
      <BackButton href="/requests/application-changes" />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Application Change Request</CardTitle>
              <CardDescription>
                Submitted by {request.submittedBy} on {request.submittedAt} for{' '}
                <span className="font-medium text-foreground">{request.appName}</span>.
              </CardDescription>
            </div>
            <Badge variant={statusVariant[request.status] ?? 'outline'} className="capitalize">
              {request.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border divide-y">
            {request.changes.map((change) => (
              <div key={change.field} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
                <div className="font-medium capitalize text-muted-foreground">{change.field}</div>
                <div className="text-muted-foreground line-through truncate">
                  {change.oldValue ?? <span className="italic">empty</span>}
                </div>
                <div className="font-medium truncate">
                  {change.newValue ?? <span className="italic text-muted-foreground">empty</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Columns: Field · Current value · Proposed value
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Take Action</CardTitle>
          <CardDescription>
            Approving will apply all proposed changes to the application immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {request.status !== 'pending' ? (
            <Alert>
              <Terminal className="h-4 w-4" />
              <AlertTitle>Already processed</AlertTitle>
              <AlertDescription>
                This request has already been <strong>{request.status}</strong>. No further action can be taken.
              </AlertDescription>
            </Alert>
          ) : (
            <ApplicationChangeDecisionForm requestId={request.id} appId={request.appId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
