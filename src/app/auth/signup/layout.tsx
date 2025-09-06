import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSignupStepData } from '@/actions/auth/signup';
import { redirect } from 'next/navigation';

export default async function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { success } = await getSignupStepData();

  // If the signup session cookie is not found or is expired,
  // redirect to the start of the flow.
  if (!success) {
    redirect('/auth/signup');
  }
  
  return (
     <div className="flex min-h-screen items-start justify-center bg-card md:bg-background py-12 md:items-center md:py-0">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Create your Neup.Account</CardTitle>
          <CardDescription>A single, secure account to access all NeupID services.</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
