import { redirect } from 'next/navigation';
import { buildAuthQuery, getServerAuthContext } from '@/core/helpers/auth-callback-server';

type TermsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthTermsPage({ searchParams }: TermsPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = getServerAuthContext(resolvedSearchParams);

  const params = new URLSearchParams(buildAuthQuery(context));
  params.set('step', 'terms');
  redirect(`/auth/sign?${params.toString()}`);
}
