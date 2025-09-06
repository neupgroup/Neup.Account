
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const stepOrder = [
    { path: '/auth/signup/name', requiredField: null },
    { path: '/auth/signup/demographics', requiredField: 'firstName' },
    { path: '/auth/signup/nationality', requiredField: 'dob' },
    { path: '/auth/signup/contact', requiredField: 'nationality' },
    { path: '/auth/signup/otp', requiredField: 'phone' },
    { path: '/auth/signup/neupid', requiredField: 'phoneVerified' },
    { path: '/auth/signup/password', requiredField: 'neupId' },
    { path: '/auth/signup/terms', requiredField: 'password' },
];

async function getSignupStatus() {
    const authRequestId = cookies().get('temp_auth_id')?.value;
    if (!authRequestId) {
        return { valid: false, currentStepPath: '/auth/signup/name' };
    }

    const authRequestRef = doc(db, 'auth_requests', authRequestId);
    const authRequestDoc = await getDoc(authRequestRef);

    if (!authRequestDoc.exists() || (authRequestDoc.data().expiresAt && authRequestDoc.data().expiresAt.toDate() < new Date())) {
        cookies().delete('temp_auth_id');
        return { valid: false, currentStepPath: '/auth/signup/name' };
    }

    const data = authRequestDoc.data()?.data || {};
    let currentStepPath = '/auth/signup/name';

    for (const step of stepOrder) {
        if (step.requiredField && !data[step.requiredField]) {
            break;
        }
        currentStepPath = step.path;
    }

    return { valid: true, currentStepPath };
}


export default async function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { valid, currentStepPath } = await getSignupStatus();
  
  // This is a dynamic check on the server for every request to a /signup/* page.
  const pathname = cookies().get('next-url')?.value || '/auth/signup/name';

  if (!valid) {
    // If the cookie/request is invalid, force a redirect to the start page to generate a new one.
    // This prevents loops if something goes wrong.
    if (pathname !== '/auth/signup') {
        redirect('/auth/signup');
    }
  } else {
     // If the user is trying to access a page they haven't unlocked yet,
     // redirect them to the last step they are allowed to be on.
     const currentStepIndex = stepOrder.findIndex(step => step.path === currentStepPath);
     const requestedStepIndex = stepOrder.findIndex(step => step.path === pathname);
     
     if(requestedStepIndex > currentStepIndex) {
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
