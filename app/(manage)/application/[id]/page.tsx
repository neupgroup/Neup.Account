import Link from 'next/link';
import { FlowLink } from '@/components/ui/flow-link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApplicationDetailsForViewerV2, getApplicationUserStats, getSilentSsoOrigins } from '@/services/applications/manage';
import { deleteManagedApplicationFromDetailsPage } from '@/services/applications/form-actions';
import { AppWindow, Building, BarChart, Share2, ExternalLink, ChevronRight, Users, UserPlus, ArrowLeft, type LucideIcon } from '@/components/icons';

type Props = { params: Promise<{ id: string }> };

function iconFor(appIcon?: string): LucideIcon {
  const appIconMap: Record<string, LucideIcon> = {
    'app-window': AppWindow,
    building: Building,
    'bar-chart': BarChart,
    'share-2': Share2,
  };
  return appIcon ? (appIconMap[appIcon] || AppWindow) : AppWindow;
}

function LinkOrDisabledButton({
  href,
  enabledLabel,
  disabledLabel,
  enabled,
}: {
  href?: string;
  enabledLabel: string;
  disabledLabel: string;
  enabled: boolean;
}) {
  if (!href || !enabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {disabledLabel}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
        {enabledLabel}
        <ExternalLink className="h-4 w-4" />
      </Link>
    </Button>
  );
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  development: 'secondary',
  rejected: 'destructive',
  blocked: 'destructive',
};

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewerV2(id);

  if (!details) notFound();

  const Icon = iconFor(details.icon);
  const deleteAction = deleteManagedApplicationFromDetailsPage.bind(null, id);

  const [silentSsoOrigins, userStats] = await Promise.all([
    details.canDelete ? getSilentSsoOrigins(id) : Promise.resolve([]),
    getApplicationUserStats(id),
  ]);

  const termsTitle = details.hasUsedApp ? 'Terms agreed by user' : 'Terms to agree before using app';

  return (
    <div className="grid gap-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 text-muted-foreground">
          <FlowLink href="/application">
            <ArrowLeft className="h-4 w-4" />
            Back
          </FlowLink>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40 shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{details.name}</h1>
              {details.status && (
                <Badge variant={statusVariant[details.status] ?? 'outline'} className="capitalize">
                  {details.status}
                </Badge>
              )}
              {details.isInternal && (
                <Badge variant="outline">Internal</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{details.description || 'No description available.'}</p>
            {details.website && (
              <a
                href={details.website}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                {details.website}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* User Stats */}
      <Card>
        <CardContent className="grid p-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
          {[
            { label: 'Total Users', value: userStats?.total ?? 0, description: 'All connected accounts', icon: Users },
            { label: 'Last 24 Hours', value: userStats?.last24h ?? 0, description: 'New connections today', icon: UserPlus },
            { label: 'Last 7 Days', value: userStats?.lastWeek ?? 0, description: 'New connections this week', icon: UserPlus },
            { label: 'Last 30 Days', value: userStats?.lastMonth ?? 0, description: 'New connections this month', icon: UserPlus },
          ].map(({ label, value, description, icon: Icon }) => (
            <div key={label} className="p-6">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">{label}</h3>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Terms / policies */}
      <Card>
        <CardHeader>
          <CardTitle>{termsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {details.policies.length > 0 ? (
            <div className="space-y-3">
              {details.policies.map((policy) => (
                <div key={policy.name} className="rounded-md border p-3">
                  <p className="font-medium text-sm">{policy.name}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{policy.policy}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No terms published by this app.</p>
          )}
        </CardContent>
      </Card>

      {/* Account actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>Actions are enabled when you have used this app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Logout</p>
            <div className="flex flex-wrap gap-2">
              <LinkOrDisabledButton
                href={details.endpoints.logoutPage}
                enabled={details.hasUsedApp}
                enabledLabel="Open logout page"
                disabledLabel="Logout page unavailable"
              />
              <LinkOrDisabledButton
                href={details.endpoints.logoutApi}
                enabled={details.hasUsedApp}
                enabledLabel="Open logout API"
                disabledLabel="Logout API unavailable"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Account Deletion</p>
            <div className="flex flex-wrap gap-2">
              <LinkOrDisabledButton
                href={details.endpoints.dataDeletionPage}
                enabled={details.hasUsedApp}
                enabledLabel="Open deletion page"
                disabledLabel="Deletion page unavailable"
              />
              <LinkOrDisabledButton
                href={details.endpoints.dataDeletionApi}
                enabled={details.hasUsedApp}
                enabledLabel="Open deletion API"
                disabledLabel="Deletion API unavailable"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Account Block</p>
            <div className="flex flex-wrap gap-2">
              <LinkOrDisabledButton
                href={details.endpoints.accountBlockApi}
                enabled={details.hasUsedApp}
                enabledLabel="Open block API"
                disabledLabel="Block API unavailable"
              />
            </div>
            {details.endpoints.accountBlock && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {details.endpoints.accountBlock}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manage Application */}
      <div className="grid gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Manage Application</h2>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <FlowLink
            href={`/application/${id}/meta`}
            className="group flex items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-medium">General Info</p>
              <p className="text-sm text-muted-foreground">Edit name, description, icon, and website.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </FlowLink>

          <FlowLink
            href={`/application/${id}/status`}
            className="group flex items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-medium">Status</p>
              <p className="text-sm text-muted-foreground">Request publication and view the activity log.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </FlowLink>

          <FlowLink
            href={`/application/${id}/capability`}
            className="group flex items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-medium">Capabilities</p>
              <p className="text-sm text-muted-foreground">Define individual permissions this application can assign.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </FlowLink>

          <FlowLink
            href={`/application/${id}/roles`}
            className="group flex items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-medium">Roles</p>
              <p className="text-sm text-muted-foreground">Group capabilities into roles for access grants.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </FlowLink>

          <FlowLink
            href={`/application/${id}/ownership`}
            className="group flex items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-medium">Ownership</p>
              <p className="text-sm text-muted-foreground">View who owns and has access to this application.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </FlowLink>

          <FlowLink
            href={`/application/${id}/silent-sso-origins`}
            className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-medium">Silent SSO Origins</p>
              <p className="text-sm text-muted-foreground">
                {silentSsoOrigins.length > 0
                  ? `${silentSsoOrigins.length} origin${silentSsoOrigins.length === 1 ? '' : 's'} registered.`
                  : 'Trusted origins for the NeupID iframe bridge.'}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </FlowLink>
        </div>
      </div>

      {details.canDelete && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Owner Actions</CardTitle>
            <CardDescription>Only the owner of this app can delete it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deleteAction}>
              <Button type="submit" variant="destructive">
                Delete Application
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
