
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from '@/components/icons';
import { hasActiveSessionCookies } from '@/lib/auth-actions';

export default async function StartPage() {
  const hasSession = await hasActiveSessionCookies();

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <div className="flex justify-start items-center mb-4">
            
          </div>
          <CardTitle className="text-2xl font-headline">Get Started</CardTitle>
          <CardDescription>
            Choose an option below to continue with NeupID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hasSession && (
              <Link
                href="/manage"
                className="flex w-full items-center justify-between p-4 border rounded-lg bg-accent/10 border-accent hover:border-primary transition-colors"
              >
                <div>
                  <h3 className="font-semibold">Continue</h3>
                  <p className="text-sm text-muted-foreground">Continue with your NeupID you're currently signed in.</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            )}

            <Link
              href="/auth/signin"
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
            >
              <div>
                <h3 className="font-semibold">Sign In</h3>
                <p className="text-sm text-muted-foreground">Sign in with NeupID and continue using NeupID Group Products and Services.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href="/auth/signup"
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
            >
              <div>
                <h3 className="font-semibold">Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up for an NeupID account to use NeupID Group Products and Services.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href="/auth/forget"
              className="flex w-full items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
            >
              <div>
                <h3 className="font-semibold">Forget NeupID</h3>
                <p className="text-sm text-muted-foreground">
                  Can't remember your NeupID? We can help you recover your ID.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
