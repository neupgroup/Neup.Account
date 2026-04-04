import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppDisplayName } from '@/lib/auth-callback';
import {
  buildAuthCallbackWithStatus,
  buildAuthPath,
  getApplicationName,
  getServerAuthContext,
} from '@/lib/auth-callback-server';

type PermissionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthPermissionsPage({ searchParams }: PermissionsPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = getServerAuthContext(resolvedSearchParams);

  if (!context.appId || !context.authenticatesTo) {
    redirect('/auth/start');
  }

  const appName = await getApplicationName(context.appId);
  const displayAppName = getAppDisplayName(appName);
  const termsPageUrl = buildAuthPath('/auth/terms', context);
  const denyUrl = buildAuthCallbackWithStatus(context, 'denied');

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Permissions</CardTitle>
          <CardDescription>{displayAppName} is requesting for:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Name</li>
            <li>Email</li>
            <li>NeupID</li>
            <li>Phone</li>
          </ul>

          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <a href={denyUrl}>Deny</a>
            </Button>
            <Button asChild>
              <Link href={termsPageUrl}>Allow</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
