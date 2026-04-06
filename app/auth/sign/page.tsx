import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionCookies } from '@/lib/cookies';
import { getValidatedStoredAccounts } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppDisplayName } from '@/lib/auth-callback';
import {
  buildAuthCallbackWithStatus,
  buildAuthQuery,
  getServerAuthContext,
} from '@/lib/auth-callback-server';
import prisma from '@/lib/prisma';

type AuthSignStep = 'profile' | 'access' | 'terms';

const stepOrder: AuthSignStep[] = ['profile', 'access', 'terms'];

const accessLabelMap: Record<string, string> = {
  neupid: 'NeupID',
  firstName: 'First name',
  lastName: 'Last name',
  middleName: 'Middle name',
  displayName: 'Display name',
  dateBirth: 'Date of birth',
  age: 'Age',
  isMinor: 'Minor status',
  gender: 'Gender',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
};

type SignPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

function getStep(value: string | string[] | undefined): AuthSignStep {
  const first = getFirst(value);
  if (first === 'access' || first === 'terms' || first === 'profile') {
    return first;
  }

  return 'profile';
}

function buildSignUrl(
  context: ReturnType<typeof getServerAuthContext>,
  step: AuthSignStep,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams(buildAuthQuery(context));
  params.set('step', step);

  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/auth/sign?${query}` : '/auth/sign';
}

function normalizeAccess(access: unknown): string[] {
  if (!Array.isArray(access)) {
    return ['Name', 'Email', 'NeupID', 'Phone'];
  }

  const values = access
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => accessLabelMap[entry] || entry)
    .filter((entry) => entry.trim().length > 0);

  return values.length > 0 ? values : ['Name', 'Email', 'NeupID', 'Phone'];
}

function getTermsText(policies: unknown): string {
  if (!Array.isArray(policies)) {
    return 'By continuing, you agree to this application\'s terms and data usage rules.';
  }

  const termsEntry = policies.find((policy) => {
    if (!policy || typeof policy !== 'object') {
      return false;
    }

    const record = policy as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
    return name.includes('terms');
  });

  if (!termsEntry || typeof termsEntry !== 'object') {
    return 'By continuing, you agree to this application\'s terms and data usage rules.';
  }

  const record = termsEntry as Record<string, unknown>;
  const policyText = typeof record.policy === 'string' ? record.policy.trim() : '';
  return policyText.length > 0
    ? policyText
    : 'By continuing, you agree to this application\'s terms and data usage rules.';
}

export default async function AuthSignPage({ searchParams }: SignPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = getServerAuthContext(resolvedSearchParams);
  const step = getStep(resolvedSearchParams.step);

  const application = context.appId
    ? await prisma.application.findUnique({
        where: { id: context.appId },
        select: {
          id: true,
          name: true,
          description: true,
          website: true,
          developer: true,
          access: true,
          policies: true,
        },
      })
    : null;

  const displayAppName = getAppDisplayName(application?.name);

  const storedAccounts = await getValidatedStoredAccounts();
  const { accountId, sessionId, sessionKey } = await getSessionCookies();
  const hasActiveSession = Boolean(accountId && sessionId && sessionKey);

  const skipAccountCheck = getFirst(resolvedSearchParams.skipAccountCheck) === '1';
  if (storedAccounts.length >= 2 && !skipAccountCheck) {
    const query = buildAuthQuery(context);
    const returnTo = buildSignUrl(context, step, { skipAccountCheck: '1' });
    const startParams = new URLSearchParams(query);
    startParams.set('redirects', returnTo);
    redirect(`/auth/start?${startParams.toString()}`);
  }

  if (!context.appId || !context.authenticatesTo) {
    redirect('/auth/start');
  }

  const callbackQuery = buildAuthQuery(context);
  const startPageUrl = callbackQuery ? `/auth/start?${callbackQuery}` : '/auth/start';
  const denyUrl = buildAuthCallbackWithStatus(context, 'denied');
  const cancelUrl = buildAuthCallbackWithStatus(context, 'cancelled');
  const continueUrl = buildAuthCallbackWithStatus(context, 'allowed');

  const stepTitleMap: Record<AuthSignStep, string> = {
    profile: 'Profile',
    access: 'Access',
    terms: 'Terms',
  };

  const accessItems = normalizeAccess(application?.access);
  const termsText = getTermsText(application?.policies);

  const profileNextUrl = buildSignUrl(context, 'access');
  const accessNextUrl = buildSignUrl(context, 'terms');
  const accessBackUrl = buildSignUrl(context, 'profile');
  const termsBackUrl = buildSignUrl(context, 'access');

  const hasBuilderData = Boolean(
    application?.description?.trim() ||
      application?.developer?.trim() ||
      application?.website?.trim() ||
      Array.isArray(application?.access) ||
      Array.isArray(application?.policies)
  );

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Sign Access</CardTitle>
          <CardDescription>
            Continue to {displayAppName} with your NeupAccount.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {stepOrder.map((item) => (
              <Badge key={item} variant={step === item ? 'default' : 'outline'}>
                {stepTitleMap[item]}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasActiveSession ? (
            <Button asChild className="w-full">
              <Link href={startPageUrl}>Sign In or Create Account</Link>
            </Button>
          ) : null}

          {hasActiveSession && step === 'profile' ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2">
                <p className="text-sm font-medium">Application</p>
                <p className="text-sm text-muted-foreground">{displayAppName}</p>
                {application?.description ? <p className="text-sm text-muted-foreground">{application.description}</p> : null}
              </div>

              <div className="rounded-md border p-4 space-y-2">
                <p className="text-sm font-medium">Application Builder Data</p>
                {hasBuilderData ? (
                  <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                    {application?.developer ? <li>Developer: {application.developer}</li> : null}
                    {application?.website ? <li>Website: {application.website}</li> : null}
                    {Array.isArray(application?.access) ? <li>Access fields configured: {application.access.length}</li> : null}
                    {Array.isArray(application?.policies) ? <li>Policies configured: {application.policies.length}</li> : null}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No additional builder data has been configured for this app yet.</p>
                )}
              </div>

              <Button asChild className="w-full">
                <Link href={profileNextUrl}>Next: Access</Link>
              </Button>
            </div>
          ) : null}

          {hasActiveSession && step === 'access' ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">This application can access:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  {accessItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="outline">
                  <Link href={accessBackUrl}>Back</Link>
                </Button>
                <Button asChild>
                  <Link href={accessNextUrl}>Next: Terms</Link>
                </Button>
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={denyUrl}>Deny</a>
              </Button>
            </div>
          ) : null}

          {hasActiveSession && step === 'terms' ? (
            <div className="space-y-6">
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{termsText}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="outline">
                  <Link href={termsBackUrl}>Back</Link>
                </Button>
                <Button asChild>
                  <a href={continueUrl}>Allow</a>
                </Button>
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={cancelUrl}>Cancel</a>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
