
import { redirect } from 'next/navigation';

// This page just redirects to the view page by default.
export default async function AppBasePage({ params }: { params: Promise<{ slugid: string }> }) {
  const { slugid } = await params;
  redirect(`/manage/root/app/${slugid}/view`);
}
