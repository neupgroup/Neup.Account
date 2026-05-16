import { Suspense } from 'react';
import { checkPermissions } from '@/services/user';
import { getApplicationChangeRequests } from '@/services/applications/change-requests';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ban, ChevronRight } from '@/components/icons';
import { FlowLink } from '@/components/ui/flow-link';
import { BackButton } from '@/components/ui/back-button';

type Props = {
  searchParams: Promise<{ type?: string; application?: string }>;
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  denied: 'destructive',
};

async function ApplicationChangesContent({ appId }: { appId?: string }) {
  const canView = await checkPermissions(['root.requests.view']);

  if (!canView) {
    return (
      <Alert variant="destructive">
        <Ban className="h-4 w-4" />
        <AlertTitle>Permission Denied</AlertTitle>
        <AlertDescription>You do not have permission to view this page.</AlertDescription>
      </Alert>
    );
  }

  const requests = await getApplicationChangeRequests({ appId });

  return (
    <div className="grid gap-6">
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No pending application change requests{appId ? ' for this application' : ''}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {requests.map((req) => (
                <FlowLink
                  key={req.id}
                  href={`/requests/application-changes/${req.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{req.appName}</p>
                      <Badge variant={statusVariant[req.status] ?? 'outline'} className="capitalize text-xs">
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {req.changes.length} field{req.changes.length !== 1 ? 's' : ''} changed · by {req.submittedBy} · {req.submittedAt}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </FlowLink>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default async function ApplicationChangesPage({ searchParams }: Props) {
  const { application } = await searchParams;

  return (
    <div className="grid gap-8">
      <div>
        <BackButton href="/requests" />
        <h1 className="text-3xl font-bold tracking-tight mt-4">Application Change Requests</h1>
        <p className="text-muted-foreground">
          {application
            ? 'Pending change requests for this application. Approve to apply, deny to reject.'
            : 'All pending application change requests. Approve to apply changes, deny to reject.'}
        </p>
      </div>

      <Suspense fallback={<Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Loading...</CardContent></Card>}>
        <ApplicationChangesContent appId={application} />
      </Suspense>
    </div>
  );
}
