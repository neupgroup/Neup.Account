import { initializeSignup } from '@/actions/auth/signup';
import { redirect } from 'next/navigation';

// This page now acts as the entry point for the signup flow.
// It initializes the auth request and redirects to the first step.
export default async function SignUpStartPage() {
  await initializeSignup();
  redirect('/auth/signup/name');

  // This part will not be rendered due to the redirect.
  return null;
}
