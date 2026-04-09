import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authSignStepOrder, getAuthSignPageData } from '@/services/auth/sign';

type SignPageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthSignPage({ searchParams }: SignPageProps) {
  const resolvedSearchParams = await searchParams;
  const pageData = await getAuthSignPageData(resolvedSearchParams);

  if (pageData.redirectTo) {
    redirect(pageData.redirectTo);
  }

  const {
    step,
    application,
    displayAppName,
    hasActiveSession,
    startPageUrl,
    denyUrl,
    cancelUrl,
    continueUrl,
    stepTitleMap,
    accessItems,
    termsText,
    profileNextUrl,
    accessNextUrl,
    accessBackUrl,
    termsBackUrl,
    hasBuilderData,
  } = pageData;

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Sign Access</CardTitle>
          <CardDescription>
            Continue to {displayAppName} with your NeupAccount.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {authSignStepOrder.map((item) => (
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
