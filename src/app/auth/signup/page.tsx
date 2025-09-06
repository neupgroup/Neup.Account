import { initializeSignup } from '@/actions/auth/signup';
import { redirect } from 'next/navigation';

// This page now acts as the entry point for the signup flow.
// It initializes the auth request and redirects to the first step.
export default async function SignUpStartPage() {
  const { success, requestId } = await initializeSignup();

  if (success && requestId) {
    // Redirect to the first step of the form
    redirect('/auth/signup/name');
  } else {
    // Handle error, maybe redirect to a generic error page or show a message
    redirect('/auth/start?error=signup_initialization_failed');
  }

  // This part will not be rendered due to the redirect.
  return null;
}
