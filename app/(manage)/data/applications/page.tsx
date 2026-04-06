import Link from 'next/link';
import { getManagedApplications } from '@/actions/manage/applications';
import { getSignedApplications } from '@/actions/data/signed-applications';
import { Button } from '@/components/ui/button';
import { AppWindow, Building, BarChart, Share2, ChevronRight, type LucideIcon } from '@/components/icons';
import { checkPermissions } from '@/lib/user';

type FlatAppItem = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  developer?: string;
  source: 'managed' | 'connected';
};

function iconFor(appIcon?: string): LucideIcon {
  const appIconMap: Record<string, LucideIcon> = {
    'app-window': AppWindow,
    building: Building,
    'bar-chart': BarChart,
    'share-2': Share2,
  };

  return appIcon ? (appIconMap[appIcon] || AppWindow) : AppWindow;
}

function SingleList({ apps }: { apps: FlatAppItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {apps.map((app) => (
        <Link
          key={`${app.source}:${app.id}`}
          href={`/data/applications/${app.id}`}
          className="group flex items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 last:border-b-0 sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
              {(() => {
                const Icon = iconFor(app.icon);
                return <Icon className="h-5 w-5 text-muted-foreground" />;
              })()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-medium leading-6">{app.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                @{app.slug || app.id} | by {app.developer || 'Unknown publisher'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  );
}

export default async function ApplicationsPage() {
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

  const allApplications = [...managedItems, ...connectedItems];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Manage your applications and connected application access.
          </p>
        </div>
        {canCreateApplication ? (
          <Button asChild>
            <Link href="/data/applications/add">Create Application</Link>
          </Button>
        ) : null}
      </div>

      {allApplications.length > 0 ? (
        <SingleList apps={allApplications} />
      ) : (
        <p className="text-sm text-muted-foreground">No applications connected yet.</p>
      )}
    </div>
  );
}
