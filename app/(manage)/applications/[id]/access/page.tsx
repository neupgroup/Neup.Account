import { notFound } from 'next/navigation';
import { getApplicationDetailsForViewerV2 } from '@/services/applications/manage';
import { getUserApplicationAccess } from '@/services/applications/access';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApplicationAccessForm } from '@/app/(manage)/applications/_components/application-access-form';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationAccessPage({ params }: Props) {
  const { id } = await params;

  const [details, access] = await Promise.all([
    getApplicationDetailsForViewerV2(id),
    getUserApplicationAccess(id),
  ]);

  if (!details) notFound();

  const isConnected = Boolean(access);
  const mode = isConnected ? 'edit' : 'add';

  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <BackButton href={`/applications/${id}`} />
        <PrimaryHeader
          title="Access & Permissions"
          description={`Manage your access to ${details.name}.`}
        />
      </div>

      {access && (
        <Card>
          <CardHeader>
            <CardTitle>Current Access</CardTitle>
            <CardDescription>
              Connected on{' '}
              {new Date(access.connectedOn).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline" className="capitalize">
                {access.connectionType}
              </Badge>
            </div>
            {access.permissions.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Permissions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {access.permissions.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs font-mono">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No permissions assigned.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isConnected ? 'Update Permissions' : 'Connect to Application'}</CardTitle>
          <CardDescription>
            {isConnected
              ? 'Update the permissions granted to this application for your account.'
              : 'Connect your account to this application and set initial permissions.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationAccessForm
            mode={mode}
            initialAppId={id}
            initialPermissions={access?.permissions ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
