import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getManagedApplication } from '@/actions/manage/applications';
import { getUserApplicationAccess } from '@/actions/data/application-access';
import { ApplicationManagementPanel } from '@/app/(manage)/applications/_components/application-management-panel';

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

function LegacyApplicationDetails({ app }: { app: NonNullable<Awaited<ReturnType<typeof getUserApplicationAccess>>> }) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
          <p className="text-muted-foreground">{app.description || 'No description available.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/applications">Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/applications/${app.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          <CardDescription>Connection and metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">App ID:</span>
            <code className="rounded bg-muted px-2 py-1">{app.id}</code>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="secondary">{app.connectionType}</Badge>
          </div>

          <p>
            <span className="text-muted-foreground">Signed on:</span> {format(app.connectedOn, 'PPP')}
          </p>

          <p>
            <span className="text-muted-foreground">Developer:</span> {app.developer || 'N/A'}
          </p>

          <p>
            <span className="text-muted-foreground">Website:</span>{' '}
            {app.website ? (
              <Link href={app.website} target="_blank" rel="noreferrer" className="underline text-primary">
                {app.website}
              </Link>
            ) : (
              'N/A'
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>Permissions stored for internal application access.</CardDescription>
        </CardHeader>
        <CardContent>
          {app.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {app.permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No stored permissions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;

  const managedApplication = await getManagedApplication(id);
  if (managedApplication) {
    return (
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{managedApplication.name}</h1>
            <p className="text-muted-foreground">Configure the application you just created.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/applications">Back to Applications</Link>
          </Button>
        </div>

        <ApplicationManagementPanel application={managedApplication} />
      </div>
    );
  }

  const legacyApplication = await getUserApplicationAccess(id);
  if (!legacyApplication) {
    notFound();
  }

  return <LegacyApplicationDetails app={legacyApplication} />;
}
