import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const stepOrder = [
    { path: '/auth/signup/name', status: 'pending_name' },
    { path: '/auth/signup/demographics', status: 'pending_demographics' },
    { path: '/auth/signup/nationality', status: 'pending_nationality' },
    { path: '/auth/signup/contact', status: 'pending_contact' },
    { path: '/auth/signup/otp', status: 'pending_otp' },
    { path: '/auth/signup/neupid', status: 'pending_neupid' },
    { path: '/auth/signup/password', status: 'pending_password' },
    { path: '/auth/signup/terms', status: 'pending_terms' },
];

async function getSignupStatus(authRequestId: string | null) {
    if (!authRequestId) {
        return { valid: false, currentStepPath: '/auth/signup' };
    }

    const authRequestRef = doc(db, 'auth_requests', authRequestId);
    const authRequestDoc = await getDoc(authRequestRef);

    if (!authRequestDoc.exists() || (authRequestDoc.data().expiresAt && authRequestDoc.data().expiresAt.toDate() < new Date())) {
        return { valid: false, currentStepPath: '/auth/signup' };
    }

    const status = authRequestDoc.data()?.status || 'pending_name';
    const currentStep = stepOrder.find(s => s.status === status);
    
    const currentStepPath = currentStep ? currentStep.path : '/auth/signup';

    return { valid: true, currentStepPath };
}


export default async function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  // Use the 'x-next-pathname' header set by the middleware for a reliable path.
  const pathname = headersList.get('x-next-pathname') || '/';

  // We can't access sessionStorage on the server, so validation must happen
  // on the client side within each page. This layout provides the structure.

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
