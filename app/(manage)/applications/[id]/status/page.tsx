import { notFound } from 'next/navigation';
import { getApplicationDetailsForViewerV2, getAppStatusLog, getAppPublicationRequestStatus } from '@/services/applications/manage';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import { AppPublishPanel } from '@/app/(manage)/applications/_components/app-publish-panel';

type Props = { params: Promise<{ id: string }> };

const logStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Success: 'default',
  Pending: 'secondary',
  Alert: 'destructive',
  Failed: 'destructive',
};

export default async function ApplicationStatusPage({ params }: Props) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewerV2(id);

  if (!details) notFound();

  if (!details.canDelete && !details.isRootViewer) {
    return (
      <div className="grid gap-8">
        <div className="space-y-4">
          <BackButton href={`/applications/${id}`} />
          <PrimaryHeader title="Status" description="Application publication status." />
        </div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>Only the application owner or an administrator can view this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const [log, publicationRequestStatus] = await Promise.all([
    getAppStatusLog(id),
    getAppPublicationRequestStatus(id),
  ]);

  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <BackButton href={`/applications/${id}`} />
        <PrimaryHeader
          title="Status"
          description={`Publication status and activity log for ${details.name}.`}
        />
      </div>

      {details.canDelete && (
        <AppPublishPanel
          appId={id}
          currentStatus={details.status ?? 'development'}
          publicationRequestStatus={publicationRequestStatus}
        />
      )}

      {details.isRootViewer && !details.canDelete && (
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
            <CardDescription>
              Use the root Applications view to change this application's status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                details.status === 'active' ? 'default'
                : details.status === 'development' ? 'secondary'
                : 'destructive'
              }
              className="capitalize text-sm px-3 py-1"
            >
              {details.status ?? 'unknown'}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Status changes, publication requests, approvals, and rejections for this application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {log.map((entry, i) => {
                const isFirst = i === 0;
                const isLast = i === log.length - 1;
                const roundingClass =
                  isFirst && isLast ? 'rounded-lg'
                  : isFirst ? 'rounded-t-lg'
                  : isLast ? 'rounded-b-lg'
                  : '';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-start justify-between gap-4 border border-border bg-card px-4 py-3 ${roundingClass} ${!isFirst ? '-mt-px' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{entry.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.timestamp}</p>
                    </div>
                    <Badge
                      variant={logStatusVariant[entry.status] ?? 'outline'}
                      className="text-xs shrink-0 capitalize"
                    >
                      {entry.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
