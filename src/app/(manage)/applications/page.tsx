import Link from 'next/link';
import { format } from 'date-fns';
import { getSignedApplications } from '@/actions/data/signed-applications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppWindow, ExternalLink, Share2 } from '@/components/icons';

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

export default async function ApplicationsPage() {
  const { internal, external } = await getSignedApplications();
  const total = internal.length + external.length;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          Applications you have signed in to using NeupAccount. Total connected: {total}.
        </p>
      </div>

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
