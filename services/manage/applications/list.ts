import { checkPermissions } from '@/core/helpers/user';
import { getManagedApplications } from '@/services/manage/applications';
import { getSignedApplications } from '@/services/data/signed-applications';

/**
 * Type FlatAppItem.
 */
export type FlatAppItem = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  developer?: string;
  source: 'managed' | 'connected';
};


/**
 * Function getApplicationsPageData.
 */
export async function getApplicationsPageData() {
  const managedApplications = await getManagedApplications();
  const { internal, external } = await getSignedApplications();
  const canCreateApplication = await checkPermissions(['root.app.create']);
  const connectedApplications = [...internal, ...external];

  const managedItems: FlatAppItem[] = managedApplications.map((app) => ({
    id: app.id,
    name: app.name,
    slug: app.slug,
    icon: app.icon,
    developer: app.developer,
    source: 'managed',
  }));

  const managedIds = new Set(managedItems.map((app) => app.id));
  const connectedItems: FlatAppItem[] = connectedApplications
    .filter((app) => !managedIds.has(app.id))
    .map((app) => ({
      id: app.id,
      name: app.name,
      slug: app.slug,
      icon: app.icon,
      developer: app.developer,
      source: 'connected',
    }));

  return {
    allApplications: [...managedItems, ...connectedItems],
    canCreateApplication,
  };
}
