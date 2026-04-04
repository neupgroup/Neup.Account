import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionCookies } from '@/lib/cookies';
import { getValidatedStoredAccounts } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppDisplayName } from '@/lib/auth-callback';
import { buildAuthPath, buildAuthQuery, getApplicationName, getServerAuthContext } from '@/lib/auth-callback-server';

type SignPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

export default async function AuthSignPage({ searchParams }: SignPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = getServerAuthContext(resolvedSearchParams);
  const appName = await getApplicationName(context.appId);
  const displayAppName = getAppDisplayName(appName);

  const storedAccounts = await getValidatedStoredAccounts();
  const { accountId, sessionId, sessionKey } = await getSessionCookies();
  const hasActiveSession = Boolean(accountId && sessionId && sessionKey);

  const skipAccountCheck = getFirst(resolvedSearchParams.skipAccountCheck) === '1';
  if (storedAccounts.length >= 2 && !skipAccountCheck) {
    const query = buildAuthQuery(context);
    const returnTo = `${buildAuthPath('/auth/sign', context)}${query ? '&' : '?'}skipAccountCheck=1`;
    const startParams = new URLSearchParams(query);
    startParams.set('redirects', returnTo);
    redirect(`/auth/start?${startParams.toString()}`);
  }

  const callbackQuery = buildAuthQuery(context);
  const startPageUrl = callbackQuery ? `/auth/start?${callbackQuery}` : '/auth/start';
  const permissionsPageUrl = buildAuthPath('/auth/sign/permissions', context);

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Get Started</CardTitle>
          <CardDescription>
            Continue to {displayAppName} with your NeupAccount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasActiveSession ? (
            <Button asChild className="w-full">
              <Link href={permissionsPageUrl}>Continue</Link>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link href={startPageUrl}>Sign In or Create Account</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
