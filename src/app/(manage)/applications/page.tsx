import Link from 'next/link';
import { format } from 'date-fns';
import { getManagedApplications } from '@/actions/manage/applications';
import { getSignedApplications } from '@/actions/data/signed-applications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppWindow, ExternalLink, Share2 } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      No {label.toLowerCase()} applications yet.
    </div>
  );
}

type AppItem = {
  id: string;
  name: string;
  description: string;
  website?: string;
  developer?: string;
  signedAt: Date;
};

type OwnedAppItem = {
  id: string;
  name: string;
  createdAt: Date;
  hasSecretKey: boolean;
};

function AppList({ apps }: { apps: AppItem[] }) {
  return (
    <div className="divide-y rounded-md border">
      {apps.map((app) => (
        <div key={app.id} className="flex items-start justify-between gap-4 p-4">
          <div className="space-y-1">
            <p className="font-medium">{app.name}</p>
            <p className="text-sm text-muted-foreground">{app.description || 'No description available.'}</p>
            <p className="text-xs text-muted-foreground">Signed on {format(app.signedAt, 'PPP')}</p>
            {app.developer ? (
              <p className="text-xs text-muted-foreground">Developer: {app.developer}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs">{app.id}</code>
            {app.website ? (
              <Link
                href={app.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline"
              >
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnedAppList({ apps }: { apps: OwnedAppItem[] }) {
  return (
    <div className="divide-y rounded-md border">
      {apps.map((app) => (
        <div key={app.id} className="flex items-start justify-between gap-4 p-4">
          <div className="space-y-1">
            <p className="font-medium">{app.name}</p>
            <p className="text-xs text-muted-foreground">Created on {format(app.createdAt, 'PPP')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={app.hasSecretKey ? 'secondary' : 'outline'}>
              {app.hasSecretKey ? 'Secret saved' : 'No secret yet'}
            </Badge>
            <code className="rounded bg-muted px-2 py-1 text-xs">{app.id}</code>
            <Button variant="outline" asChild size="sm">
              <Link href={`/applications/${app.id}`}>Open</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ApplicationsPage() {
  const managedApplications = await getManagedApplications();
  const { internal, external } = await getSignedApplications();
  const total = internal.length + external.length;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Create your own applications and review apps you have already signed into. Connected apps: {total}.
          </p>
        </div>
        <Button asChild>
          <Link href="/applications/add">Create Application</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Applications</CardTitle>
          <CardDescription>Applications you own and configure yourself.</CardDescription>
        </CardHeader>
        <CardContent>
          {managedApplications.length > 0 ? <OwnedAppList apps={managedApplications} /> : <EmptyState label="Owned" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AppWindow className="h-5 w-5" />
            Internal Applications
          </CardTitle>
          <CardDescription>Apps inside the Neup ecosystem connected to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {internal.length > 0 ? <AppList apps={internal} /> : <EmptyState label="Internal" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            External Applications
          </CardTitle>
          <CardDescription>Third-party apps where you used NeupAccount to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          {external.length > 0 ? <AppList apps={external} /> : <EmptyState label="External" />}
        </CardContent>
      </Card>
    </div>
  );
}
