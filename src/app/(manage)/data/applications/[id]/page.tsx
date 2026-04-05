import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  deleteManagedApplication,
  getApplicationDetailsForViewer,
} from '@/actions/manage/applications';
import { AppWindow, Building, BarChart, Share2, ExternalLink, type LucideIcon } from '@/components/icons';

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
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

function LinkOrDisabledButton({ href, enabledLabel, disabledLabel, enabled }: { href?: string; enabledLabel: string; disabledLabel: string; enabled: boolean }) {
  if (!href) {
    return <Button variant="outline" size="sm" disabled>{disabledLabel}</Button>;
  }

  if (!enabled) {
    return <Button variant="outline" size="sm" disabled>{disabledLabel}</Button>;
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

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewer(id);

  if (!details) {
    notFound();
  }

  const Icon = iconFor(details.icon);

  async function deleteAction() {
    'use server';

    const result = await deleteManagedApplication(id);
    if (result.success) {
      redirect('/data/applications');
    }
  }

  const accessItems = details.hasUsedApp
    ? details.accessedData
    : details.configuredAccess;

  const termsTitle = details.hasUsedApp ? 'Terms agreed by user' : 'Terms to agree before using app';

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{details.name}</h1>
            <p className="text-muted-foreground">{details.description || 'No description available.'}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/data/applications">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Builder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Company or individual: {details.developer || 'Not provided'}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Access</CardTitle>
          <CardDescription>
            {details.hasUsedApp ? 'Data this app has accessed for your account.' : 'Data this app will access if you use it.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessItems.length > 0 ? (
            <ul className="list-disc pl-5 text-sm">
              {accessItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No access fields listed.</p>
          )}
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>
            Actions are enabled when you have used this app.
          </CardDescription>
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
            {details.endpoints.accountBlock ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details.endpoints.accountBlock}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {details.canDelete ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Owner Actions</CardTitle>
            <CardDescription>Only the owner of this app can delete it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deleteAction}>
              <Button type="submit" variant="destructive">Delete Application</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
