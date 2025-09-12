
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const stepOrder = [
    { path: '/auth/signup/name', status: 'pending_name' },
    { path: '/auth/signup/display-name', status: 'pending_display_name'},
    { path: '/auth/signup/demographics', status: 'pending_demographics' },
    { path: '/auth/signup/nationality', status: 'pending_nationality' },
    { path: '/auth/signup/contact', status: 'pending_contact' },
    { path: '/auth/signup/otp', status: 'pending_otp' },
    { path: '/auth/signup/neupid', status: 'pending_neupid' },
    { path: '/auth/signup/password', status: 'pending_password' },
    { path: '/auth/signup/terms', status: 'pending_terms' },
];

async function getSignupStatus() {
    const authRequestId = cookies().get('temp_auth_id')?.value;
    if (!authRequestId) {
        return { valid: false, currentStepPath: '/auth/signup' };
    }

    const authRequestRef = doc(db, 'auth_requests', authRequestId);
    const authRequestDoc = await getDoc(authRequestRef);

    if (!authRequestDoc.exists() || (authRequestDoc.data().expiresAt && authRequestDoc.data().expiresAt.toDate() < new Date())) {
        cookies().delete('temp_auth_id');
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
  const { valid, currentStepPath } = await getSignupStatus();
  
  // Use a more reliable way to get the current pathname
  const headersList = cookies();
  const nextUrl = headersList.get('next-url')?.value || '/';
  const pathname = nextUrl.startsWith('/auth/signup') ? nextUrl : '/auth/signup';


  if (!valid) {
    // If the session is invalid, any attempt to access a signup sub-page
    // should redirect to the entry point to start over.
    if (pathname !== '/auth/signup') {
        redirect('/auth/signup');
    }
  } else {
     const currentStepIndex = stepOrder.findIndex(step => step.path === currentStepPath);
     const requestedStepIndex = stepOrder.findIndex(step => step.path === pathname);
     
     // If the user tries to access a future step they haven't reached, redirect them back.
     if(requestedStepIndex > currentStepIndex) {
         redirect(currentStepPath);
     }
     
     // If the user lands on the base signup page but has a valid session,
     // send them to their current step.
     if (pathname === '/auth/signup') {
        redirect(currentStepPath);
     }
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
