'use server';

// Next.js form actions and page data loaders for the applications UI.

import { redirect } from 'next/navigation';
import { checkPermissions } from '@/services/user';
import { deleteManagedApplication, getManagedApplications, updateManagedApplicationStatus } from '@/services/applications/manage';
import { getSignedApplications } from '@/services/applications/connected';

export type FlatAppItem = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  developer?: string;
  source: 'managed' | 'connected';
};

// Aggregates managed and connected applications for the applications list page.
export async function getApplicationsPageData() {
  const managedApplications = await getManagedApplications();
  const { internal, external } = await getSignedApplications();
  const canCreateApplication = await checkPermissions(['root.app.create']);
  const connectedApplications = [...internal, ...external];

  const managedItems: FlatAppItem[] = managedApplications.map((app) => ({
    id: app.id,
    name: app.name,
    icon: app.icon || undefined,
    developer: app.developer || undefined,
    source: 'managed',
  }));

  const managedIds = new Set(managedItems.map((app) => app.id));
  const connectedItems: FlatAppItem[] = connectedApplications
    .filter((app) => !managedIds.has(app.id))
    .map((app) => ({
      id: app.id,
      name: app.name,
      icon: app.icon || undefined,
      developer: app.developer || undefined,
      source: 'connected',
    }));

  return {
    allApplications: [...managedItems, ...connectedItems],
    canCreateApplication,
  };
}

// Deletes an application and redirects back to the applications list.
export async function deleteManagedApplicationFromDetailsPage(applicationId: string) {
  const result = await deleteManagedApplication(applicationId);
  if (result.success) {
    redirect('/data/applications');
  }
}

const statusOptions = ['development', 'active', 'rejected', 'blocked'] as const;
type AppStatus = (typeof statusOptions)[number];

// Updates application status from a form submission.
export async function updateManagedApplicationStatusFromForm(formData: FormData) {
  const appId = String(formData.get('appId') || '');
  const status = String(formData.get('status') || '') as AppStatus;
  if (!statusOptions.includes(status)) return;
  await updateManagedApplicationStatus({ appId, status });
}
