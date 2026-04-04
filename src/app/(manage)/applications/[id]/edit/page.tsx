import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApplicationAccessForm } from '@/app/(manage)/applications/_components/application-access-form';
import { getUserApplicationAccess } from '@/actions/data/application-access';

type EditApplicationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditApplicationPage({ params }: EditApplicationPageProps) {
  const { id } = await params;
  const app = await getUserApplicationAccess(id);

  if (!app) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Application</h1>
          <p className="text-muted-foreground">Update stored permissions for {app.name}.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/applications/${app.id}`}>Back to Details</Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{app.name}</CardTitle>
          <CardDescription>
            {app.connectionType === 'external'
              ? 'This app is connected externally. Saving permissions here creates an internal access record for your account.'
              : 'Edit the permissions list for this app.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationAccessForm mode="edit" initialAppId={app.id} initialPermissions={app.permissions} />
        </CardContent>
      </Card>
    </div>
  );
}
