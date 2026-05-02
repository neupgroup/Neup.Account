import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { checkPermissions } from '@/services/user';
import { getManagedApplications } from '@/services/manage/applications';
import { updateManagedApplicationStatusFromForm } from '@/services/manage/applications/status-action';

const statusOptions = ['development', 'active', 'rejected', 'blocked'] as const;

type AppStatus = (typeof statusOptions)[number];

function badgeVariant(status: string) {
  if (status === 'active') return 'default';
  if (status === 'blocked') return 'destructive';
  return 'secondary';
}

export default async function ManageApplicationsPage() {
  const isRootAppManager = await checkPermissions(['root.app.view']);
  const isBrandManager = await checkPermissions(['linked_accounts.brand.manager']);

  if (!isRootAppManager && !isBrandManager) {
    notFound();
  }

  const applications = await getManagedApplications();

  return (
    <div className="grid gap-8">
      <BackButton href="/manage" />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Applications</h1>
        <p className="text-muted-foreground">
          Review applications and update lifecycle status to active, rejected, blocked, or development.
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No applications</CardTitle>
            <CardDescription>
              No applications are currently available in your management scope.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => {
            const currentStatus = (app.status || 'development') as AppStatus;

            return (
              <Card key={app.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{app.name}</CardTitle>
                      <CardDescription>
                        ID: {app.id}
                      </CardDescription>
                    </div>
                    <Badge variant={badgeVariant(currentStatus)}>{currentStatus}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <form
                    action={updateManagedApplicationStatusFromForm}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input type="hidden" name="appId" value={app.id} />
                    <select
                      name="status"
                      defaultValue={currentStatus}
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <Button type="submit">Update Status</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
