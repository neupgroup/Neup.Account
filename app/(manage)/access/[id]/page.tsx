import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAccessDetails, getMasterPermissions } from '@/services/manage/access';
import { AccessManagementForm } from './form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccessDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [details, allPermissions] = await Promise.all([
    getAccessDetails(id),
    getMasterPermissions(),
  ]);

  if (!details) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <BackButton href="/access" />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{details.grantedTo.name}</h1>
        <p className="text-muted-foreground">
          {details.grantedTo.neupId !== 'N/A' ? `@${details.grantedTo.neupId}` : details.grantedTo.id}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grant Details</CardTitle>
          <CardDescription>Overview of this access grant.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-muted-foreground">Granted to</span>
            <span className="font-medium">{details.grantedTo.name}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-muted-foreground">NeupID</span>
            <span className="font-medium">{details.grantedTo.neupId}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-muted-foreground">Granted by</span>
            <span className="font-medium">{details.grantedBy.name}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Permissions</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {details.permissions.length > 0 ? (
                details.permissions.map((p) => (
                  <Badge key={p} variant="secondary" className="font-mono text-xs">
                    {p}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AccessManagementForm
        permitId={details.permitId}
        allPermissions={allPermissions}
        currentPermissionIds={details.permissions}
      />
    </div>
  );
}
