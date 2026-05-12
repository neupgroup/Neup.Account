import { FlowLink } from '@/components/ui/flow-link';
import { getApplicationsPageDataV2 } from '@/services/applications/form-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from '@/components/icons';
import { Suspense } from 'react';
import { ApplicationsPillView } from './_components/applications-pill-view';

export default async function ApplicationsPage() {
  const { sections, canCreateApplication, hasPartialError } = await getApplicationsPageDataV2();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Manage your applications and connected application access.
          </p>
        </div>
      </div>

      {hasPartialError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Partial load</AlertTitle>
          <AlertDescription>
            Some application data could not be loaded. The sections below may be incomplete.
          </AlertDescription>
        </Alert>
      )}

      <Suspense fallback={null}>
        <ApplicationsPillView sections={sections} canCreateApplication={canCreateApplication} />
      </Suspense>
    </div>
  );
}
