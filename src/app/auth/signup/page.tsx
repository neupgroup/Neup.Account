import { initializeSignup } from '@/actions/auth/initialize';
import { redirect } from 'next/navigation';

export default async function SignUpStartPage() {
    await initializeSignup();
    redirect('/auth/signup/name');
    
    // This component will not render anything visible as it redirects immediately.
    return null;
}
