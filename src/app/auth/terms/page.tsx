import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppDisplayName } from '@/lib/auth-callback';
import { buildAuthCallbackWithStatus, getApplicationName, getServerAuthContext } from '@/lib/auth-callback-server';

type TermsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthTermsPage({ searchParams }: TermsPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = getServerAuthContext(resolvedSearchParams);

  if (!context.appId || !context.authenticatesTo) {
    redirect('/auth/start');
  }

  const appName = await getApplicationName(context.appId);
  const displayAppName = getAppDisplayName(appName);

  const continueUrl = buildAuthCallbackWithStatus(context, 'allowed');
  const cancelUrl = buildAuthCallbackWithStatus(context, 'cancelled');

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Terms of Service</CardTitle>
          <CardDescription>
            By signing in to {displayAppName}, you agree to the following terms by {displayAppName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Continue only if you trust this application and want to share your account information based on the selected permissions.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <a href={cancelUrl}>Cancel</a>
            </Button>
            <Button asChild>
              <a href={continueUrl}>Continue</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
